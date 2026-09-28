"""Focused diagnosis checks; real temporary SQLite, no mocked diagnostic answers."""

from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from apps.api.main import create_app


@pytest.fixture
def evidence():
    attempts = [
        {"payload": {"event_id": f"original-{index}", "event": name,
                     "session_id": "broken", "timestamp": "2026-09-28T12:00:00Z",
                     "product_id": "nova-mug"}, "initialized": False, "delivery_attempted": False}
        for index, name in enumerate(["product_viewed", "product_added_to_cart"])
    ]
    logs = [
        {"timestamp": "2026-09-28T12:00:00Z", "code": code,
         "event_id": attempt["payload"]["event_id"], "detail": "Observed in browser simulation"}
        for attempt in attempts for code in ["customer_action", "delivery_skipped_uninitialized"]
    ]
    return {"analytics_initialized": False, "attempts": attempts, "logs": logs}


@pytest.fixture
def api(tmp_path):
    path = tmp_path / "events.sqlite3"
    with TestClient(create_app(path)) as client:
        yield client, path


def test_tools_read_observations_and_real_storage_without_mutating_them(api, evidence):
    client, _ = api
    base = "/diagnostics/sessions/broken"
    assert client.put(f"{base}/evidence", json=evidence).status_code == 204
    initial = {name: client.get(f"{base}/{name}").json() for name in ["sdk-state", "event-delivery", "runtime-logs"]}
    assert initial["sdk-state"]["initialized"] is False
    assert initial["event-delivery"]["customer_actions"] == 2
    assert initial["event-delivery"]["delivery_attempts"] == 0
    assert initial["event-delivery"]["events_received"] == 0
    assert len(initial["runtime-logs"]["entries"]) == 4

    result = client.get(f"{base}/diagnosis")
    assert result.status_code == 200
    assert result.headers["Cache-Control"] == "no-store"
    assert result.json()["issue"] == "sdk_not_initialized"
    assert result.json()["checks"] == ["get_sdk_state", "get_event_delivery", "get_runtime_logs"]
    assert result.json()["evidence"] == {"analytics_initialized": False, "customer_actions": 2, "delivery_attempts": 0, "events_received": 0}
    assert {name: client.get(f"{base}/{name}").json() for name in initial} == initial
    assert client.get("/sessions/broken/events").json() == []

    # Reporting a user-applied fix changes observed SDK state, not stored events.
    fixed = {**evidence, "analytics_initialized": True}
    assert client.put(f"{base}/evidence", json=fixed).status_code == 204
    assert client.get(f"{base}/sdk-state").json()["initialized"] is True
    assert client.get("/sessions/broken/events").json() == []
    assert client.get(f"{base}/diagnosis").json()["issue"] is None

    # Only new events submitted through the existing ingestion route enter SQLite.
    fresh = deepcopy(evidence["attempts"])
    for attempt in fresh:
        attempt["payload"]["event_id"] += "-fresh"
        attempt.update(initialized=True, delivery_attempted=True)
        assert client.post("/events", json=attempt["payload"]).status_code == 201
    fixed["attempts"] += fresh
    assert client.put(f"{base}/evidence", json=fixed).status_code == 204
    delivery = client.get(f"{base}/event-delivery").json()
    assert delivery["customer_actions"] == 4
    assert delivery["delivery_attempts"] == delivery["events_received"] == 2
    assert set(delivery["stored_event_ids"]) == {"original-0-fresh", "original-1-fresh"}


@pytest.mark.parametrize("contradiction", ["initialized", "delivery-attempted", "missing-logs", "stored-event"])
def test_diagnosis_requires_all_supporting_evidence(api, evidence, contradiction):
    client, _ = api
    if contradiction == "initialized":
        evidence["analytics_initialized"] = True
    elif contradiction == "delivery-attempted":
        evidence["attempts"][0]["delivery_attempted"] = True
    elif contradiction == "missing-logs":
        evidence["logs"] = []
    else:
        assert client.post("/events", json=evidence["attempts"][0]["payload"]).status_code == 201
    assert client.put("/diagnostics/sessions/broken/evidence", json=evidence).status_code == 204
    assert client.get("/diagnostics/sessions/broken/diagnosis").json()["issue"] is None


def test_missing_observation_and_storage_failure_are_not_success(api, evidence):
    client, path = api
    assert client.get("/diagnostics/sessions/unknown/diagnosis").status_code == 404
    assert client.put("/diagnostics/sessions/broken/evidence", json=evidence).status_code == 204
    path.unlink()
    path.mkdir()
    assert client.get("/diagnostics/sessions/broken/diagnosis").status_code == 503
    assert client.get("/diagnostics/sessions/broken/event-delivery").status_code == 503


def test_observations_cannot_mix_sessions(api, evidence):
    client, _ = api
    assert client.put("/diagnostics/sessions/other/evidence", json=evidence).status_code == 422
    assert client.get("/diagnostics/sessions/other/sdk-state").status_code == 404
