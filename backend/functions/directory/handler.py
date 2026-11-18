"""Club directory: the garden club's roster, separate from app accounts.

Routes:
  GET    /directory                 any authenticated user
  POST   /directory                 Admins — add one entry
  PUT    /directory/{entryId}       Admins — edit an entry
  DELETE /directory/{entryId}       Admins — remove an entry
  POST   /directory/import          Admins — bulk upsert from a parsed spreadsheet

Entries are linked to app members (GardenClubMembers) by email *at read time*.
This function never calls Cognito: inviting a directory entry to the app goes
through the members API (POST /members), which owns Cognito.
"""

import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import boto3
from aws_lambda_powertools import Logger
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator

from gardenclub_common import S3_LOCALSTACK_CONFIG, aws_kwargs, format_response, is_admin, scan_all
from db_types import DirectoryEntryItem

logger = Logger()

# Preserved for presigned_get's LocalStack URL rewrite below.
localstack_endpoint = os.environ.get("LOCALSTACK_ENDPOINT")

dynamodb = boto3.resource("dynamodb", **aws_kwargs())
s3_client = boto3.client("s3", config=S3_LOCALSTACK_CONFIG, **aws_kwargs())

directory_table = dynamodb.Table(os.environ.get("DIRECTORY_TABLE_NAME", "GardenClubDirectory"))
members_table = dynamodb.Table(os.environ.get("MEMBERS_TABLE_NAME", "GardenClubMembers"))
images_bucket = os.environ.get("IMAGES_BUCKET_NAME", "garden-club-images")

MAX_IMPORT_ROWS = 1000
FIELD_MAX_LEN = 500
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
EDITABLE_FIELDS = ("name", "email", "phone", "address")


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _clean(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return str(value).strip()


class EntryFields(BaseModel):
    """Shared field rules. None = "not provided"; "" = explicitly blank."""
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

    @field_validator("name", "email", "phone", "address", mode="before")
    @classmethod
    def strip_and_limit(cls, v: Any) -> Optional[str]:
        v = _clean(v)
        if v is not None and len(v) > FIELD_MAX_LEN:
            raise ValueError(f"must be at most {FIELD_MAX_LEN} characters")
        return v

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: Optional[str]) -> Optional[str]:
        if v and not EMAIL_RE.match(v):
            raise ValueError("is not a valid email address")
        return v


class CreateEntry(EntryFields):
    @field_validator("name")
    @classmethod
    def name_required(cls, v: Optional[str]) -> str:
        if not v:
            raise ValueError("is required")
        return v


class UpdateEntry(EntryFields):
    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v:
            raise ValueError("cannot be blank")
        return v


class ImportBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rows: List[Dict[str, Any]]


def validation_message(err: ValidationError) -> str:
    first = err.errors()[0]
    field = ".".join(str(p) for p in first.get("loc", ())) or "row"
    msg = first.get("msg", "invalid").removeprefix("Value error, ")
    return f"{field} {msg}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def presigned_get(key: str, expiration: int = 3600) -> str:
    """1 h presigned GET for a member avatar (the bucket blocks public reads)."""
    url = s3_client.generate_presigned_url(
        "get_object", Params={"Bucket": images_bucket, "Key": key}, ExpiresIn=expiration
    )
    public_endpoint = os.environ.get("S3_PUBLIC_ENDPOINT")
    if public_endpoint and localstack_endpoint:
        url = url.replace(localstack_endpoint, public_endpoint)
    return url


def find_entry_by_email(email: str) -> Optional[DirectoryEntryItem]:
    response = directory_table.query(
        IndexName="EmailIndex",
        KeyConditionExpression="emailLower = :e",
        ExpressionAttributeValues={":e": email.lower()},
    )
    items = response.get("Items", [])
    return items[0] if items else None


def apply_fields(item: DirectoryEntryItem, fields: Dict[str, Optional[str]], skip_blank: bool) -> bool:
    """Copy provided fields onto `item`; returns whether anything changed.

    skip_blank=True (import): a blank cell never erases an existing value.
    skip_blank=False (admin edit): "" clears the field.
    Blank optional fields are *removed*, never stored as "" (sparse EmailIndex).
    """
    changed = False
    for field in EDITABLE_FIELDS:
        value = fields.get(field)
        if value is None or (skip_blank and value == ""):
            continue
        if value == "":
            if field in item:
                del item[field]  # type: ignore[misc]
                changed = True
        elif item.get(field) != value:
            item[field] = value  # type: ignore[literal-required]
            changed = True

    item["nameLower"] = item["name"].lower()
    if item.get("email"):
        item["emailLower"] = item["email"].lower()
    else:
        item.pop("emailLower", None)
    return changed


def new_entry(fields: Dict[str, Optional[str]]) -> DirectoryEntryItem:
    now = now_iso()
    item: DirectoryEntryItem = {"entryId": str(uuid.uuid4()), "name": fields["name"] or "",
                                "createdAt": now, "updatedAt": now}
    apply_fields(item, fields, skip_blank=True)
    return item


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

def list_entries() -> Dict[str, Any]:
    """GET /directory — entries joined to app members by email at read time."""
    entries = scan_all(directory_table)
    members = scan_all(
        members_table,
        ProjectionExpression="memberId, emailLower, #s, photoKey",
        ExpressionAttributeNames={"#s": "status"},
    )
    by_email = {m["emailLower"]: m for m in members if m.get("emailLower")}

    result = []
    for entry in entries:
        out: Dict[str, Any] = {k: v for k, v in entry.items() if k not in ("nameLower", "emailLower")}
        member = by_email.get(entry.get("emailLower", ""))
        if member:
            linked: Dict[str, Any] = {"memberId": member["memberId"], "status": member.get("status")}
            if member.get("photoKey"):
                linked["photoUrl"] = presigned_get(member["photoKey"])
            out["linkedMember"] = linked
        result.append(out)

    result.sort(key=lambda e: e.get("name", "").lower())
    return format_response(200, result)


def create_entry(body: str) -> Dict[str, Any]:
    try:
        data = CreateEntry(**json.loads(body or "{}"))
    except (ValidationError, TypeError, json.JSONDecodeError) as err:
        msg = validation_message(err) if isinstance(err, ValidationError) else "Invalid JSON body"
        return format_response(400, {"error": msg})

    if data.email and find_entry_by_email(data.email):
        return format_response(409, {"error": "A directory entry with this email already exists"})

    item = new_entry(data.model_dump())
    directory_table.put_item(Item=item)
    return format_response(201, item)


def update_entry(entry_id: str, body: str) -> Dict[str, Any]:
    try:
        data = UpdateEntry(**json.loads(body or "{}"))
    except (ValidationError, TypeError, json.JSONDecodeError) as err:
        msg = validation_message(err) if isinstance(err, ValidationError) else "Invalid JSON body"
        return format_response(400, {"error": msg})

    response = directory_table.get_item(Key={"entryId": entry_id})
    item: Optional[DirectoryEntryItem] = response.get("Item")
    if not item:
        return format_response(404, {"error": "Directory entry not found"})

    if data.email and data.email.lower() != item.get("emailLower"):
        existing = find_entry_by_email(data.email)
        if existing and existing["entryId"] != entry_id:
            return format_response(409, {"error": "A directory entry with this email already exists"})

    if apply_fields(item, data.model_dump(), skip_blank=False):
        item["updatedAt"] = now_iso()
        directory_table.put_item(Item=item)
    return format_response(200, item)


def delete_entry(entry_id: str) -> Dict[str, Any]:
    directory_table.delete_item(Key={"entryId": entry_id})
    return format_response(204, {})


def import_entries(body: str) -> Dict[str, Any]:
    """POST /directory/import — upsert rows parsed from an .xlsx/.csv in the browser.

    Matching: by email; rows without an email match an existing *no-email* entry
    with the same name (so re-importing a roster doesn't duplicate them).
    Merge: the spreadsheet wins, but a blank cell never erases an existing value.
    Bad rows are skipped and reported; they don't fail the batch.
    """
    try:
        data = ImportBody(**json.loads(body or "{}"))
    except (ValidationError, TypeError, json.JSONDecodeError):
        return format_response(400, {"error": "Body must be {\"rows\": [...]}"})

    if len(data.rows) > MAX_IMPORT_ROWS:
        return format_response(400, {"error": f"At most {MAX_IMPORT_ROWS} rows per import"})

    entries = scan_all(directory_table)
    by_email: Dict[str, DirectoryEntryItem] = {e["emailLower"]: e for e in entries if e.get("emailLower")}
    by_name: Dict[str, DirectoryEntryItem] = {
        e["nameLower"]: e for e in entries if not e.get("emailLower") and e.get("nameLower")
    }

    pending: Dict[str, DirectoryEntryItem] = {}
    created_ids: set = set()
    updated_ids: set = set()
    skipped: List[Dict[str, Any]] = []

    for index, raw in enumerate(data.rows, start=1):
        try:
            row = EntryFields(**{k: v for k, v in raw.items() if k in EDITABLE_FIELDS})
        except ValidationError as err:
            skipped.append({"row": index, "reason": validation_message(err)})
            continue
        fields = row.model_dump()

        match, how = _match(fields, by_email, by_name)
        if match is None:
            if not fields.get("name"):
                skipped.append({"row": index, "reason": "name is required for a new entry"})
                continue
            item = new_entry(fields)
            created_ids.add(item["entryId"])
        else:
            item = match
            old_email = item.get("emailLower")
            if not apply_fields(item, fields, skip_blank=True):
                continue
            item["updatedAt"] = now_iso()
            if item["entryId"] not in created_ids:
                updated_ids.add(item["entryId"])
            if old_email and old_email != item.get("emailLower"):
                by_email.pop(old_email, None)
            if how == "name" and item.get("emailLower"):
                by_name.pop(item["nameLower"], None)  # it has an email now

        pending[item["entryId"]] = item
        if item.get("emailLower"):
            by_email[item["emailLower"]] = item
        else:
            by_name[item["nameLower"]] = item

    with directory_table.batch_writer() as batch:
        for item in pending.values():
            batch.put_item(Item=item)

    return format_response(200, {
        "created": len(created_ids),
        "updated": len(updated_ids),
        "skipped": skipped,
    })


def _match(
    fields: Dict[str, Optional[str]],
    by_email: Dict[str, DirectoryEntryItem],
    by_name: Dict[str, DirectoryEntryItem],
) -> Tuple[Optional[DirectoryEntryItem], str]:
    if fields.get("email"):
        hit = by_email.get(fields["email"].lower())
        if hit:
            return hit, "email"
        # A no-email entry with the same name gains this email rather than
        # being duplicated (e.g. a roster that later adds email addresses).
        if fields.get("name"):
            hit = by_name.get(fields["name"].lower())
            if hit:
                return hit, "name"
        return None, ""
    if fields.get("name"):
        hit = by_name.get(fields["name"].lower())
        if hit:
            return hit, "name"
    return None, ""


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    path = (event.get("rawPath", "") or "").rstrip("/")
    body = event.get("body") or "{}"

    try:
        if method == "GET" and path.endswith("/directory"):
            return list_entries()

        # Everything else mutates the roster: Admins only.
        if not is_admin(event):
            logger.warning("Denied non-admin %s %s", method, path)
            return format_response(403, {"error": "Admin access required"})

        if method == "POST" and path.endswith("/directory/import"):
            return import_entries(body)
        if method == "POST" and path.endswith("/directory"):
            return create_entry(body)

        entry_id = (event.get("pathParameters") or {}).get("entryId") or path.rsplit("/", 1)[-1]
        if method == "PUT":
            return update_entry(entry_id, body)
        if method == "DELETE":
            return delete_entry(entry_id)

        return format_response(405, {"error": "Method not allowed"})
    except Exception as err:
        logger.exception("Directory request failed: %s %s", method, path)
        return format_response(500, {"error": str(err)})
