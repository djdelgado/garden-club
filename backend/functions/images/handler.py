import json
import os
from typing import Any, Dict
from urllib.parse import parse_qs

import boto3
from aws_lambda_powertools import Logger

logger = Logger()
dynamodb = boto3.resource("dynamodb")
s3_client = boto3.client("s3")

images_table = dynamodb.Table(os.environ.get("IMAGES_TABLE_NAME", "GardenClubImages"))
images_bucket = os.environ.get("IMAGES_BUCKET_NAME", "garden-club-images")


def format_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=str),
    }


def get_query_params(event: Dict[str, Any]) -> Dict[str, str]:
    """Extract query parameters from the event"""
    query_string = event.get("rawQueryString", "")
    if not query_string:
        return {}

    params = parse_qs(query_string)
    # parse_qs returns lists, get the first value
    return {k: v[0] if isinstance(v, list) else v for k, v in params.items()}


def get_images_by_event(event_id: str) -> Dict[str, Any]:
    """GET /images?eventId={id} - Get images for an event"""
    try:
        response = images_table.query(
            IndexName="EventIdIndex",
            KeyConditionExpression="eventId = :event_id",
            ExpressionAttributeValues={":event_id": event_id},
        )
        items = response.get("Items", [])
        return format_response(200, items)
    except Exception as err:
        logger.exception(f"Error getting images for event {event_id}")
        return format_response(500, {"error": str(err)})


def delete_image(image_id: str) -> Dict[str, Any]:
    """DELETE /images/{imageId} - Delete image"""
    try:
        response = images_table.get_item(Key={"imageId": image_id})

        if "Item" not in response:
            return format_response(404, {"error": "Image not found"})

        item = response["Item"]
        s3_key = item.get("s3Key")

        if s3_key:
            s3_client.delete_object(Bucket=images_bucket, Key=s3_key)

        images_table.delete_item(Key={"imageId": image_id})
        return format_response(204, {})

    except Exception as err:
        logger.exception(f"Error deleting image {image_id}")
        return format_response(500, {"error": str(err)})


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for images"""
    logger.info(f"Received request: {event}")

    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    path = event.get("rawPath", "")

    try:
        if method == "GET":
            params = get_query_params(event)
            event_id = params.get("eventId")

            if not event_id:
                return format_response(400, {"error": "Missing eventId query parameter"})

            return get_images_by_event(event_id)

        elif method == "DELETE":
            image_id = path.split("/")[-1]
            return delete_image(image_id)

        else:
            return format_response(405, {"error": "Method not allowed"})

    except Exception as err:
        logger.exception("Unhandled error in lambda_handler")
        return format_response(500, {"error": str(err)})
