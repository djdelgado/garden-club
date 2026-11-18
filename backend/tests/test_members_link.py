"""POST /members create-or-link (#96): an email that already has a Cognito login
(e.g. the bootstrap admin) is linked instead of 409'd."""

import json

import pytest
from botocore.exceptions import ClientError

from conftest import api_event

EXISTS = ClientError({"Error": {"Code": "UsernameExistsException"}}, "AdminCreateUser")


@pytest.fixture
def members(handlers, monkeypatch):
    mod = handlers["members"]
    monkeypatch.setattr(mod, "user_pool_id", "pool-1")
    monkeypatch.setattr(mod, "find_member_by_email", lambda email: None)
    mod.cognito.reset_mock()
    mod.members_table.reset_mock()
    mod.cognito.admin_create_user.side_effect = None
    mod.members_table.put_item.side_effect = None
    mod.cognito.admin_create_user.return_value = {
        "User": {"Username": "new", "Attributes": [{"Name": "sub", "Value": "sub-new"}]}}
    mod.cognito.admin_get_user.return_value = {
        "Username": "boot", "UserStatus": "CONFIRMED",
        "UserAttributes": [{"Name": "sub", "Value": "sub-boot"}]}
    mod.cognito.admin_list_groups_for_user.return_value = {"Groups": [{"GroupName": "Admins"}]}
    yield mod
    # The handler module (and its mocks) is session-scoped; don't leak
    # side effects such as a failing put_item into later tests.
    mod.cognito.reset_mock(return_value=True, side_effect=True)
    mod.members_table.reset_mock(return_value=True, side_effect=True)


def create(mod):
    event = api_event("POST", "/members", groups="[Admins]", body={"name": "Dee", "email": "dee@x.org"})
    response = mod.lambda_handler(event, None)
    return response["statusCode"], json.loads(response["body"])


def test_new_email_is_invited(members):
    status, body = create(members)
    assert status == 201 and body["status"] == "INVITED" and body["linkedExistingAccount"] is False
    assert "lastInviteSentAt" in body


def test_existing_admin_login_is_linked(members):
    members.cognito.admin_create_user.side_effect = EXISTS
    status, body = create(members)
    assert status == 201 and body["linkedExistingAccount"] is True
    assert (body["cognitoSub"], body["status"], body["role"]) == ("sub-boot", "ACTIVE", "ADMIN")
    assert "lastInviteSentAt" not in body


def test_never_signed_in_login_links_as_invited(members):
    members.cognito.admin_create_user.side_effect = EXISTS
    members.cognito.admin_get_user.return_value["UserStatus"] = "FORCE_CHANGE_PASSWORD"
    members.cognito.admin_list_groups_for_user.return_value = {"Groups": []}
    _, body = create(members)
    assert (body["status"], body["role"]) == ("INVITED", "MEMBER")


def test_existing_member_row_still_conflicts(members, monkeypatch):
    monkeypatch.setattr(members, "find_member_by_email", lambda email: {"memberId": "m1"})
    assert create(members)[0] == 409


def test_write_failure_never_deletes_a_linked_login(members):
    members.cognito.admin_create_user.side_effect = EXISTS
    members.members_table.put_item.side_effect = Exception("ddb down")
    assert create(members)[0] == 500
    members.cognito.admin_delete_user.assert_not_called()


def test_write_failure_rolls_back_a_new_login(members):
    members.members_table.put_item.side_effect = Exception("ddb down")
    assert create(members)[0] == 500
    members.cognito.admin_delete_user.assert_called_once()
