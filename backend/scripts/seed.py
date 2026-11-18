#!/usr/bin/env python3
"""Seed DynamoDB tables with sample data for local/dev testing.

Usage:
    python seed.py              # seeds dev tables (default)
    python seed.py --stage dev
    python seed.py --stage local

    # Seed a large folder to exercise >1 MB DynamoDB pagination:
    python seed.py --stage local --bulk 5000 --bulk-folder perf-test
"""

import argparse
import uuid
from datetime import datetime, timedelta, timezone

import boto3

REGION = "us-east-1"

SAMPLE_EVENTS = [
    {
        "title": "Spring Planting Day",
        "description": "Join us for our annual spring planting event. All skill levels welcome!",
        "startTime": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "endTime": (datetime.now(timezone.utc) + timedelta(days=7, hours=3)).isoformat(),
        "headerImageKey": "",
        "createdBy": "david-script",
    },
    {
        "title": "Composting Workshop",
        "description": "Learn the basics of composting and how to build your own bin at home.",
        "startTime": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
        "endTime": (datetime.now(timezone.utc) + timedelta(days=14, hours=2)).isoformat(),
        "headerImageKey": "",
        "createdBy": "seed-script",
    },
    {
        "title": "Summer Harvest Festival",
        "description": "Celebrate the season with food, music, and fresh produce from our members.",
        "startTime": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "endTime": (datetime.now(timezone.utc) + timedelta(days=30, hours=5)).isoformat(),
        "headerImageKey": "",
        "createdBy": "seed-script",
    },
]

imageId1 = str(uuid.uuid4())
imageId2 = str(uuid.uuid4())

SAMPLE_IMAGES = [
    {
        "imageId": imageId1,
        "folderName": "spring-2024",
        "fileName": "garden-overview.jpg",
        "s3Key": f"spring-2024/{imageId1}/garden-overview.jpg",
        "isThumbnail": True,
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "uploadedBy": "seed-script",
        "status": "READY",
    },
    {
        "imageId": imageId2,
        "folderName": "spring-2024",
        "fileName": "raised-beds.jpg",
        "s3Key": f"spring-2024/{imageId2}/raised-beds.jpg",
        "isThumbnail": False,
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "uploadedBy": "seed-script",
        "status": "READY",
    },
]

# Folder metadata items (GardenClubFolders table). imageCount tracks READY
# images only; thumbnailKey mirrors the image flagged isThumbnail.
SAMPLE_FOLDERS = [
    {
        "folderName": "spring-2024",
        "imageCount": len(SAMPLE_IMAGES),
        "thumbnailKey": SAMPLE_IMAGES[0]["s3Key"],
    },
]


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


def seed_events(dynamodb, stage: str) -> None:
    table_name = f"GardenClubEvents-{stage}"
    table = dynamodb.Table(table_name)
    now = datetime.now(timezone.utc).isoformat()

    print(f"Seeding {len(SAMPLE_EVENTS)} events into {table_name}...")
    for event in SAMPLE_EVENTS:
        item = {
            "eventId": str(uuid.uuid4()),
            "createdAt": now,
            **event,
        }
        table.put_item(Item=item)
        print(f"  + {item['title']} ({item['eventId']})")

    print(f"Done seeding events into {table_name}.")


def seed_images(dynamodb, stage: str) -> None:
    table_name = f"GardenClubImages-{stage}"
    table = dynamodb.Table(table_name)

    print(f"Seeding {len(SAMPLE_IMAGES)} images into {table_name}...")
    for image in SAMPLE_IMAGES:
        table.put_item(Item=image)
        print(f"  + {image['fileName']} ({image['imageId']})")

    print(f"Done seeding images into {table_name}.")


def seed_folders(dynamodb, stage: str) -> None:
    table_name = f"GardenClubFolders-{stage}"
    table = dynamodb.Table(table_name)

    print(f"Seeding {len(SAMPLE_FOLDERS)} folders into {table_name}...")
    for folder in SAMPLE_FOLDERS:
        table.put_item(Item=folder)
        print(f"  + {folder['folderName']} ({folder['imageCount']} images)")

    print(f"Done seeding folders into {table_name}.")


def seed_bulk(dynamodb, stage: str, folder: str, count: int) -> None:
    """Seed `count` small READY images into a single folder (plus its folder
    metadata item) to push the folder past DynamoDB's 1 MB page limit and
    exercise the pagination in GET /images and GET /images/folders."""
    images_table = dynamodb.Table(f"GardenClubImages-{stage}")
    folders_table = dynamodb.Table(f"GardenClubFolders-{stage}")
    now = datetime.now(timezone.utc).isoformat()

    print(f"Bulk-seeding {count} images into folder '{folder}'...")
    thumbnail_key = None
    with images_table.batch_writer() as batch:
        for i in range(count):
            image_id = str(uuid.uuid4())
            s3_key = f"{folder}/{image_id}/photo-{i}.jpg"
            if i == 0:
                thumbnail_key = s3_key
            batch.put_item(
                Item={
                    "imageId": image_id,
                    "folderName": folder,
                    "fileName": f"photo-{i}.jpg",
                    "s3Key": s3_key,
                    "isThumbnail": i == 0,
                    "uploadedAt": now,
                    "uploadedBy": "seed-script",
                    "status": "READY",
                }
            )

    folders_table.put_item(
        Item={"folderName": folder, "imageCount": count, "thumbnailKey": thumbnail_key}
    )
    print(f"Done bulk-seeding folder '{folder}' ({count} images).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed garden-club DynamoDB tables.")
    parser.add_argument(
        "--stage",
        default="dev",
        choices=["local", "dev", "prod"],
        help="Target stage (default: dev). Use 'local' for LocalStack.",
    )
    parser.add_argument(
        "--bulk",
        type=int,
        default=0,
        help="Also seed this many images into a single folder (pagination test).",
    )
    parser.add_argument(
        "--bulk-folder",
        default="perf-test",
        help="Folder name used by --bulk (default: perf-test).",
    )
    args = parser.parse_args()

    if args.stage == "prod":
        confirm = input("You are seeding PROD tables. Type 'yes' to continue: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            return

    dynamodb = get_dynamodb(args.stage)
    seed_events(dynamodb, args.stage)
    seed_images(dynamodb, args.stage)
    seed_folders(dynamodb, args.stage)
    if args.bulk > 0:
        seed_bulk(dynamodb, args.stage, args.bulk_folder, args.bulk)
    print("\nAll done!")


if __name__ == "__main__":
    main()
