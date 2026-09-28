"""Cover ingestion contract boundaries with real SQLite and one live HTTP test."""

import json
import socket
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from threading import Barrier, Thread
from urllib.error import HTTPError
from urllib.request import ProxyHandler, Request, build_opener

import pytest
import uvicorn
from fastapi.testclient import TestClient

from apps.api.main import create_app


@pytest.fixture
def database_path(tmp_path):
    return tmp_path / "data" / "events.sqlite3"


@pytest.fixture
def app(database_path, monkeypatch):
    # Every normal request test also verifies the documented environment setting.
    monkeypatch.setenv("SIGNALTRACE_DB_PATH", str(database_path))
    return create_app()


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def live_url(app):
    # Reserve an ephemeral port before starting Uvicorn; never depend on port 8000.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
        thread = Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 10
            while not server.started:
                if not thread.is_alive() or time.monotonic() >= deadline:
                    pytest.fail("HTTP server did not start")
                time.sleep(0.01)
            yield f"http://127.0.0.1:{listener.getsockname()[1]}"
        finally:
            server.should_exit = True
            thread.join(timeout=10)
            assert not thread.is_alive(), "HTTP server did not stop"


@pytest.fixture
def event():
    return {
        "event_id": "evt-001",
        "event": "product_viewed",
        "session_id": "session-001",
        "timestamp": "2026-09-28T12:34:56Z",
        "product_id": "nova-mug",
    }


def stored_events(database_path):
    # Read through an independent connection, not an API helper or mocked store.
    with closing(sqlite3.connect(database_path)) as connection:
        connection.row_factory = sqlite3.Row
        return [dict(row) for row in connection.execute("SELECT * FROM events ORDER BY event_id")]


@pytest.mark.parametrize(
    "event_name,timestamp,stored_timestamp,identifier",
    [
        pytest.param(
            "product_viewed", "2026-09-28T12:34:56Z", "2026-09-28T12:34:56+00:00", "a",
            id="viewed-utc-minimum-identifier",
        ),
        pytest.param(
            "product_added_to_cart", "2026-09-28T06:34:56.123456-06:00",
            "2026-09-28T12:34:56.123456+00:00", "a" * 128,
            id="cart-offset-maximum-identifier",
        ),
    ],
)
def test_accepts_and_persists_event(
    client, database_path, event, event_name, timestamp, stored_timestamp, identifier
):
    event.update(
        event=event_name, timestamp=timestamp,
        event_id=identifier, session_id=identifier, product_id=identifier,
    )

    response = client.post("/events", json=event)

    assert response.status_code == 201
    assert response.json() == {"event_id": identifier, "status": "accepted"}
    assert stored_events(database_path) == [{**event, "timestamp": stored_timestamp}]


# These are explicit public fields, not derived from the implementation's schema.
REQUIRED_FIELDS = ("event_id", "event", "session_id", "timestamp", "product_id")
IDENTIFIER_FIELDS = ("event_id", "session_id", "product_id")


@pytest.mark.parametrize(
    "changes,error_fields",
    [
        pytest.param(None, REQUIRED_FIELDS, id="missing-required-fields"),
        pytest.param(dict.fromkeys(REQUIRED_FIELDS), REQUIRED_FIELDS, id="null-fields"),
        pytest.param(dict.fromkeys(IDENTIFIER_FIELDS, 123), IDENTIFIER_FIELDS, id="identifier-type"),
        pytest.param(dict.fromkeys(IDENTIFIER_FIELDS, ""), IDENTIFIER_FIELDS, id="identifier-empty"),
        pytest.param(dict.fromkeys(IDENTIFIER_FIELDS, "has space"), IDENTIFIER_FIELDS, id="identifier-whitespace"),
        pytest.param(dict.fromkeys(IDENTIFIER_FIELDS, "x" * 129), IDENTIFIER_FIELDS, id="identifier-too-long"),
        pytest.param({"event": "checkout_completed"}, ("event",), id="unsupported-event"),
        pytest.param({"event": "PRODUCT_VIEWED"}, ("event",), id="event-case-sensitive"),
        pytest.param({"event": 42}, ("event",), id="event-type"),
        pytest.param({"timestamp": "2026-02-30T12:34:56Z"}, ("timestamp",), id="invalid-calendar-date"),
        pytest.param({"timestamp": "2026-09-28T12:34:56"}, ("timestamp",), id="timezone-required"),
        pytest.param({"timestamp": "2026-09-28T12:34:56+25:00"}, ("timestamp",), id="invalid-timezone"),
        pytest.param({"timestamp": "1790598896"}, ("timestamp",), id="numeric-timestamp-string"),
        pytest.param({"timestamp": 1790598896}, ("timestamp",), id="numeric-timestamp"),
        pytest.param({"timestamp": "2026-09-28T12:34:56.1234567Z"}, ("timestamp",), id="timestamp-precision"),
        pytest.param({"timestamp": "0001-01-01T00:00:00+01:00"}, ("timestamp",), id="utc-overflow"),
        pytest.param({"unrecognized": "value"}, ("unrecognized",), id="unknown-field"),
    ],
)
def test_rejects_invalid_event(client, database_path, event, changes, error_fields):
    payload = {} if changes is None else {**event, **changes}

    response = client.post("/events", json=payload)

    assert response.status_code == 422
    assert {tuple(error["loc"]) for error in response.json()["detail"]} == {
        ("body", field) for field in error_fields
    }
    assert stored_events(database_path) == []


@pytest.mark.parametrize(
    "body", ['{"event_id":', "[]", ""], ids=["invalid-json", "non-object", "missing-body"]
)
def test_rejects_malformed_body(client, database_path, body):
    response = client.post("/events", content=body, headers={"Content-Type": "application/json"})

    assert response.status_code == 422
    assert response.json()["detail"]
    assert stored_events(database_path) == []


@pytest.mark.parametrize(
    "changes",
    [{}, {"product_id": "different-product"}, {"session_id": "another-session"}],
    ids=["identical", "different-content", "different-session"],
)
def test_duplicate_id_preserves_original_after_restart(database_path, event, changes):
    with TestClient(create_app(database_path)) as first_client:
        assert first_client.post("/events", json=event).status_code == 201
    expected_rows = [{**event, "timestamp": "2026-09-28T12:34:56+00:00"}]
    assert stored_events(database_path) == expected_rows

    with TestClient(create_app(database_path)) as restarted_client:
        response = restarted_client.post("/events", json={**event, **changes})

    assert response.status_code == 409
    assert response.json() == {
        "detail": {
            "code": "duplicate_event_id",
            "message": "An event with this event_id already exists.",
            "event_id": "evt-001",
        }
    }
    assert stored_events(database_path) == expected_rows


def test_concurrent_duplicates_store_exactly_one_event(client, database_path, event):
    ready = Barrier(2)

    def submit():
        ready.wait(timeout=5)
        return client.post("/events", json=event).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = [executor.submit(submit) for _ in range(2)]
        assert sorted(response.result(timeout=10) for response in responses) == [201, 409]
    assert stored_events(database_path) == [{**event, "timestamp": "2026-09-28T12:34:56+00:00"}]

    # A conflict must not poison the next write or prevent another event in this session.
    # IDs differing only by case are distinct under the public contract.
    second = {**event, "event_id": "EVT-001", "event": "product_added_to_cart"}
    assert client.post("/events", json=second).status_code == 201
    assert stored_events(database_path) == [
        {**second, "timestamp": "2026-09-28T12:34:56+00:00"},
        {**event, "timestamp": "2026-09-28T12:34:56+00:00"},
    ]


def test_storage_failure_does_not_report_acceptance(client, database_path, event):
    # Make this test's database path unavailable after startup, using real filesystem state.
    database_path.unlink()
    database_path.mkdir()

    response = client.post("/events", json=event)

    assert response.status_code == 503
    assert response.json() == {
        "detail": {"code": "storage_unavailable", "message": "Event storage is unavailable."}
    }


def test_real_http_acceptance_and_duplicate(live_url, database_path, event):
    # Use a real socket and bypass environment proxies; no TestClient transport here.
    http = build_opener(ProxyHandler({}))
    request = Request(
        f"{live_url}/events",
        data=json.dumps(event).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with http.open(request, timeout=5) as response:
        assert response.status == 201
        assert response.headers.get_content_type() == "application/json"
        assert json.load(response) == {"event_id": event["event_id"], "status": "accepted"}

    with pytest.raises(HTTPError) as duplicate:
        http.open(request, timeout=5)
    with duplicate.value as response:
        assert response.code == 409
        assert json.load(response)["detail"]["code"] == "duplicate_event_id"
    assert stored_events(database_path) == [{**event, "timestamp": "2026-09-28T12:34:56+00:00"}]
