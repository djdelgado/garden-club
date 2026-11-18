import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from uuid import uuid4

import boto3
from botocore.config import Config
from aws_lambda_powertools import Logger

from db_types import ImageItem, PresignedUploadResult

logger = Logger()

# Use LocalStack endpoint in local dev, AWS managed credentials in production
aws_kwargs = {"region_name": os.environ.get("AWS_REGION", "us-east-1")}
if localstack_endpoint := os.environ.get("LOCALSTACK_ENDPOINT"):
    aws_kwargs["endpoint_url"] = localstack_endpoint

# Disable flexible checksums for LocalStack compatibility (not supported by LocalStack)
config = Config(s3={"payload_signing_enabled": False})
s3_client = boto3.client("s3", config=config, **aws_kwargs)
dynamodb = boto3.resource("dynamodb", **aws_kwargs)

images_bucket = os.environ.get("IMAGES_BUCKET_NAME", "garden-club-images")
images_table = dynamodb.Table(os.environ.get("IMAGES_TABLE_NAME", "GardenClubImages"))
folders_table = dynamodb.Table(os.environ.get("FOLDERS_TABLE_NAME", "GardenClubFolders"))

# Image keys are immutable UUID paths, so stored objects can be cached forever by
# both CloudFront and the browser. This is baked into the presigned PUT, so the
# client MUST send a matching `Cache-Control` header on upload or the signature
# check fails (see frontend ImageService.uploadToS3).
IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable"


def format_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=str),
    }


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


def get_user_id(event: Dict[str, Any]) -> str:
    """Extract the caller's `sub` from the JWT claims.

    Delegates to get_claims so the single HTTP API v2 claims path (and the local
    dev fallback) lives in one place rather than being re-derived here.
    """
    return str(get_claims(event).get("sub") or "unknown")


def generate_presigned_url(bucket: str, key: str, content_type: str,expiration: int = 3600) -> str:
    """Generate presigned S3 PUT URL"""
    url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket,
            "Key": key,
            "ContentType": content_type,
            "CacheControl": IMAGE_CACHE_CONTROL,
        },
        ExpiresIn=expiration,
        HttpMethod="PUT",
    )
    # Replace internal endpoint with public endpoint if configured
    # In production: S3_PUBLIC_ENDPOINT won't be set, URL will use real AWS domain
    # In local dev: Replace internal Docker hostname with localhost
    public_endpoint = os.environ.get("S3_PUBLIC_ENDPOINT")
    if public_endpoint:
        internal_endpoint = os.environ.get("LOCALSTACK_ENDPOINT")
        url = url.replace(internal_endpoint, public_endpoint)
    return url


def bump_folder_on_ready(image: ImageItem) -> None:
    """Fold a freshly-READY image into its folder's metadata item: +1 to the
    count (ADD creates the item on first upload) and, when the image is the
    folder thumbnail, record its key for the folder listing."""
    folder_name = image.get("folderName")
    if not folder_name:
        return

    update_expr = "ADD imageCount :one"
    values: Dict[str, Any] = {":one": 1}
    cover_key = image.get("thumbKey") or image.get("s3Key")
    if image.get("isThumbnail") and cover_key:
        update_expr = "SET thumbnailKey = :key ADD imageCount :one"
        values[":key"] = cover_key

    folders_table.update_item(
        Key={"folderName": folder_name},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=values,
    )


def complete_upload(image_ids: list) -> Dict[str, Any]:
    """POST /upload/complete - Mark uploads as READY"""
    try:
        for image_id in image_ids:
            # ALL_OLD lets us read the pre-update item (folderName, isThumbnail,
            # previous status) so the folder counter only moves on the actual
            # PENDING -> READY transition and stays correct if complete is
            # retried for an already-READY image.
            response = images_table.update_item(
                Key={"imageId": image_id},
                # Mark READY and drop the TTL so the item is no longer expirable.
                UpdateExpression="SET #s = :val REMOVE #ttl",
                ConditionExpression="attribute_exists(imageId)",
                ExpressionAttributeNames={"#s": "status", "#ttl": "ttl"},
                ExpressionAttributeValues={":val": "READY"},
                ReturnValues="ALL_OLD",
            )
            old_item: ImageItem = response.get("Attributes", {})
            if old_item.get("status") != "READY":
                bump_folder_on_ready(old_item)

        return format_response(200, {"updated": len(image_ids)})
    except images_table.meta.client.exceptions.ConditionalCheckFailedException:
        return format_response(404, {"error": "One or more images not found"})
    except Exception as err:
        logger.exception("Error completing uploads")
        return format_response(500, {"error": str(err)})


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """POST /upload/presign or POST /upload/complete"""
    logger.info(f"Received upload request: {event}")

    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    path = event.get("rawPath", "")

    # Both upload routes (presign + complete) write to the shared gallery, so
    # both are Admins-only. Member self-service photos go through
    # POST /members/me/photo in the members handler instead.
    if not is_admin(event):
        logger.warning("Denied non-admin %s %s", method, path)
        return format_response(403, {"error": "Admin access required"})

    if method == "POST" and path.endswith("/upload/complete"):
        try:
            body = json.loads(event.get("body", "{}"))
            return complete_upload(body.get("imageIds", []))
        except json.JSONDecodeError:
            return format_response(400, {"error": "Invalid JSON body"})

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
        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat()
        # PENDING items expire after 24h via DynamoDB TTL; complete_upload
        # removes this so READY items are never collected.
        ttl = int((now_dt + timedelta(hours=24)).timestamp())

        images_response = images_table.query(
            IndexName="FolderNameIndex",
            KeyConditionExpression="folderName = :folder_name",
            ExpressionAttributeValues={":folder_name": folder_name},
            Limit=1,
        )
        folder_has_images = len(images_response.get("Items", [])) > 0

        upload_results = []

        with images_table.batch_writer() as batch:
            for idx, file_obj in enumerate(files):
                file_name = file_obj.get("fileName")
                content_type = file_obj.get("contentType")

                if not file_name:
                    continue

                # Generate S3 key and image ID
                image_id = str(uuid4())
                s3_key = f"{folder_name}/{image_id}/{file_name}"
                # Thumbnail variant lives under the same imageId prefix.
                thumb_key = f"{folder_name}/{image_id}/thumb/{file_name}"

                # Only mark first image as thumbnail if folder is empty
                is_thumbnail = (idx == 0 and not folder_has_images)

                # Presigned URL valid for 15 minutes so large batches that
                # start late (browser caps ~6 concurrent PUTs) don't 403.
                upload_url = generate_presigned_url(images_bucket, s3_key, content_type, expiration=900)
                thumb_upload_url = generate_presigned_url(images_bucket, thumb_key, content_type, expiration=900)

                # Store image metadata in DynamoDB
                image_item: ImageItem = {
                    "imageId": image_id,
                    "folderName": folder_name,
                    "s3Key": s3_key,
                    "thumbKey": thumb_key,
                    "fileName": file_name,
                    "uploadedAt": now,
                    "uploadedBy": user_id,
                    "isThumbnail": is_thumbnail,
                    "status": "PENDING",
                    "ttl": ttl,
                }

                batch.put_item(Item=image_item)

                result: PresignedUploadResult = {
                    "fileName": file_name,
                    "imageId": image_id,
                    "uploadUrl": upload_url,
                    "imageKey": s3_key,
                    "thumbUploadUrl": thumb_upload_url,
                    "thumbKey": thumb_key,
                    "isThumbnail": is_thumbnail,
                }
                upload_results.append(result)

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
