#!/usr/bin/env python3
"""Seed DynamoDB tables with sample data for local/dev testing.

Usage:
    python seed.py              # seeds dev tables (default)
    python seed.py --stage dev
    python seed.py --stage local
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
        "createdBy": "seed-script",
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
    },
    {
        "imageId": imageId2,
        "folderName": "spring-2024",
        "fileName": "raised-beds.jpg",
        "s3Key": f"spring-2024/{imageId2}/raised-beds.jpg",
        "isThumbnail": False,
        "uploadedAt": datetime.now(timezone.utc).isoformat(),
        "uploadedBy": "seed-script",
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed garden-club DynamoDB tables.")
    parser.add_argument(
        "--stage",
        default="dev",
        choices=["local", "dev", "prod"],
        help="Target stage (default: dev). Use 'local' for LocalStack.",
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
    print("\nAll done!")


if __name__ == "__main__":
    main()
