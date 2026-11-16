import json
import os
from typing import Any, Dict
from urllib.parse import parse_qs

import boto3
from aws_lambda_powertools import Logger

from db_types import ImageItem, FolderMetadata

logger = Logger()

# Use LocalStack endpoint in local dev, AWS managed credentials in production
aws_kwargs = {"region_name": os.environ.get("AWS_REGION", "us-east-1")}
if localstack_endpoint := os.environ.get("LOCALSTACK_ENDPOINT"):
    aws_kwargs["endpoint_url"] = localstack_endpoint

dynamodb = boto3.resource("dynamodb", **aws_kwargs)
s3_client = boto3.client("s3", **aws_kwargs)

images_table = dynamodb.Table(os.environ.get("IMAGES_TABLE_NAME", "GardenClubImages"))
folders_table = dynamodb.Table(os.environ.get("FOLDERS_TABLE_NAME", "GardenClubFolders"))
images_bucket = os.environ.get("IMAGES_BUCKET_NAME", "garden-club-images")


def query_all(table, **kwargs) -> list:
    """Run a DynamoDB query, following LastEvaluatedKey until the full result
    set is read. DynamoDB caps each page at 1 MB, so a single query() silently
    truncates once a folder exceeds that. Local helper for now; a natural home
    is the shared backend module tracked in #52.
    """
    items: list = []
    while True:
        response = table.query(**kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            return items
        kwargs["ExclusiveStartKey"] = last_key


def scan_all(table, **kwargs) -> list:
    """Run a DynamoDB scan, following LastEvaluatedKey until the full result
    set is read (same 1 MB per-page cap as query_all)."""
    items: list = []
    while True:
        response = table.scan(**kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            return items
        kwargs["ExclusiveStartKey"] = last_key


def presign_get(s3_key: str) -> str:
    """Generate a presigned GET URL (valid for 1 hour)."""
    return s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": images_bucket, "Key": s3_key},
        ExpiresIn=3600,
    )


def adjust_folder_count(folder_name: str, delta: int) -> None:
    """Atomically bump a folder's imageCount by delta, deleting the metadata
    item once the folder is empty so it drops out of the listing."""
    response = folders_table.update_item(
        Key={"folderName": folder_name},
        UpdateExpression="ADD imageCount :delta",
        ExpressionAttributeValues={":delta": delta},
        ReturnValues="UPDATED_NEW",
    )
    new_count = response.get("Attributes", {}).get("imageCount", 0)
    if new_count <= 0:
        folders_table.delete_item(Key={"folderName": folder_name})


def set_folder_thumbnail(folder_name: str, thumbnail_key: str) -> None:
    """Point a folder's metadata item at a new thumbnail s3Key. No-op if the
    folder item no longer exists (e.g. it was just emptied), so we never
    resurrect an empty folder with a dangling thumbnail."""
    try:
        folders_table.update_item(
            Key={"folderName": folder_name},
            UpdateExpression="SET thumbnailKey = :key",
            ConditionExpression="attribute_exists(folderName)",
            ExpressionAttributeValues={":key": thumbnail_key},
        )
    except folders_table.meta.client.exceptions.ConditionalCheckFailedException:
        pass


def format_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=str),
    }


def presign_get(s3_key: str) -> str:
    """Generate a presigned GET URL for an object (valid for 1 hour)"""
    return s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": images_bucket, "Key": s3_key},
        ExpiresIn=3600,
    )


def get_query_params(event: Dict[str, Any]) -> Dict[str, str]:
    """Extract query parameters from the event"""
    query_string = event.get("rawQueryString", "")
    if not query_string:
        return {}

    params = parse_qs(query_string)
    # parse_qs returns lists, get the first value
    return {k: v[0] if isinstance(v, list) else v for k, v in params.items()}


def get_all_folders() -> Dict[str, Any]:
    """GET /images/folders - Get all image folders with metadata.

    Reads the small GardenClubFolders table (one item per folder) instead of
    scanning every image, so cost/latency scale with the number of folders.
    """
    try:
        folder_items: list[dict] = scan_all(folders_table)

        folders: list[FolderMetadata] = []
        for item in folder_items:
            folder_name = item.get("folderName")
            if not folder_name:
                continue
            meta: FolderMetadata = {
                "folderName": folder_name,
                "imageCount": int(item.get("imageCount", 0)),
            }
            thumbnail_key = item.get("thumbnailKey")
            if thumbnail_key:
                meta["thumbnailUrl"] = presign_get(thumbnail_key)
            folders.append(meta)

        return format_response(200, {"folders": folders})
    except Exception as err:
        logger.exception("Error getting folders")
        return format_response(500, {"error": str(err)})


def get_images_by_folder(folder_name: str) -> Dict[str, Any]:
    """GET /images?folderName={name} - Get images for a folder"""
    try:
        items: list[ImageItem] = query_all(
            images_table,
            IndexName="FolderNameIndex",
            KeyConditionExpression="folderName = :folder_name",
            FilterExpression="#s = :status_val",
            # Project only what the gallery renders; uploadedBy/status are unused
            # on the wire (the query already filters to READY).
            ProjectionExpression="imageId, folderName, s3Key, thumbKey, fileName, uploadedAt, isThumbnail",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":folder_name": folder_name, ":status_val": "READY"},
        )
        for item in items:
            s3_key = item.get("s3Key")
            if s3_key:
                item["imageUrl"] = presign_get(s3_key)
            # Thumbnail for grid rendering; fall back to the original for images
            # uploaded before thumbnails existed.
            thumb_key = item.get("thumbKey")
            item["thumbUrl"] = presign_get(thumb_key) if thumb_key else item.get("imageUrl")
        return format_response(200, {"images": items})
    except Exception as err:
        logger.exception(f"Error getting images for folder {folder_name}")
        return format_response(500, {"error": str(err)})


def delete_image(image_id: str) -> Dict[str, Any]:
    """DELETE /images/{imageId} - Delete image"""
    try:
        response = images_table.get_item(Key={"imageId": image_id})

        if "Item" not in response:
            return format_response(404, {"error": "Image not found"})

        item: ImageItem = response["Item"]
        s3_key = item.get("s3Key")
        thumb_key = item.get("thumbKey")
        folder_name = item.get("folderName")
        is_thumbnail = item.get("isThumbnail", False)
        was_ready = item.get("status") == "READY"

        if s3_key:
            s3_client.delete_object(Bucket=images_bucket, Key=s3_key)
        if thumb_key:
            s3_client.delete_object(Bucket=images_bucket, Key=thumb_key)

        images_table.delete_item(Key={"imageId": image_id})

        # The folder counter tracks READY images only, so only decrement when a
        # READY image is removed (and may delete the folder item once empty).
        if folder_name and was_ready:
            adjust_folder_count(folder_name, -1)

        # If this was the thumbnail, promote the next image and keep the folder
        # metadata's thumbnailKey in lockstep so the listing never dangles.
        if is_thumbnail and folder_name:
            remaining = images_table.query(
                IndexName="FolderNameIndex",
                KeyConditionExpression="folderName = :folder_name",
                ExpressionAttributeValues={":folder_name": folder_name},
                Limit=1,
            )
            if remaining.get("Items"):
                next_image: ImageItem = remaining["Items"][0]
                images_table.update_item(
                    Key={"imageId": next_image["imageId"]},
                    UpdateExpression="SET isThumbnail = :val",
                    ExpressionAttributeValues={":val": True},
                )
                next_key = next_image.get("thumbKey") or next_image.get("s3Key")
                if next_key:
                    set_folder_thumbnail(folder_name, next_key)

        return format_response(204, {})

    except Exception as err:
        logger.exception(f"Error deleting image {image_id}")
        return format_response(500, {"error": str(err)})

def update_folder_name(folder_name: str, new_folder_name: str) -> Dict[str, Any]:
    """PUT /images/folders/{folderName} - Rename a folder across all its images"""
    try:
        items: list[ImageItem] = query_all(
            images_table,
            IndexName="FolderNameIndex",
            KeyConditionExpression="folderName = :folder_name",
            ExpressionAttributeValues={":folder_name": folder_name},
        )

        if not items:
            return format_response(404, {"error": "Folder not found"})

        # Rewrite every image's folderName in bulk; batch_writer buffers and
        # flushes in batches of 25 instead of one round trip per image.
        with images_table.batch_writer() as batch:
            for item in items:
                batch.put_item(Item={**item, "folderName": new_folder_name})

        # Move the folder metadata item: delete the old one, recreate it under
        # the new name carrying the same count and thumbnail.
        old_meta = folders_table.get_item(Key={"folderName": folder_name}).get("Item")
        if old_meta:
            new_meta = {**old_meta, "folderName": new_folder_name}
            folders_table.put_item(Item=new_meta)
            folders_table.delete_item(Key={"folderName": folder_name})

        return format_response(200, {"updated": len(items), "folderName": new_folder_name})

    except Exception as err:
        logger.exception(f"Error renaming folder {folder_name}")
        return format_response(500, {"error": str(err)})


def delete_folder(folder_name: str) -> Dict[str, Any]:
    """DELETE /images/folders/{folderName} - Delete folder and all images"""
    try:
        items: list[ImageItem] = query_all(
            images_table,
            IndexName="FolderNameIndex",
            KeyConditionExpression="folderName = :folder_name",
            ExpressionAttributeValues={":folder_name": folder_name},
        )

        if not items:
            return format_response(404, {"error": "Folder not found"})

        # Batch the S3 deletes (up to 1000 keys per delete_objects call) instead
        # of one delete_object per image.
        s3_keys = [
            key
            for item in items
            for key in (item.get("s3Key"), item.get("thumbKey"))
            if key
        ]
        for i in range(0, len(s3_keys), 1000):
            chunk = s3_keys[i:i + 1000]
            s3_client.delete_objects(
                Bucket=images_bucket,
                Delete={"Objects": [{"Key": key} for key in chunk]},
            )

        # Batch the DynamoDB deletes (25 per flush) via batch_writer.
        with images_table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"imageId": item["imageId"]})

        folders_table.delete_item(Key={"folderName": folder_name})

        return format_response(204, {})

    except Exception as err:
        logger.exception(f"Error deleting folder {folder_name}")
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
                # The unfiltered listing (every raw item, PENDING included) is
                # not used by the frontend and leaks the whole table; require a
                # folderName instead.
                return format_response(400, {"error": "Missing required query parameter: folderName"})

            return get_images_by_folder(folder_name)
        elif method == "DELETE" and "/folders/" in path:
            folder_name = path.split("/folders/")[-1]
            return delete_folder(folder_name)

        elif method == "DELETE":
            image_id = path.split("/")[-1]
            return delete_image(image_id)

        elif method == "PUT" and "/folders/" in path:
            folder_name = path.split("/folders/")[-1]
            body = json.loads(event.get("body", "{}"))
            new_folder_name = body.get("newFolderName", "").strip()
            if not new_folder_name:
                return format_response(400, {"error": "Missing required field: newFolderName"})
            return update_folder_name(folder_name, new_folder_name)
        else:
            return format_response(405, {"error": "Method not allowed"})

    except Exception as err:
        logger.exception("Unhandled error in lambda_handler")
        return format_response(500, {"error": str(err)})
