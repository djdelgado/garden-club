import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError
from pydantic import BaseModel, ValidationError

from db_types import EventItem, MemberItem

logger = Logger()

# Use LocalStack endpoint in local dev, AWS managed credentials in production
dynamodb_kwargs = {"region_name": os.environ.get("AWS_REGION", "us-east-1")}
if localstack_endpoint := os.environ.get("LOCALSTACK_ENDPOINT"):
    dynamodb_kwargs["endpoint_url"] = localstack_endpoint

dynamodb = boto3.resource("dynamodb", **dynamodb_kwargs)
events_table = dynamodb.Table(os.environ.get("EVENTS_TABLE_NAME", "GardenClubEvents"))
members_table = dynamodb.Table(os.environ.get("MEMBERS_TABLE_NAME", "GardenClubMembers"))


class Event(BaseModel):
    eventId: str
    title: str
    description: str
    startTime: str
    endTime: str
    headerImageKey: Optional[str] = None
    createdAt: Optional[str] = None
    createdBy: Optional[str] = None


def format_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=str),
    }


def get_user_id(event: Dict[str, Any]) -> str:
    """Extract the caller's `sub` from the JWT claims.

    Delegates to get_claims so the single HTTP API v2 claims path (and the local
    dev fallback) lives in one place rather than being re-derived here.
    """
    return str(get_claims(event).get("sub") or "unknown")


def get_claims(event: Dict[str, Any]) -> Dict[str, Any]:
    """Extract JWT claims (HTTP API v2 path: requestContext.authorizer.jwt.claims).

    Mirrors the members handler, including the LocalStack escape hatch: sam local
    doesn't emulate the JWT authorizer, so fall back to LOCAL_DEV_CLAIMS when
    running against LocalStack. Double-gated on LOCALSTACK_ENDPOINT so a Lambda in
    AWS can never take this branch.
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


def find_member_by_sub(sub: str) -> Optional[MemberItem]:
    """Resolve a member row from the token sub via CognitoSubIndex (no scan).

    Mirrors the members handler lookup so RSVPs can be tied to a stable memberId.
    """
    if not sub:
        return None
    response = members_table.query(
        IndexName="CognitoSubIndex",
        KeyConditionExpression="cognitoSub = :s",
        ExpressionAttributeValues={":s": sub},
    )
    items = response.get("Items", [])
    return items[0] if items else None


def caller_member_id(event: Dict[str, Any]) -> Optional[str]:
    """memberId of the authenticated caller, or None if they have no member row."""
    member = find_member_by_sub(get_claims(event).get("sub", ""))
    return member.get("memberId") if member else None


def rsvp_set(item: Dict[str, Any]) -> Set[str]:
    """RSVP memberIds for an event item. DynamoDB stores a string set; absent when
    empty. Guards against a stray non-set value just in case."""
    value = item.get("rsvps")
    return set(value) if isinstance(value, (set, list)) else set()


def with_rsvp_summary(item: Dict[str, Any], member_id: Optional[str]) -> Dict[str, Any]:
    """Replace the raw `rsvps` set (not JSON serializable) with per-caller summary
    fields the frontend consumes."""
    attendees = rsvp_set(item)
    enriched = {k: v for k, v in item.items() if k != "rsvps"}
    enriched["rsvpCount"] = len(attendees)
    enriched["isAttending"] = member_id is not None and member_id in attendees
    return enriched


def is_past_event(item: Dict[str, Any]) -> bool:
    """True once an event's endTime is in the past (RSVPs are then rejected)."""
    end_time = item.get("endTime")
    if not end_time:
        return False
    try:
        dt = datetime.fromisoformat(str(end_time).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt < datetime.now(timezone.utc)
    except ValueError:
        return False


def get_events(event: Dict[str, Any]) -> Dict[str, Any]:
    """GET /events - List events, optionally filtered by ?startDate=YYYY-MM-DD"""
    try:
        params = event.get("queryStringParameters") or {}
        start_time = params.get("startTime")

        if start_time:
            response = events_table.scan(
                FilterExpression="#st >= :cutoff",
                ExpressionAttributeNames={"#st": "startTime"},
                ExpressionAttributeValues={":cutoff": start_time},
            )
        else:
            response = events_table.scan()

        items = response.get("Items", [])
        items.sort(key=lambda x: x.get("startTime", ""))
        # Resolve the caller's memberId once per request, not per item.
        member_id = caller_member_id(event)
        return format_response(200, [with_rsvp_summary(i, member_id) for i in items])
    except Exception as err:
        logger.exception("Error listing events")
        return format_response(500, {"error": str(err)})


def resolve_attendee_names(member_ids: Set[str]) -> List[str]:
    """Join RSVP memberIds against the members table for the detail view. Unknown
    ids (e.g. a since-deleted member) are silently dropped — self-healing, so no
    cascade delete is needed when a member is removed."""
    names: List[str] = []
    for member_id in member_ids:
        try:
            member = members_table.get_item(Key={"memberId": member_id}).get("Item")
        except ClientError:
            logger.exception("Error resolving attendee %s", member_id)
            continue
        if member and member.get("name"):
            names.append(member["name"])
    names.sort(key=str.lower)
    return names


def get_event_by_id(event_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    """GET /events/{id} - Get event by ID, with attendee names."""
    try:
        response = events_table.get_item(Key={"eventId": event_id})
        if "Item" not in response:
            return format_response(404, {"error": "Event not found"})
        item = response["Item"]
        summary = with_rsvp_summary(item, caller_member_id(event))
        summary["attendees"] = resolve_attendee_names(rsvp_set(item))
        return format_response(200, summary)
    except Exception as err:
        logger.exception(f"Error getting event {event_id}")
        return format_response(500, {"error": str(err)})


def create_event(body: str, user_id: str) -> Dict[str, Any]:
    """POST /events - Create new event"""
    try:
        data = json.loads(body)
        event_data = Event(**data)
        now = datetime.now(timezone.utc).isoformat()

        item: EventItem = {
            **event_data.model_dump(),
            "createdAt": now,
            "createdBy": user_id,
        }

        events_table.put_item(Item=item)
        return format_response(201, item)
    except ValidationError as err:
        logger.exception("Validation error")
        return format_response(400, {"error": "Invalid event data", "details": err.errors()})
    except Exception as err:
        logger.exception("Error creating event")
        return format_response(500, {"error": str(err)})


def update_event(event_id: str, body: str, event: Dict[str, Any]) -> Dict[str, Any]:
    """PUT /events/{id} - Update event"""
    try:
        data = json.loads(body)
        response = events_table.get_item(Key={"eventId": event_id})

        if "Item" not in response:
            return format_response(404, {"error": "Event not found"})

        existing_item = response["Item"]
        # Never let a client overwrite the RSVP set through PUT.
        data.pop("rsvps", None)
        existing_item.update(data)

        events_table.put_item(Item=existing_item)
        # Strip the raw set (not JSON serialisable) the same way GET does.
        return format_response(200, with_rsvp_summary(existing_item, caller_member_id(event)))
    except Exception as err:
        logger.exception(f"Error updating event {event_id}")
        return format_response(500, {"error": str(err)})


def delete_event(event_id: str) -> Dict[str, Any]:
    """DELETE /events/{id} - Delete event"""
    try:
        events_table.delete_item(Key={"eventId": event_id})
        return format_response(204, {})
    except Exception as err:
        logger.exception(f"Error deleting event {event_id}")
        return format_response(500, {"error": str(err)})


def add_rsvp(event_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    """POST /events/{id}/rsvp - Mark the caller as attending (idempotent)."""
    try:
        member_id = caller_member_id(event)
        if not member_id:
            return format_response(403, {"error": "No member record for caller"})

        response = events_table.get_item(Key={"eventId": event_id})
        if "Item" not in response:
            return format_response(404, {"error": "Event not found"})
        if is_past_event(response["Item"]):
            return format_response(409, {"error": "Cannot RSVP to a past event"})

        # Atomic string-set add — safe under concurrent RSVPs, no read-modify-write.
        updated = events_table.update_item(
            Key={"eventId": event_id},
            UpdateExpression="ADD rsvps :m",
            ExpressionAttributeValues={":m": {member_id}},
            ConditionExpression="attribute_exists(eventId)",
            ReturnValues="ALL_NEW",
        )
        return format_response(200, with_rsvp_summary(updated["Attributes"], member_id))
    except ClientError as err:
        if err.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return format_response(404, {"error": "Event not found"})
        logger.exception(f"Error adding RSVP to event {event_id}")
        return format_response(500, {"error": str(err)})
    except Exception as err:
        logger.exception(f"Error adding RSVP to event {event_id}")
        return format_response(500, {"error": str(err)})


def remove_rsvp(event_id: str, event: Dict[str, Any]) -> Dict[str, Any]:
    """DELETE /events/{id}/rsvp - Remove the caller's RSVP (idempotent)."""
    try:
        member_id = caller_member_id(event)
        if not member_id:
            return format_response(403, {"error": "No member record for caller"})

        # DELETE of the last member drops the `rsvps` attribute (sets can't be empty).
        updated = events_table.update_item(
            Key={"eventId": event_id},
            UpdateExpression="DELETE rsvps :m",
            ExpressionAttributeValues={":m": {member_id}},
            ConditionExpression="attribute_exists(eventId)",
            ReturnValues="ALL_NEW",
        )
        return format_response(200, with_rsvp_summary(updated["Attributes"], member_id))
    except ClientError as err:
        if err.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return format_response(404, {"error": "Event not found"})
        logger.exception(f"Error removing RSVP from event {event_id}")
        return format_response(500, {"error": str(err)})
    except Exception as err:
        logger.exception(f"Error removing RSVP from event {event_id}")
        return format_response(500, {"error": str(err)})


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    logger.info({
        "endpoint": os.environ.get("LOCALSTACK_ENDPOINT"),
        "access_key": os.environ.get("AWS_ACCESS_KEY_ID"),
        "table": os.environ.get("EVENTS_TABLE_NAME"),
    })
    """Main Lambda handler for events"""
    logger.info(f"Received request: {event}")

    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    path = event.get("rawPath", "")
    body = event.get("body", "")

    try:
        # RSVP routes: /events/{id}/rsvp — matched before the generic branches so
        # path.split("/")[-1] ("rsvp") is never mistaken for an event id.
        if path.endswith("/rsvp"):
            event_id = path.split("/")[-2]
            if method == "POST":
                return add_rsvp(event_id, event)
            if method == "DELETE":
                return remove_rsvp(event_id, event)
            return format_response(405, {"error": "Method not allowed"})

        # Mutations are Admins-only. RSVP (handled above) stays open to any
        # authenticated member, and GET falls through untouched.
        if method in ("POST", "PUT", "DELETE") and not is_admin(event):
            logger.warning("Denied non-admin %s %s", method, path)
            return format_response(403, {"error": "Admin access required"})

        if method == "GET":
            if "/{id}" in path or path.endswith("/") == False and path.split("/")[-1] != "events":
                # Extract ID from path
                event_id = path.split("/")[-1]
                return get_event_by_id(event_id, event)
            else:
                return get_events(event)

        elif method == "POST":
            user_id = get_user_id(event)
            return create_event(body, user_id)

        elif method == "PUT":
            event_id = path.split("/")[-1]
            return update_event(event_id, body, event)

        elif method == "DELETE":
            event_id = path.split("/")[-1]
            return delete_event(event_id)

        else:
            return format_response(405, {"error": "Method not allowed"})

    except Exception as err:
        logger.exception("Unhandled error in lambda_handler")
        return format_response(500, {"error": str(err)})
