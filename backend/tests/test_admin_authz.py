"""Server-side admin authorization (issue #91).

The API Gateway ``DefaultAuthorizer`` only proves *authentication* — any member
of the user pool presents a valid ID token. Group membership is therefore the
handlers' job, and before #91 the ``events``, ``images`` and ``upload`` handlers
did not check it at all, so any signed-in member could create or delete events,
delete photos and albums, and mint S3 upload URLs.

These tests pin that down from both sides: the admin-only routes must reject a
non-admin, and the member-facing routes must keep working for one.
"""

import json

import pytest

from conftest import api_event

# Routes that must be reachable only by members of the Cognito ``Admins`` group.
# (function, method, rawPath, body)
ADMIN_ONLY = [
    ("events", "POST", "/events", {"title": "Spring Planting"}),
    ("events", "PUT", "/events/evt-1", {"title": "Renamed"}),
    ("events", "DELETE", "/events/evt-1", None),
    ("images", "DELETE", "/images/img-1", None),
    ("images", "DELETE", "/images/folders/spring", None),
    ("images", "PUT", "/images/folders/spring", {"newFolderName": "summer"}),
    ("upload", "POST", "/upload/presign", {"folderName": "spring", "files": [{"fileName": "a.jpg"}]}),
    ("upload", "POST", "/upload/complete", {"imageIds": ["img-1"]}),
    # Regression guard: members/ already gated these before #91.
    ("members", "POST", "/members", {"email": "new@example.com", "name": "New"}),
    ("members", "POST", "/members/mem-1/resend-invite", None),
    ("members", "PUT", "/members/mem-1", {"name": "Edited"}),
    ("members", "DELETE", "/members/mem-1", None),
]

# Routes that must stay open to any authenticated member. Over-gating these
# would be just as much a bug as the under-gating #91 fixed.
MEMBER_ALLOWED = [
    ("events", "GET", "/events", None),
    ("events", "GET", "/events/evt-1", None),
    ("events", "POST", "/events/evt-1/rsvp", None),
    ("events", "DELETE", "/events/evt-1/rsvp", None),
    ("images", "GET", "/images", None),
    ("images", "GET", "/images/folders", None),
    ("members", "GET", "/members", None),
    ("members", "GET", "/members/me", None),
    ("members", "PUT", "/members/me", {"phone": "555-0100"}),
    ("members", "POST", "/members/me/photo", {"contentType": "image/jpeg"}),
]

ADMIN_IDS = [f"{fn}-{m}-{p}" for fn, m, p, _ in ADMIN_ONLY]
MEMBER_IDS = [f"{fn}-{m}-{p}" for fn, m, p, _ in MEMBER_ALLOWED]


@pytest.mark.parametrize("fn,method,path,body", ADMIN_ONLY, ids=ADMIN_IDS)
def test_non_admin_is_forbidden(handlers, fn, method, path, body):
    """A signed-in member whose groups do not include Admins gets a 403."""
    response = handlers[fn].lambda_handler(
        api_event(method, path, groups="[Members]", body=body), None
    )
    assert response["statusCode"] == 403, (
        f"{method} {path} let a non-admin through with {response['statusCode']}"
    )


@pytest.mark.parametrize("fn,method,path,body", ADMIN_ONLY, ids=ADMIN_IDS)
def test_missing_groups_claim_is_forbidden(handlers, fn, method, path, body):
    """No ``cognito:groups`` claim at all is treated as "not an admin".

    A user created before the Admins group existed, or one removed from it, has
    the claim omitted entirely rather than set to an empty value.
    """
    response = handlers[fn].lambda_handler(
        api_event(method, path, groups=None, body=body), None
    )
    assert response["statusCode"] == 403


@pytest.mark.parametrize("fn,method,path,body", ADMIN_ONLY, ids=ADMIN_IDS)
def test_admin_passes_the_gate(handlers, fn, method, path, body):
    """An admin is not rejected by the authorization check.

    Asserting "not 403" rather than a success code on purpose: AWS is mocked, so
    what happens past the gate is a mock's behaviour (404s, 400s, 500s) and not
    what this test is about. The point is that the gate itself lets admins by.
    """
    response = handlers[fn].lambda_handler(
        api_event(method, path, groups="[Admins]", body=body), None
    )
    assert response["statusCode"] != 403, f"{method} {path} rejected a real admin"


@pytest.mark.parametrize("fn,method,path,body", MEMBER_ALLOWED, ids=MEMBER_IDS)
def test_member_routes_stay_open(handlers, fn, method, path, body):
    """Reads, RSVP and the ``me``-scoped member routes need no admin rights.

    A 403 by itself isn't a failure here: with empty mocked tables the RSVP path
    legitimately answers 403 "No member record for caller". What must never
    happen is the *admin gate* rejecting a member.
    """
    response = handlers[fn].lambda_handler(
        api_event(method, path, groups="[Members]", body=body), None
    )
    payload = json.loads(response.get("body") or "{}")
    error = payload.get("error", "") if isinstance(payload, dict) else ""
    assert not (
        response["statusCode"] == 403 and "admin" in error.lower()
    ), f"{method} {path} wrongly requires admin"


@pytest.mark.parametrize(
    "groups,expected",
    [
        # What the HTTP API authorizer actually emits: a bracketed string.
        ("[Admins]", True),
        ("[Admins, Editors]", True),
        ("[Editors, Admins]", True),
        ("[Members]", False),
        ("[]", False),
        # Substrings must not match — a naive `"Admins" in claim` would.
        ("[AdminsOnly]", False),
        ("[SuperAdmins]", False),
        # A bare string, and the real list a decoded JWT would carry.
        ("Admins", True),
        (["Admins"], True),
        (["Editors", "Admins"], True),
        (["Editors"], False),
        ([], False),
        ("", False),
    ],
)
@pytest.mark.parametrize("fn", ["events", "images", "upload", "members"])
def test_group_claim_forms(handlers, fn, groups, expected):
    """``parse_groups`` handles every shape the claim arrives in.

    Run against all four handlers because each carries its own copy of the
    helper (see #52) — they must not drift apart.
    """
    assert handlers[fn].is_admin(api_event("POST", "/events", groups=groups)) is expected


class TestLocalDevBypass:
    """``LOCAL_DEV_CLAIMS`` is an auth bypass; it must stay local-only.

    sam local does not emulate the JWT authorizer, so the handlers fall back to
    claims from the environment. That fallback is double-gated on
    LOCALSTACK_ENDPOINT, which a Lambda in AWS never has.
    """

    UNAUTHENTICATED = {
        "requestContext": {"http": {"method": "POST", "path": "/events"}},
        "rawPath": "/events",
        "body": "{}",
    }

    def test_bypass_does_not_fire_without_localstack_endpoint(self, handlers, monkeypatch):
        """Admin claims in the environment must be ignored when not on LocalStack."""
        monkeypatch.setenv(
            "LOCAL_DEV_CLAIMS", '{"sub": "x", "cognito:groups": "[Admins]"}'
        )
        monkeypatch.delenv("LOCALSTACK_ENDPOINT", raising=False)
        response = handlers["events"].lambda_handler(dict(self.UNAUTHENTICATED), None)
        assert response["statusCode"] == 403

    def test_bypass_fires_on_localstack(self, handlers, monkeypatch):
        """With both gates set, local dev still works (otherwise sam local 403s)."""
        monkeypatch.setenv(
            "LOCAL_DEV_CLAIMS", '{"sub": "x", "cognito:groups": "[Admins]"}'
        )
        monkeypatch.setenv("LOCALSTACK_ENDPOINT", "http://localstack:4566")
        response = handlers["events"].lambda_handler(dict(self.UNAUTHENTICATED), None)
        assert response["statusCode"] != 403

    def test_no_claims_and_no_bypass_is_forbidden(self, handlers, monkeypatch):
        """An unauthenticated request with nothing configured is rejected."""
        monkeypatch.delenv("LOCAL_DEV_CLAIMS", raising=False)
        monkeypatch.delenv("LOCALSTACK_ENDPOINT", raising=False)
        response = handlers["events"].lambda_handler(dict(self.UNAUTHENTICATED), None)
        assert response["statusCode"] == 403
