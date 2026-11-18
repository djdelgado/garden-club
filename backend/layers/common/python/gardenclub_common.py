"""Shared helpers for the Garden Club Lambda handlers.

Every handler used to carry its own copy of this boilerplate, and the copies had
drifted (see issue #52): a redundant ``Access-Control-Allow-Origin`` header in
some but not others, four near-identical ``get_claims``/``is_admin`` definitions,
and the boto3/LocalStack client bootstrap repeated verbatim. This module is the
single source of truth; it ships as the ``CommonLayer`` Lambda layer
(``backend/layers/common``) and is mounted at ``/opt/python`` so each function
imports it as ``from gardenclub_common import ...``.

The layer bundles no third-party dependencies of its own — ``boto3`` is provided
by the Lambda runtime and ``aws-lambda-powertools`` by each function's package —
so this file only imports things already on the path at runtime.
"""

import json
import os
from typing import Any, Dict, List

from aws_lambda_powertools import Logger
from botocore.config import Config

# child=True reuses the invoking function's Logger configuration (service name,
# log level) instead of standing up a second, independently-configured logger.
logger = Logger(child=True)

# Disable flexible checksums / payload signing for LocalStack compatibility
# (LocalStack does not support them). Shared by the handlers that presign or
# write S3 objects (upload, members, directory); harmless in AWS.
S3_LOCALSTACK_CONFIG = Config(s3={"payload_signing_enabled": False})


def aws_kwargs() -> Dict[str, Any]:
    """boto3 client/resource kwargs: the AWS region, plus the LocalStack endpoint
    when running locally.

    In AWS, ``LOCALSTACK_ENDPOINT`` is unset and boto3 uses the managed
    credentials/endpoints; under LocalStack it points every client at the
    emulator.
    """
    kwargs: Dict[str, Any] = {"region_name": os.environ.get("AWS_REGION", "us-east-1")}
    if localstack_endpoint := os.environ.get("LOCALSTACK_ENDPOINT"):
        kwargs["endpoint_url"] = localstack_endpoint
    return kwargs


def format_response(status_code: int, body: Any) -> Dict[str, Any]:
    """Build an API Gateway HTTP API response.

    Deliberately emits **no** ``Access-Control-Allow-Origin`` header: CORS is
    owned by API Gateway's ``CorsConfiguration`` (an explicit origin allowlist in
    ``template.yaml``). Some handlers used to add ``Access-Control-Allow-Origin:
    "*"`` here, which both duplicated and contradicted that allowlist. Keeping
    CORS in one place (the gateway) resolves issue #52's divergence.
    """
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
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


def query_all(table, **kwargs) -> list:
    """Run a DynamoDB query, following LastEvaluatedKey until the full result
    set is read. DynamoDB caps each page at 1 MB, so a single query() silently
    truncates once a partition exceeds that."""
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
