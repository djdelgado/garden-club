"""Club directory (functions/directory): authz, CRUD, import merge rules, linking.

The DynamoDB tables are replaced with a tiny in-memory fake so the import's
matching/merge logic runs for real rather than against MagicMock return values.
"""

import json
from typing import Any, Dict, List, Optional

import pytest

from conftest import api_event


class FakeTable:
    """Just enough of a boto3 Table for the directory handler."""

    def __init__(self, items: Optional[List[Dict[str, Any]]] = None, key: str = "entryId"):
        self.key = key
        self.items: Dict[str, Dict[str, Any]] = {i[key]: dict(i) for i in (items or [])}
        self.batch_puts = 0

    def scan(self, **_kwargs):
        return {"Items": [dict(i) for i in self.items.values()]}

    def query(self, IndexName, KeyConditionExpression, ExpressionAttributeValues):
        value = ExpressionAttributeValues[":e"]
        return {"Items": [dict(i) for i in self.items.values() if i.get("emailLower") == value]}

    def get_item(self, Key):
        item = self.items.get(Key[self.key])
        return {"Item": dict(item)} if item else {}

    def put_item(self, Item):
        assert Item.get("emailLower", "x") != "", "empty emailLower would break the GSI"
        self.items[Item[self.key]] = dict(Item)

    def delete_item(self, Key):
        self.items.pop(Key[self.key], None)

    def batch_writer(self):
        table = self

        class _Batch:
            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

            def put_item(self, Item):
                table.batch_puts += 1
                table.put_item(Item)

        return _Batch()


@pytest.fixture
def directory(handlers, monkeypatch):
    mod = handlers["directory"]
    tables = {"directory": FakeTable(), "members": FakeTable(key="memberId")}
    monkeypatch.setattr(mod, "directory_table", tables["directory"])
    monkeypatch.setattr(mod, "members_table", tables["members"])
    monkeypatch.setattr(mod, "presigned_get", lambda key: f"https://signed/{key}")
    return mod, tables


def call(mod, method, path, body=None, admin=True, entry_id=None):
    event = api_event(method, path, groups="[Admins]" if admin else "[Members]", body=body)
    if entry_id:
        event["pathParameters"] = {"entryId": entry_id}
    response = mod.lambda_handler(event, None)
    return response["statusCode"], json.loads(response["body"] or "{}")


def entry(entry_id, name, email=None, **extra):
    item = {"entryId": entry_id, "name": name, "nameLower": name.lower(),
            "createdAt": "t0", "updatedAt": "t0", **extra}
    if email:
        item.update(email=email, emailLower=email.lower())
    return item


# ── Authorization ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("method,path,entry_id", [
    ("POST", "/directory", None),
    ("POST", "/directory/import", None),
    ("PUT", "/directory/e1", "e1"),
    ("DELETE", "/directory/e1", "e1"),
])
def test_mutations_require_admin(directory, method, path, entry_id):
    mod, tables = directory
    tables["directory"].items["e1"] = entry("e1", "Ann")
    status, body = call(mod, method, path, {"name": "X", "rows": []}, admin=False, entry_id=entry_id)
    assert status == 403 and body["error"] == "Admin access required"
    assert "e1" in tables["directory"].items  # nothing deleted


def test_list_is_open_to_members(directory):
    mod, tables = directory
    tables["directory"].items["e1"] = entry("e1", "Ann")
    status, body = call(mod, "GET", "/directory", admin=False)
    assert status == 200 and [e["name"] for e in body] == ["Ann"]


# ── CRUD ────────────────────────────────────────────────────────────────────

def test_create_requires_name_and_valid_email(directory):
    mod, _ = directory
    assert call(mod, "POST", "/directory", {"name": "  "})[0] == 400
    assert call(mod, "POST", "/directory", {"name": "Ann", "email": "nope"})[0] == 400
    assert call(mod, "POST", "/directory", {"name": "Ann", "role": "ADMIN"})[0] == 400  # extra field


def test_create_without_email_omits_gsi_attribute(directory):
    mod, tables = directory
    status, body = call(mod, "POST", "/directory", {"name": "Ann", "email": "", "phone": "555"})
    assert status == 201
    stored = tables["directory"].items[body["entryId"]]
    assert "email" not in stored and "emailLower" not in stored and stored["phone"] == "555"


def test_create_rejects_duplicate_email(directory):
    mod, tables = directory
    tables["directory"].items["e1"] = entry("e1", "Ann", "ann@x.org")
    status, _ = call(mod, "POST", "/directory", {"name": "Other", "email": "ANN@x.org"})
    assert status == 409


def test_update_blank_clears_field(directory):
    mod, tables = directory
    tables["directory"].items["e1"] = entry("e1", "Ann", "ann@x.org", phone="555")
    status, body = call(mod, "PUT", "/directory/e1", {"phone": "", "email": ""}, entry_id="e1")
    assert status == 200
    stored = tables["directory"].items["e1"]
    assert "phone" not in stored and "emailLower" not in stored


def test_update_missing_entry_is_404(directory):
    mod, _ = directory
    assert call(mod, "PUT", "/directory/nope", {"name": "X"}, entry_id="nope")[0] == 404


def test_delete(directory):
    mod, tables = directory
    tables["directory"].items["e1"] = entry("e1", "Ann")
    assert call(mod, "DELETE", "/directory/e1", entry_id="e1")[0] == 204
    assert tables["directory"].items == {}


# ── Import ──────────────────────────────────────────────────────────────────

def test_import_merge_rules(directory):
    mod, tables = directory
    tables["directory"].items.update({
        "e1": entry("e1", "Ann Old", "ann@x.org", phone="111", address="1 Elm"),
        "e2": entry("e2", "Bob NoMail", phone="222"),
    })
    rows = [
        # email match: spreadsheet wins, blank address keeps "1 Elm"
        {"name": "Ann New", "email": "ANN@x.org", "phone": "999", "address": ""},
        # no-email row matches the no-email entry by name
        {"name": "bob nomail", "address": "2 Oak"},
        # brand new
        {"name": "Cy", "email": "cy@x.org"},
        # bad rows are reported, not fatal
        {"name": "Dee", "email": "not-an-email"},
        {"email": "ghost@x.org"},
    ]
    status, body = call(mod, "POST", "/directory/import", {"rows": rows})
    assert status == 200
    assert body["created"] == 1 and body["updated"] == 2
    assert [s["row"] for s in body["skipped"]] == [4, 5]

    ann = tables["directory"].items["e1"]
    assert (ann["name"], ann["phone"], ann["address"]) == ("Ann New", "999", "1 Elm")
    bob = tables["directory"].items["e2"]
    assert (bob["phone"], bob["address"]) == ("222", "2 Oak")
    assert len(tables["directory"].items) == 3


def test_reimport_is_idempotent(directory):
    mod, tables = directory
    rows = [{"name": "Ann", "email": "ann@x.org"}, {"name": "Bob"}]
    call(mod, "POST", "/directory/import", {"rows": rows})
    tables["directory"].batch_puts = 0
    status, body = call(mod, "POST", "/directory/import", {"rows": rows})
    assert (status, body["created"], body["updated"]) == (200, 0, 0)
    assert len(tables["directory"].items) == 2 and tables["directory"].batch_puts == 0


def test_import_adds_email_to_no_email_entry_by_name(directory):
    mod, tables = directory
    tables["directory"].items["e1"] = entry("e1", "Ann")
    _, body = call(mod, "POST", "/directory/import", {"rows": [{"name": "Ann", "email": "ann@x.org"}]})
    assert body["updated"] == 1 and len(tables["directory"].items) == 1
    assert tables["directory"].items["e1"]["emailLower"] == "ann@x.org"


def test_duplicate_rows_in_one_file_collapse(directory):
    mod, tables = directory
    rows = [{"name": "Ann", "email": "ann@x.org"}, {"name": "Ann", "email": "ann@x.org", "phone": "5"}]
    _, body = call(mod, "POST", "/directory/import", {"rows": rows})
    assert body["created"] == 1 and len(tables["directory"].items) == 1
    assert next(iter(tables["directory"].items.values()))["phone"] == "5"


def test_import_row_limit(directory):
    mod, _ = directory
    rows = [{"name": f"P{i}"} for i in range(mod.MAX_IMPORT_ROWS + 1)]
    assert call(mod, "POST", "/directory/import", {"rows": rows})[0] == 400


# ── Linking ─────────────────────────────────────────────────────────────────

def test_list_links_members_by_email(directory):
    mod, tables = directory
    tables["directory"].items.update({
        "e1": entry("e1", "Ann", "Ann@X.org"),
        "e2": entry("e2", "Bob", "bob@x.org"),
        "e3": entry("e3", "Cy"),
    })
    tables["members"].items.update({
        "m1": {"memberId": "m1", "emailLower": "ann@x.org", "status": "ACTIVE", "photoKey": "members/m1/a.jpg"},
        "m2": {"memberId": "m2", "emailLower": "zed@x.org", "status": "INVITED"},
    })
    _, body = call(mod, "GET", "/directory", admin=False)
    by_name = {e["name"]: e for e in body}
    assert by_name["Ann"]["linkedMember"] == {
        "memberId": "m1", "status": "ACTIVE", "photoUrl": "https://signed/members/m1/a.jpg"}
    assert "linkedMember" not in by_name["Bob"] and "linkedMember" not in by_name["Cy"]
    assert "emailLower" not in by_name["Ann"] and "nameLower" not in by_name["Ann"]
