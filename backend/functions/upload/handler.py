import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict
from uuid import uuid4

import boto3
from aws_lambda_powertools import Logger

logger = Logger()
s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

images_bucket = os.environ.get("IMAGES_BUCKET_NAME", "garden-club-images")
images_table = dynamodb.Table(os.environ.get("IMAGES_TABLE_NAME", "GardenClubImages"))


def format_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=str),
    }


def get_user_id(event: Dict[str, Any]) -> str:
    """Extract user ID from JWT token context"""
    try:
        return event.get("requestContext", {}).get("authorizer", {}).get("claims", {}).get("sub", "unknown")
    except Exception:
        return "unknown"


def generate_presigned_url(bucket: str, key: str, expiration: int = 3600) -> str:
    """Generate presigned S3 PUT URL"""
    url = s3_client.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expiration,
    )
    return url


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """POST /upload/presign - Generate presigned URL for file upload"""
    logger.info(f"Received upload presign request: {event}")

    try:
        body = json.loads(event.get("body", "{}"))
        event_id = body.get("eventId")
        file_name = body.get("fileName")
        content_type = body.get("contentType", "image/jpeg")

        if not event_id or not file_name:
            return format_response(
                400,
                {"error": "Missing required fields: eventId, fileName"}
            )

        # Generate S3 key and image ID
        image_id = str(uuid4())
        s3_key = f"{event_id}/{image_id}/{file_name}"

        # Generate presigned URL
        upload_url = generate_presigned_url(images_bucket, s3_key)

        # Store image metadata in DynamoDB
        user_id = get_user_id(event)
        now = datetime.utcnow().isoformat()

        image_item = {
            "imageId": image_id,
            "eventId": event_id,
            "s3Key": s3_key,
            "fileName": file_name,
            "uploadedAt": now,
            "uploadedBy": user_id,
        }

        images_table.put_item(Item=image_item)

        return format_response(
            200,
            {
                "uploadUrl": upload_url,
                "imageKey": s3_key,
                "imageId": image_id,
            }
        )

    except json.JSONDecodeError:
        logger.exception("Invalid JSON body")
        return format_response(400, {"error": "Invalid JSON body"})

    except Exception as err:
        logger.exception("Error generating presigned URL")
        return format_response(500, {"error": str(err)})
