"""Shared fixtures for the backend test suite.

The four Lambdas live in sibling directories under ``backend/functions/`` and
every one of them has a module literally named ``handler`` (plus its own copy of
``db_types``). Importing more than one in a single interpreter therefore needs
explicit, path-based loading under distinct module names — a plain
``import handler`` would bind whichever directory happened to be first on
``sys.path`` and then hand the *same* module back for every later import.

Each handler also builds its boto3 clients at import time, so ``boto3`` is
patched before any handler is loaded. These tests assert on authorization
decisions, which are made before any AWS call, so MagicMock clients are
sufficient and no moto server is needed.
"""

import importlib.util
import json
import os
import pathlib
import sys
from typing import Any, Dict, Optional
from unittest import mock

import pytest

FUNCTIONS = pathlib.Path(__file__).resolve().parent.parent / "functions"


@pytest.fixture(scope="session", autouse=True)
def aws_env():
    """Look like a Lambda running in AWS, not against LocalStack.

    LOCALSTACK_ENDPOINT and LOCAL_DEV_CLAIMS are cleared deliberately: together
    they gate the local-dev auth bypass, and a test run that left them set would
    silently pass through it instead of exercising the real claims path.
    """
    saved = dict(os.environ)
    os.environ.update(
        AWS_REGION="us-east-1",
        AWS_DEFAULT_REGION="us-east-1",
        AWS_ACCESS_KEY_ID="testing",
        AWS_SECRET_ACCESS_KEY="testing",
        AWS_SESSION_TOKEN="testing",
        AWS_EC2_METADATA_DISABLED="true",
    )
    os.environ.pop("LOCALSTACK_ENDPOINT", None)
    os.environ.pop("LOCAL_DEV_CLAIMS", None)
    yield
    os.environ.clear()
    os.environ.update(saved)


def load_handler(name: str):
    """Import ``backend/functions/<name>/handler.py`` under a unique module name.

    boto3 is patched for the duration of the import so the module-level
    ``boto3.resource`` / ``boto3.client`` calls never touch the network.
    """
    directory = FUNCTIONS / name
    module_name = f"{name}_handler"
    sys.path.insert(0, str(directory))
    try:
        # Drop any same-named modules a previously loaded handler left behind.
        for stale in ("handler", "db_types"):
            sys.modules.pop(stale, None)
        with mock.patch("boto3.client"), mock.patch("boto3.resource") as resource:
            # Paginating helpers (query_all / scan_all) loop until
            # LastEvaluatedKey is falsy. A bare MagicMock's .get() is always
            # truthy, so give every table a single, final, empty page.
            table = resource.return_value.Table.return_value
            table.query.return_value = {"Items": []}
            table.scan.return_value = {"Items": []}
            spec = importlib.util.spec_from_file_location(
                module_name, directory / "handler.py"
            )
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
        return module
    finally:
        sys.path.remove(str(directory))


@pytest.fixture(scope="session")
def handlers(aws_env):
    """Every Lambda handler module, keyed by function directory name."""
    return {name: load_handler(name) for name in ("events", "images", "upload", "members", "directory")}


@pytest.fixture(autouse=True)
def no_aws_calls():
    """Keep boto3 mocked for the duration of each test.

    The handlers captured mocked clients at import time, but anything that
    builds a fresh client inside a request (e.g. a CloudFront invalidation on
    image delete) would otherwise reach for real credentials and hang on retry.
    """
    with mock.patch("boto3.client"), mock.patch("boto3.resource"):
        yield


def api_event(
    method: str,
    path: str,
    groups: Optional[Any] = None,
    body: Optional[Dict[str, Any]] = None,
    sub: str = "user-sub-1",
) -> Dict[str, Any]:
    """Build an API Gateway **HTTP API (payload v2)** event.

    Claims live at ``requestContext.authorizer.jwt.claims`` — the ``.jwt``
    segment is the one that was missing in earlier handler code. Pass
    ``groups=None`` to omit ``cognito:groups`` entirely (an authenticated
    non-admin), or a bracketed string such as ``"[Admins]"`` to mimic what the
    HTTP API authorizer actually emits.
    """
    claims: Dict[str, Any] = {"sub": sub, "email": "member@example.com"}
    if groups is not None:
        claims["cognito:groups"] = groups
    return {
        "requestContext": {
            "http": {"method": method, "path": path},
            "authorizer": {"jwt": {"claims": claims}},
        },
        "rawPath": path,
        "body": json.dumps(body or {}),
    }
