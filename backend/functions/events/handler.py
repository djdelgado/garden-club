import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import boto3
from aws_lambda_powertools import Logger
from pydantic import BaseModel, ValidationError

logger = Logger()

# Use LocalStack endpoint in local dev, AWS managed credentials in production
dynamodb_kwargs = {"region_name": os.environ.get("AWS_REGION", "us-east-1")}
if localstack_endpoint := os.environ.get("LOCALSTACK_ENDPOINT"):
    dynamodb_kwargs["endpoint_url"] = localstack_endpoint

dynamodb = boto3.resource("dynamodb", **dynamodb_kwargs)
events_table = dynamodb.Table(os.environ.get("EVENTS_TABLE_NAME", "GardenClubEvents"))


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
    """Extract user ID from JWT token context"""
    try:
        return event.get("requestContext", {}).get("authorizer", {}).get("claims", {}).get("sub", "unknown")
    except Exception:
        return "unknown"


def get_events(event: Dict[str, Any]) -> Dict[str, Any]:
    """GET /events - Upcoming events + past 30 days, sorted by startTime"""
    try:
        cutoff = (datetime.utcnow() - timedelta(days=30)).isoformat()
        response = events_table.scan(
            FilterExpression="#st >= :cutoff",
            ExpressionAttributeNames={"#st": "startTime"},
            ExpressionAttributeValues={":cutoff": cutoff},
        )
        items = response.get("Items", [])
        items.sort(key=lambda x: x.get("startTime", ""))
        return format_response(200, items)
    except Exception as err:
        logger.exception("Error listing events")
        return format_response(500, {"error": str(err)})


def get_event_by_id(event_id: str) -> Dict[str, Any]:
    """GET /events/{id} - Get event by ID"""
    try:
        response = events_table.get_item(Key={"eventId": event_id})
        if "Item" not in response:
            return format_response(404, {"error": "Event not found"})
        return format_response(200, response["Item"])
    except Exception as err:
        logger.exception(f"Error getting event {event_id}")
        return format_response(500, {"error": str(err)})


def create_event(body: str, user_id: str) -> Dict[str, Any]:
    """POST /events - Create new event"""
    try:
        data = json.loads(body)
        event_data = Event(**data)
        now = datetime.utcnow().isoformat()

        item = {
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


def update_event(event_id: str, body: str) -> Dict[str, Any]:
    """PUT /events/{id} - Update event"""
    try:
        data = json.loads(body)
        response = events_table.get_item(Key={"eventId": event_id})

        if "Item" not in response:
            return format_response(404, {"error": "Event not found"})

        existing_item = response["Item"]
        existing_item.update(data)

        events_table.put_item(Item=existing_item)
        return format_response(200, existing_item)
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
        if method == "GET":
            if "/{id}" in path or path.endswith("/") == False and path.split("/")[-1] != "events":
                # Extract ID from path
                event_id = path.split("/")[-1]
                return get_event_by_id(event_id)
            else:
                return get_events(event)

        elif method == "POST":
            user_id = get_user_id(event)
            return create_event(body, user_id)

        elif method == "PUT":
            event_id = path.split("/")[-1]
            return update_event(event_id, body)

        elif method == "DELETE":
            event_id = path.split("/")[-1]
            return delete_event(event_id)

        else:
            return format_response(405, {"error": "Method not allowed"})

    except Exception as err:
        logger.exception("Unhandled error in lambda_handler")
        return format_response(500, {"error": str(err)})
