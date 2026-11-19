"""Event banner images: presign validation and the browser-facing banner URL.

The banner upload never worked: the frontend presigned without a contentType,
which made boto3 raise while building the URL (an opaque 500), and the detail
modal then pointed at the private S3 bucket rather than CloudFront.
"""

import json
from unittest import mock

from conftest import api_event


def body_of(response):
    return json.loads(response["body"])


def test_presign_without_content_type_is_a_400(handlers):
    response = handlers["upload"].lambda_handler(
        api_event(
            "POST",
            "/upload/presign",
            groups="[Admins]",
            body={"folderName": "event-banners", "files": [{"fileName": "banner.jpg"}]},
        ),
        None,
    )
    assert response["statusCode"] == 400
    assert "banner.jpg" in body_of(response)["error"]


def test_presign_signs_the_content_type(handlers):
    upload = handlers["upload"]
    with mock.patch.object(upload, "images_table") as table, mock.patch.object(
        upload, "s3_client"
    ) as s3:
        table.query.return_value = {"Items": []}
        s3.generate_presigned_url.return_value = "https://signed.example/put"
        response = upload.lambda_handler(
            api_event(
                "POST",
                "/upload/presign",
                groups="[Admins]",
                body={
                    "folderName": "event-banners",
                    "files": [{"fileName": "banner.jpg", "contentType": "image/jpeg"}],
                },
            ),
            None,
        )
    assert response["statusCode"] == 200
    params = s3.generate_presigned_url.call_args_list[0].kwargs["Params"]
    assert params["ContentType"] == "image/jpeg"
    assert body_of(response)["uploads"][0]["imageKey"].startswith("event-banners/")


def test_event_with_banner_gets_a_cdn_url(handlers, monkeypatch):
    monkeypatch.setenv("IMAGES_CDN_DOMAIN", "cdn.example.net")
    events = handlers["events"]
    item = {
        "eventId": "evt-1",
        "title": "Spring Planting",
        "headerImageKey": "event-banners/abc/My Banner.jpg",
    }
    shaped = events.with_rsvp_summary(item, None)
    assert shaped["headerImageUrl"] == "https://cdn.example.net/event-banners/abc/My%20Banner.jpg"


def test_event_without_banner_has_no_url(handlers):
    shaped = handlers["events"].with_rsvp_summary({"eventId": "evt-1"}, None)
    assert "headerImageUrl" not in shaped


def test_update_does_not_persist_the_derived_url(handlers):
    events = handlers["events"]
    with mock.patch.object(events, "events_table") as table:
        table.get_item.return_value = {"Item": {"eventId": "evt-1", "title": "Old"}}
        response = events.lambda_handler(
            api_event(
                "PUT",
                "/events/evt-1",
                groups="[Admins]",
                body={"title": "New", "headerImageUrl": "https://stale.example/x.jpg"},
            ),
            None,
        )
    assert response["statusCode"] == 200
    saved = table.put_item.call_args.kwargs["Item"]
    assert "headerImageUrl" not in saved
    assert saved["title"] == "New"
