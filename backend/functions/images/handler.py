import json
import os
from typing import Any, Dict
from urllib.parse import parse_qs

import boto3
from aws_lambda_powertools import Logger

logger = Logger()
dynamodb = boto3.resource(
    "dynamodb",
    endpoint_url=os.environ.get("LOCALSTACK_ENDPOINT"),
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "test"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "test"),
)
s3_client = boto3.client("s3",
    endpoint_url=os.environ.get("LOCALSTACK_ENDPOINT"),
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "test"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "test"),
)

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


def get_all_folders() -> Dict[str, Any]:
    """GET /images/folders - Get all image folders with metadata"""
    try:
        # Scan DynamoDB to get all images
        response = images_table.scan()
        items = response.get("Items", [])

        # Group by folder and extract thumbnail info
        folders_dict = {}
        for item in items:
            folder_name = item.get("folderName")
            if folder_name:
                if folder_name not in folders_dict:
                    folders_dict[folder_name] = {
                        "folderName": folder_name,
                        "thumbnailUrl": None,
                        "imageCount": 0,
                    }

                folders_dict[folder_name]["imageCount"] += 1

                # Use first image marked as thumbnail
                if item.get("isThumbnail") and not folders_dict[folder_name]["thumbnailUrl"]:
                    s3_key = item.get("s3Key")
                    if s3_key:
                        # Generate presigned URL for thumbnail (valid for 1 hour)
                        thumbnail_url = s3_client.generate_presigned_url(
                            "get_object",
                            Params={"Bucket": images_bucket, "Key": s3_key},
                            ExpiresIn=3600,
                        )
                        folders_dict[folder_name]["thumbnailUrl"] = thumbnail_url

        folders = list(folders_dict.values())
        return format_response(200, {"folders": folders})
    except Exception as err:
        logger.exception("Error getting folders")
        return format_response(500, {"error": str(err)})


def get_images() -> Dict[str, Any]:
    """GET /images - Get all images (for testing)"""
    try:
        response = images_table.scan()
        items = response.get("Items", [])
        return format_response(200, items)
    except Exception as err:
        logger.exception("Error getting images")
        return format_response(500, {"error": str(err)})


def get_images_by_folder(folder_name: str) -> Dict[str, Any]:
    """GET /images?folderName={name} - Get images for a folder"""
    try:
        response = images_table.query(
            IndexName="FolderNameIndex",
            KeyConditionExpression="folderName = :folder_name",
            ExpressionAttributeValues={":folder_name": folder_name},
        )
        items = response.get("Items", [])
        return format_response(200, items)
    except Exception as err:
        logger.exception(f"Error getting images for folder {folder_name}")
        return format_response(500, {"error": str(err)})


def delete_image(image_id: str) -> Dict[str, Any]:
    """DELETE /images/{imageId} - Delete image"""
    try:
        response = images_table.get_item(Key={"imageId": image_id})

        if "Item" not in response:
            return format_response(404, {"error": "Image not found"})

        item = response["Item"]
        s3_key = item.get("s3Key")
        folder_name = item.get("folderName")
        is_thumbnail = item.get("isThumbnail", False)

        if s3_key:
            s3_client.delete_object(Bucket=images_bucket, Key=s3_key)

        images_table.delete_item(Key={"imageId": image_id})

        # If this was the thumbnail, mark the next image as thumbnail
        if is_thumbnail and folder_name:
            remaining = images_table.query(
                IndexName="FolderNameIndex",
                KeyConditionExpression="folderName = :folder_name",
                ExpressionAttributeValues={":folder_name": folder_name},
                Limit=1,
            )
            if remaining.get("Items"):
                next_image = remaining["Items"][0]
                images_table.update_item(
                    Key={"imageId": next_image["imageId"]},
                    UpdateExpression="SET isThumbnail = :val",
                    ExpressionAttributeValues={":val": True},
                )

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
            # Check if requesting folders list
            if path.endswith("/folders"):
                return get_all_folders()

            params = get_query_params(event)
            folder_name = params.get("folderName")

            if not folder_name:
                return get_images()  # Return all images if no folderName provided

            return get_images_by_folder(folder_name)

        elif method == "DELETE":
            image_id = path.split("/")[-1]
            return delete_image(image_id)

        else:
            return format_response(405, {"error": "Method not allowed"})

    except Exception as err:
        logger.exception("Unhandled error in lambda_handler")
        return format_response(500, {"error": str(err)})
