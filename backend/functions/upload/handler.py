import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from uuid import uuid4

import boto3
from aws_lambda_powertools import Logger

logger = Logger()
s3_client = boto3.client("s3",
    endpoint_url=os.environ.get("LOCALSTACK_ENDPOINT"),
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "test"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "test"),
)
dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url=os.environ.get("LOCALSTACK_ENDPOINT"),
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "test"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "test"),
)

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
    """POST /upload/presign - Generate presigned URLs for file uploads"""
    logger.info(f"Received upload presign request: {event}")

    try:
        body = json.loads(event.get("body", "{}"))
        folder_name = body.get("folderName")
        files = body.get("files", [])  # Array of file objects

        if not folder_name:
            return format_response(
                400,
                {"error": "Missing required field: folderName"}
            )

        if not files or not isinstance(files, list):
            return format_response(
                400,
                {"error": "Missing or invalid field: files (must be an array)"}
            )

        # Check if folder already has images
        user_id = get_user_id(event)
        now = datetime.now(timezone.utc).isoformat()

        images_response = images_table.query(
            IndexName="FolderNameIndex",
            KeyConditionExpression="folderName = :folder_name",
            ExpressionAttributeValues={":folder_name": folder_name},
            Limit=1,
        )
        folder_has_images = len(images_response.get("Items", [])) > 0

        upload_results = []

        for idx, file_obj in enumerate(files):
            file_name = file_obj.get("fileName")

            if not file_name:
                continue

            # Generate S3 key and image ID
            image_id = str(uuid4())
            s3_key = f"{folder_name}/{image_id}/{file_name}"

            # Only mark first image as thumbnail if folder is empty
            is_thumbnail = (idx == 0 and not folder_has_images)

            # Generate presigned URL
            upload_url = generate_presigned_url(images_bucket, s3_key)

            # Store image metadata in DynamoDB
            image_item = {
                "imageId": image_id,
                "folderName": folder_name,
                "s3Key": s3_key,
                "fileName": file_name,
                "uploadedAt": now,
                "uploadedBy": user_id,
                "isThumbnail": is_thumbnail,
            }

            images_table.put_item(Item=image_item)

            upload_results.append({
                "fileName": file_name,
                "imageId": image_id,
                "uploadUrl": upload_url,
                "imageKey": s3_key,
                "isThumbnail": is_thumbnail,
            })

        return format_response(
            200,
            {
                "uploads": upload_results,
                "count": len(upload_results),
            }
        )

    except json.JSONDecodeError:
        logger.exception("Invalid JSON body")
        return format_response(400, {"error": "Invalid JSON body"})

    except Exception as err:
        logger.exception("Error generating presigned URLs")
        return format_response(500, {"error": str(err)})
