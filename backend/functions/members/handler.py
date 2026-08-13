import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

import boto3
from aws_lambda_powertools import Logger
from botocore.config import Config
from botocore.exceptions import ClientError
from pydantic import BaseModel, ConfigDict, ValidationError

from db_types import MemberItem

logger = Logger()

# Use LocalStack endpoint in local dev, AWS managed credentials in production
aws_kwargs = {"region_name": os.environ.get("AWS_REGION", "us-east-1")}
if localstack_endpoint := os.environ.get("LOCALSTACK_ENDPOINT"):
    aws_kwargs["endpoint_url"] = localstack_endpoint

# Disable flexible checksums for LocalStack compatibility (not supported by LocalStack)
s3_config = Config(s3={"payload_signing_enabled": False})

dynamodb = boto3.resource("dynamodb", **aws_kwargs)
cognito = boto3.client("cognito-idp", **aws_kwargs)
s3_client = boto3.client("s3", config=s3_config, **aws_kwargs)

members_table = dynamodb.Table(os.environ.get("MEMBERS_TABLE_NAME", "GardenClubMembers"))
images_bucket = os.environ.get("IMAGES_BUCKET_NAME", "garden-club-images")
user_pool_id = os.environ.get("USER_POOL_ID", "")


class CreateMember(BaseModel):
    """POST /members — an admin invites with name + email only."""
    email: str
    name: str


class UpdateMember(BaseModel):
    """PUT /members/{memberId} — admin edit of any member."""
    email: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    role: Optional[Literal["MEMBER", "ADMIN"]] = None


class UpdateMe(BaseModel):
    """PUT /members/me — self-service. Only these fields are accepted.

    ``extra="forbid"`` rejects email/status/role/memberId/cognitoSub/cognitoUsername:
    a self-service email change would desync the immutable Cognito username.
    """
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    photoKey: Optional[str] = None


def format_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=str),
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_claims(event: Dict[str, Any]) -> Dict[str, Any]:
    """Extract JWT claims (HTTP API v2 path: requestContext.authorizer.jwt.claims).

    Local escape hatch: when running against LocalStack (which has no Cognito and
    where sam local doesn't emulate the JWT authorizer) fall back to LOCAL_DEV_CLAIMS.
    Double-gated on LOCALSTACK_ENDPOINT so a Lambda in AWS — which never has it — can
    never take this branch. This is an env-gated auth bypass; it logs loudly.
    """
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    ) or {}

    if not claims and os.environ.get("LOCALSTACK_ENDPOINT") and os.environ.get("LOCAL_DEV_CLAIMS"):
        logger.warning(
            "⚠️ LOCAL_DEV_CLAIMS auth bypass ACTIVE — trusting env-provided claims. "
            "This must only ever happen in local dev against LocalStack."
        )
        try:
            claims = json.loads(os.environ["LOCAL_DEV_CLAIMS"])
        except json.JSONDecodeError:
            logger.exception("Failed to parse LOCAL_DEV_CLAIMS")

    return claims


def parse_groups(claims: Dict[str, Any]) -> List[str]:
    """Parse cognito:groups. HTTP API emits a bracketed string: "[Admins]" or
    "[Admins, Editors]" — a naive split on "," would never match."""
    groups = claims.get("cognito:groups", "")
    if isinstance(groups, list):
        return [str(g).strip() for g in groups]
    text = str(groups).strip()
    if text.startswith("[") and text.endswith("]"):
        text = text[1:-1]
    return [g.strip() for g in text.split(",") if g.strip()]


def is_admin(event: Dict[str, Any]) -> bool:
    """Check whether the caller belongs to the Cognito Admins group."""
    return "Admins" in parse_groups(get_claims(event))


def apply_public_endpoint(url: str) -> str:
    """Rewrite the internal LocalStack host to the browser-reachable one.

    Load-bearing LocalStack workaround (copied from upload/handler.py): in production
    S3_PUBLIC_ENDPOINT is unset and the URL keeps its real AWS domain.
    """
    public_endpoint = os.environ.get("S3_PUBLIC_ENDPOINT")
    internal_endpoint = os.environ.get("LOCALSTACK_ENDPOINT")
    if public_endpoint and internal_endpoint:
        url = url.replace(internal_endpoint, public_endpoint)
    return url


def presigned_put(key: str, content_type: str, expiration: int = 3600) -> str:
    url = s3_client.generate_presigned_url(
        "put_object",
        Params={"Bucket": images_bucket, "Key": key, "ContentType": content_type},
        ExpiresIn=expiration,
        HttpMethod="PUT",
    )
    return apply_public_endpoint(url)


def presigned_get(key: str, expiration: int = 3600) -> str:
    url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": images_bucket, "Key": key},
        ExpiresIn=expiration,
    )
    return apply_public_endpoint(url)


def with_photo_url(item: MemberItem) -> Dict[str, Any]:
    """Attach a 1 h presigned GET for the avatar. The bucket sets
    RestrictPublicBuckets: true, so a plain public URL would not work."""
    key = item.get("photoKey")
    if key:
        return {**item, "photoUrl": presigned_get(key)}
    return dict(item)


def find_member_by_email(email: str) -> Optional[MemberItem]:
    """Return the member row matching an email (case-insensitive) via EmailIndex."""
    response = members_table.query(
        IndexName="EmailIndex",
        KeyConditionExpression="emailLower = :e",
        ExpressionAttributeValues={":e": email.lower()},
    )
    items = response.get("Items", [])
    return items[0] if items else None


def find_member_by_sub(sub: str) -> Optional[MemberItem]:
    """Resolve a member row from the token sub via CognitoSubIndex (no scan)."""
    if not sub:
        return None
    response = members_table.query(
        IndexName="CognitoSubIndex",
        KeyConditionExpression="cognitoSub = :s",
        ExpressionAttributeValues={":s": sub},
    )
    items = response.get("Items", [])
    return items[0] if items else None


def sync_me(claims: Dict[str, Any]) -> None:
    """First-sign-in reconciliation, run at the top of GET /members and GET /members/me.

    Seeds ``name`` from the token *once* (guarded by nameSyncedAt) and flips
    INVITED -> ACTIVE. Copying the token name on every request would silently revert
    an admin's later name edit, since the token name never changes. Issues a single
    conditional update_item only when something actually changed.
    """
    member = find_member_by_sub(claims.get("sub", ""))
    if not member:
        return

    updates: Dict[str, Any] = {}
    if not member.get("nameSyncedAt") and claims.get("name"):
        updates["name"] = claims["name"]
        updates["nameSyncedAt"] = now_iso()
    if member.get("status") == "INVITED":
        updates["status"] = "ACTIVE"

    if not updates:
        return

    updates["updatedAt"] = now_iso()
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}
    set_expr = ", ".join(f"#{k} = :{k}" for k in updates)
    try:
        members_table.update_item(
            Key={"memberId": member["memberId"]},
            UpdateExpression=f"SET {set_expr}",
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ConditionExpression="attribute_exists(memberId)",
        )
    except ClientError:
        logger.exception("sync_me update failed for %s", member.get("memberId"))


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

def get_members(event: Dict[str, Any]) -> Dict[str, Any]:
    """GET /members — any authenticated user."""
    try:
        sync_me(get_claims(event))
        response = members_table.scan()
        items = response.get("Items", [])
        items.sort(key=lambda x: x.get("name", ""))
        return format_response(200, [with_photo_url(i) for i in items])
    except Exception as err:
        logger.exception("Error listing members")
        return format_response(500, {"error": str(err)})


def get_me(event: Dict[str, Any]) -> Dict[str, Any]:
    """GET /members/me — row resolved from the token sub, never a client-supplied id."""
    try:
        claims = get_claims(event)
        sync_me(claims)
        member = find_member_by_sub(claims.get("sub", ""))
        if not member:
            return format_response(404, {"error": "Member not found"})
        return format_response(200, with_photo_url(member))
    except Exception as err:
        logger.exception("Error resolving current member")
        return format_response(500, {"error": str(err)})


def update_me(event: Dict[str, Any], body: str) -> Dict[str, Any]:
    """PUT /members/me — self-service, only {name, phone, address, photoKey}."""
    claims = get_claims(event)
    member = find_member_by_sub(claims.get("sub", ""))
    if not member:
        return format_response(404, {"error": "Member not found"})

    try:
        data = UpdateMe(**json.loads(body))
    except ValidationError as err:
        logger.exception("Validation error")
        return format_response(400, {"error": "Invalid profile data", "details": err.errors()})

    try:
        if data.name is not None:
            member["name"] = data.name
        if data.phone is not None:
            member["phone"] = data.phone
        if data.address is not None:
            member["address"] = data.address
        if data.photoKey is not None and data.photoKey != member.get("photoKey"):
            old_key = member.get("photoKey")
            member["photoKey"] = data.photoKey
            if old_key:
                try:
                    s3_client.delete_object(Bucket=images_bucket, Key=old_key)
                except ClientError:
                    logger.exception("Failed to delete previous photo %s", old_key)

        member["updatedAt"] = now_iso()
        members_table.put_item(Item=member)
        return format_response(200, with_photo_url(member))
    except Exception as err:
        logger.exception("Error updating current member")
        return format_response(500, {"error": str(err)})


def presign_photo(event: Dict[str, Any], body: str) -> Dict[str, Any]:
    """POST /members/me/photo — presigned S3 PUT under members/{memberId}/.

    Deliberately does NOT reuse /upload/presign: that writes GardenClubImages, which
    the images handler groups into gallery albums by folderName — avatars would show
    up as albums.
    """
    claims = get_claims(event)
    member = find_member_by_sub(claims.get("sub", ""))
    if not member:
        return format_response(404, {"error": "Member not found"})

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return format_response(400, {"error": "Invalid JSON body"})

    file_name = data.get("fileName", "")
    content_type = data.get("contentType", "application/octet-stream")
    ext = os.path.splitext(file_name)[1]
    key = f"members/{member['memberId']}/{uuid.uuid4()}{ext}"

    try:
        upload_url = presigned_put(key, content_type)
        return format_response(200, {"uploadUrl": upload_url, "photoKey": key})
    except Exception as err:
        logger.exception("Error generating presigned photo URL")
        return format_response(500, {"error": str(err)})


def create_member(body: str) -> Dict[str, Any]:
    """POST /members — Admins only. AdminCreateUser (invite email) + table row."""
    try:
        data = CreateMember(**json.loads(body))
    except ValidationError as err:
        logger.exception("Validation error")
        return format_response(400, {"error": "Invalid member data", "details": err.errors()})

    email = data.email

    if find_member_by_email(email):
        return format_response(409, {"error": "A member with this email already exists"})

    # Provision the Cognito account first; DynamoDB owns display info, Cognito owns credentials.
    if user_pool_id:
        try:
            response = cognito.admin_create_user(
                UserPoolId=user_pool_id,
                Username=email,
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "email_verified", "Value": "true"},
                ],
                DesiredDeliveryMediums=["EMAIL"],
            )
        except ClientError as err:
            code = err.response.get("Error", {}).get("Code", "")
            if code == "UsernameExistsException":
                return format_response(409, {"error": "A Cognito user with this email already exists"})
            logger.exception("Error creating Cognito user")
            return format_response(500, {"error": str(err)})

        cognito_user = response.get("User", {})
        cognito_username = cognito_user.get("Username", email)
        cognito_sub = next(
            (a["Value"] for a in cognito_user.get("Attributes", []) if a["Name"] == "sub"),
            "",
        )
    else:
        # Local no-Cognito path (LocalStack Community has no Cognito). Synthesize a sub
        # and still write the row so the directory works locally.
        logger.warning("USER_POOL_ID unset — skipping Cognito provisioning (local no-Cognito path)")
        cognito_username = email
        cognito_sub = f"local-{uuid.uuid4()}"

    now = now_iso()
    item: MemberItem = {
        "memberId": str(uuid.uuid4()),
        "cognitoSub": cognito_sub,
        "cognitoUsername": cognito_username,
        "email": email,
        "emailLower": email.lower(),
        "name": data.name,
        "phone": "",
        "address": "",
        "status": "INVITED",
        "role": "MEMBER",
        "createdAt": now,
        "updatedAt": now,
        "lastInviteSentAt": now,
    }

    try:
        members_table.put_item(Item=item)
    except Exception as err:
        # Table write failed after the Cognito user was created — best-effort rollback.
        logger.exception("Error writing member row; rolling back Cognito user")
        if user_pool_id:
            try:
                cognito.admin_delete_user(UserPoolId=user_pool_id, Username=cognito_username)
            except ClientError:
                logger.exception("Failed to roll back Cognito user for %s", email)
        return format_response(500, {"error": str(err)})

    return format_response(201, item)


def update_member(member_id: str, body: str) -> Dict[str, Any]:
    """PUT /members/{memberId} — Admins only. name/email/phone/address/role."""
    try:
        data = UpdateMember(**json.loads(body))
    except ValidationError as err:
        logger.exception("Validation error")
        return format_response(400, {"error": "Invalid member data", "details": err.errors()})

    try:
        response = members_table.get_item(Key={"memberId": member_id})
        if "Item" not in response:
            return format_response(404, {"error": "Member not found"})

        item: MemberItem = response["Item"]

        if data.email is not None and data.email.lower() != item.get("emailLower"):
            existing = find_member_by_email(data.email)
            if existing and existing.get("memberId") != member_id:
                return format_response(409, {"error": "A member with this email already exists"})
            # The Cognito username is immutable — update the email *attribute* so invite/
            # reset emails route correctly, but the sign-in username does not change.
            if user_pool_id and item.get("cognitoUsername"):
                cognito.admin_update_user_attributes(
                    UserPoolId=user_pool_id,
                    Username=item["cognitoUsername"],
                    UserAttributes=[
                        {"Name": "email", "Value": data.email},
                        {"Name": "email_verified", "Value": "true"},
                    ],
                )
            item["email"] = data.email
            item["emailLower"] = data.email.lower()

        if data.name is not None:
            item["name"] = data.name
        if data.phone is not None:
            item["phone"] = data.phone
        if data.address is not None:
            item["address"] = data.address
        if data.role is not None and data.role != item.get("role"):
            if user_pool_id and item.get("cognitoUsername"):
                if data.role == "ADMIN":
                    cognito.admin_add_user_to_group(
                        UserPoolId=user_pool_id, Username=item["cognitoUsername"], GroupName="Admins"
                    )
                else:
                    cognito.admin_remove_user_from_group(
                        UserPoolId=user_pool_id, Username=item["cognitoUsername"], GroupName="Admins"
                    )
            item["role"] = data.role

        item["updatedAt"] = now_iso()
        members_table.put_item(Item=item)
        return format_response(200, with_photo_url(item))
    except ClientError as err:
        logger.exception(f"Cognito error updating member {member_id}")
        return format_response(500, {"error": str(err)})
    except Exception as err:
        logger.exception(f"Error updating member {member_id}")
        return format_response(500, {"error": str(err)})


def delete_member(member_id: str) -> Dict[str, Any]:
    """DELETE /members/{memberId} — Admins only. AdminDeleteUser + row + S3 prefix."""
    try:
        response = members_table.get_item(Key={"memberId": member_id})
        if "Item" not in response:
            return format_response(404, {"error": "Member not found"})

        item: MemberItem = response["Item"]

        username = item.get("cognitoUsername")
        if user_pool_id and username:
            try:
                cognito.admin_delete_user(UserPoolId=user_pool_id, Username=username)
            except ClientError as err:
                code = err.response.get("Error", {}).get("Code", "")
                if code != "UserNotFoundException":
                    logger.exception("Error deleting Cognito user")
                    return format_response(500, {"error": str(err)})

        # Remove the member's S3 prefix (avatars).
        try:
            objects = s3_client.list_objects_v2(Bucket=images_bucket, Prefix=f"members/{member_id}/")
            keys = [{"Key": o["Key"]} for o in objects.get("Contents", [])]
            if keys:
                s3_client.delete_objects(Bucket=images_bucket, Delete={"Objects": keys})
        except ClientError:
            logger.exception("Failed to clear S3 prefix for member %s", member_id)

        members_table.delete_item(Key={"memberId": member_id})
        return format_response(204, {})
    except Exception as err:
        logger.exception(f"Error deleting member {member_id}")
        return format_response(500, {"error": str(err)})


def resend_invite(member_id: str) -> Dict[str, Any]:
    """POST /members/{memberId}/resend-invite — Admins only.

    AdminCreateUser with MessageAction=RESEND. Cognito raises
    UnsupportedUserStateException for an already-ACTIVE user — surface that as 409.
    """
    try:
        response = members_table.get_item(Key={"memberId": member_id})
        if "Item" not in response:
            return format_response(404, {"error": "Member not found"})

        item: MemberItem = response["Item"]

        if user_pool_id and item.get("cognitoUsername"):
            try:
                cognito.admin_create_user(
                    UserPoolId=user_pool_id,
                    Username=item["cognitoUsername"],
                    MessageAction="RESEND",
                    DesiredDeliveryMediums=["EMAIL"],
                )
            except ClientError as err:
                code = err.response.get("Error", {}).get("Code", "")
                if code == "UnsupportedUserStateException":
                    return format_response(409, {"error": "Member has already accepted the invite"})
                logger.exception("Error resending invite")
                return format_response(500, {"error": str(err)})

        members_table.update_item(
            Key={"memberId": member_id},
            UpdateExpression="SET lastInviteSentAt = :ts, updatedAt = :ts",
            ExpressionAttributeValues={":ts": now_iso()},
        )
        return format_response(200, {"memberId": member_id, "status": "invite-resent"})
    except Exception as err:
        logger.exception(f"Error resending invite for member {member_id}")
        return format_response(500, {"error": str(err)})


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for members."""
    logger.info(f"Received request: {event}")

    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    path = event.get("rawPath", "")
    body = event.get("body") or "{}"

    try:
        # --- Self-service routes (resolve the caller from the token sub) ---
        # The literal "me" segment must be matched BEFORE the {memberId} branch,
        # otherwise path.split("/")[-1] would read "me" as a member id.
        if method == "GET" and path.endswith("/members/me"):
            return get_me(event)
        if method == "PUT" and path.endswith("/members/me"):
            return update_me(event, body)
        if method == "POST" and path.endswith("/members/me/photo"):
            return presign_photo(event, body)

        # --- List (any authenticated user) ---
        if method == "GET" and path.endswith("/members"):
            return get_members(event)

        # --- Admins-only mutations ---
        if method == "POST" and path.endswith("/resend-invite"):
            if not is_admin(event):
                return format_response(403, {"error": "Admin access required"})
            member_id = path.split("/")[-2]
            return resend_invite(member_id)

        if method == "POST" and path.endswith("/members"):
            if not is_admin(event):
                return format_response(403, {"error": "Admin access required"})
            return create_member(body)

        if method == "PUT":
            if not is_admin(event):
                return format_response(403, {"error": "Admin access required"})
            return update_member(path.split("/")[-1], body)

        if method == "DELETE":
            if not is_admin(event):
                return format_response(403, {"error": "Admin access required"})
            return delete_member(path.split("/")[-1])

        return format_response(405, {"error": "Method not allowed"})

    except Exception as err:
        logger.exception("Unhandled error in lambda_handler")
        return format_response(500, {"error": str(err)})
