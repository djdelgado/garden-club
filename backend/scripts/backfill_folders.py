#!/usr/bin/env python3
"""One-time backfill of the GardenClubFolders metadata table.

Folder listing used to scan the whole images table on every request. We now
keep a small per-folder metadata item (imageCount + thumbnailKey) that is
maintained incrementally by the upload/images Lambdas. Existing deployments
have images but no folder items yet, so GET /images/folders would come back
empty until something is uploaded. Run this once per environment after
deploying to seed those items from the current images.

It is idempotent: re-running simply recomputes and overwrites each item.

Usage:
    python backfill_folders.py --stage dev
    python backfill_folders.py --stage local
    python backfill_folders.py --stage prod
"""

import argparse

import boto3

REGION = "us-east-1"


def get_dynamodb(stage: str):
    if stage == "local":
        return boto3.resource(
            "dynamodb",
            region_name=REGION,
            endpoint_url="http://localhost:4566",
            aws_access_key_id="test",
            aws_secret_access_key="test",
        )
    return boto3.resource("dynamodb", region_name=REGION)


def scan_all(table):
    """Scan a table following LastEvaluatedKey (DynamoDB caps pages at 1 MB)."""
    items = []
    kwargs = {}
    while True:
        response = table.scan(**kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            return items
        kwargs["ExclusiveStartKey"] = last_key


def backfill(dynamodb, stage: str) -> None:
    images_table = dynamodb.Table(f"GardenClubImages-{stage}")
    folders_table = dynamodb.Table(f"GardenClubFolders-{stage}")

    print(f"Scanning GardenClubImages-{stage}...")
    images = scan_all(images_table)

    # imageCount tracks READY images only (mirrors the album query + counters).
    folders: dict = {}
    for image in images:
        folder_name = image.get("folderName")
        if not folder_name or image.get("status") != "READY":
            continue
        meta = folders.setdefault(folder_name, {"imageCount": 0, "thumbnailKey": None})
        meta["imageCount"] += 1
        cover_key = image.get("thumbKey") or image.get("s3Key")
        if image.get("isThumbnail") and not meta["thumbnailKey"]:
            meta["thumbnailKey"] = cover_key
        # Fall back to any image's key so the album has a thumbnail.
        if meta["thumbnailKey"] is None:
            meta["thumbnailKey"] = cover_key

    print(f"Writing {len(folders)} folder items into GardenClubFolders-{stage}...")
    with folders_table.batch_writer() as batch:
        for folder_name, meta in folders.items():
            item = {"folderName": folder_name, "imageCount": meta["imageCount"]}
            if meta["thumbnailKey"]:
                item["thumbnailKey"] = meta["thumbnailKey"]
            batch.put_item(Item=item)
            print(f"  + {folder_name} ({meta['imageCount']} images)")

    print("Done.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill GardenClubFolders metadata.")
    parser.add_argument(
        "--stage",
        default="dev",
        choices=["local", "dev", "prod"],
        help="Target stage (default: dev). Use 'local' for LocalStack.",
    )
    args = parser.parse_args()

    dynamodb = get_dynamodb(args.stage)
    backfill(dynamodb, args.stage)


if __name__ == "__main__":
    main()
