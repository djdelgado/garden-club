import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import boto3
from aws_lambda_powertools import Logger
from botocore.exceptions import ClientError
from pydantic import BaseModel, ValidationError

from db_types import MemberItem

logger = Logger()

# Use LocalStack endpoint in local dev, AWS managed credentials in production
aws_kwargs = {"region_name": os.environ.get("AWS_REGION", "us-east-1")}
if localstack_endpoint := os.environ.get("LOCALSTACK_ENDPOINT"):
    aws_kwargs["endpoint_url"] = localstack_endpoint

dynamodb = boto3.resource("dynamodb", **aws_kwargs)
cognito = boto3.client("cognito-idp", **aws_kwargs)

members_table = dynamodb.Table(os.environ.get("MEMBERS_TABLE_NAME", "GardenClubMembers"))
user_pool_id = os.environ.get("USER_POOL_ID", "")


class CreateMember(BaseModel):
    email: str
    name: str


class UpdateMember(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None


def format_response(status_code: int, body: Any) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, default=str),
    }


def is_admin(event: Dict[str, Any]) -> bool:
    """Check whether the caller belongs to the Cognito Admins group."""
    claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
    groups = claims.get("cognito:groups", "")
    if isinstance(groups, list):
        return "Admins" in groups
    return "Admins" in [g.strip() for g in str(groups).split(",")]


def find_member_by_email(email: str) -> Optional[MemberItem]:
    """Return the member row matching an email, if any."""
    response = members_table.scan(
        FilterExpression="email = :email",
        ExpressionAttributeValues={":email": email},
    )
    items = response.get("Items", [])
    return items[0] if items else None


def get_members() -> Dict[str, Any]:
    """GET /members - List all members (authenticated users only)"""
    try:
        response = members_table.scan()
        items = response.get("Items", [])
        items.sort(key=lambda x: x.get("name", ""))
        return format_response(200, items)
    except Exception as err:
        logger.exception("Error listing members")
        return format_response(500, {"error": str(err)})


def create_member(body: str) -> Dict[str, Any]:
    """POST /members - Create a member row and provision a Cognito account"""
    try:
        data = CreateMember(**json.loads(body))
    except ValidationError as err:
        logger.exception("Validation error")
        return format_response(400, {"error": "Invalid member data", "details": err.errors()})

    email = data.email

    if find_member_by_email(email):
        return format_response(409, {"error": "A member with this email already exists"})

    # Provision the Cognito account first; DynamoDB owns display info, Cognito owns credentials.
    try:
        cognito.admin_create_user(
            UserPoolId=user_pool_id,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
            ],
            DesiredDeliveryMediums=["EMAIL"],
        )
    except ClientError as err:
        code = err.response.get("Error", {}).get("Code", "")
        if code == "UsernameExistsException":
            return format_response(409, {"error": "A Cognito user with this email already exists"})
        logger.exception("Error creating Cognito user")
        return format_response(500, {"error": str(err)})

    now = datetime.now(timezone.utc).isoformat()
    item: MemberItem = {
        "memberId": str(uuid.uuid4()),
        "email": email,
        "name": data.name,
        "createdAt": now,
    }

    try:
        members_table.put_item(Item=item)
    except Exception as err:
        # Table write failed after the Cognito user was created — best-effort rollback.
        logger.exception("Error writing member row; rolling back Cognito user")
        try:
            cognito.admin_delete_user(UserPoolId=user_pool_id, Username=email)
        except ClientError:
            logger.exception("Failed to roll back Cognito user for %s", email)
        return format_response(500, {"error": str(err)})

    return format_response(201, item)


def update_member(member_id: str, body: str) -> Dict[str, Any]:
    """PUT /members/{memberId} - Update a member's name/email in the table"""
    try:
        data = UpdateMember(**json.loads(body))
    except ValidationError as err:
        logger.exception("Validation error")
        return format_response(400, {"error": "Invalid member data", "details": err.errors()})

    try:
        response = members_table.get_item(Key={"memberId": member_id})
        if "Item" not in response:
            return format_response(404, {"error": "Member not found"})

        item: MemberItem = response["Item"]

        if data.email is not None:
            new_email = data.email
            existing = find_member_by_email(new_email)
            if existing and existing.get("memberId") != member_id:
                return format_response(409, {"error": "A member with this email already exists"})
            item["email"] = new_email
        if data.name is not None:
            item["name"] = data.name

        members_table.put_item(Item=item)
        return format_response(200, item)
    except Exception as err:
        logger.exception(f"Error updating member {member_id}")
        return format_response(500, {"error": str(err)})


def delete_member(member_id: str) -> Dict[str, Any]:
    """DELETE /members/{memberId} - Remove the member row and Cognito account"""
    try:
        response = members_table.get_item(Key={"memberId": member_id})
        if "Item" not in response:
            return format_response(404, {"error": "Member not found"})

        item: MemberItem = response["Item"]
        email = item.get("email")

        if email:
            try:
                cognito.admin_delete_user(UserPoolId=user_pool_id, Username=email)
            except ClientError as err:
                code = err.response.get("Error", {}).get("Code", "")
                if code != "UserNotFoundException":
                    logger.exception("Error deleting Cognito user")
                    return format_response(500, {"error": str(err)})

        members_table.delete_item(Key={"memberId": member_id})
        return format_response(204, {})
    except Exception as err:
        logger.exception(f"Error deleting member {member_id}")
        return format_response(500, {"error": str(err)})


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for members"""
    logger.info(f"Received request: {event}")

    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    path = event.get("rawPath", "")
    body = event.get("body", "") or "{}"

    try:
        if method == "GET":
            return get_members()

        # All mutations are Admins only.
        if method in ("POST", "PUT", "DELETE") and not is_admin(event):
            return format_response(403, {"error": "Admin access required"})

        if method == "POST":
            return create_member(body)

        elif method == "PUT":
            member_id = path.split("/")[-1]
            return update_member(member_id, body)

        elif method == "DELETE":
            member_id = path.split("/")[-1]
            return delete_member(member_id)

        else:
            return format_response(405, {"error": "Method not allowed"})

    except Exception as err:
        logger.exception("Unhandled error in lambda_handler")
        return format_response(500, {"error": str(err)})
