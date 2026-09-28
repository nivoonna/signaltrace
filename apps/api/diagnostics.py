"""Read-only diagnosis over browser observations and independently read SQLite events.

The local simulation still lives in the browser. Its observation upload is separate
from diagnostic tools and never inserts analytics events or changes SDK state.
Observations are process-local; accepted analytics events retain existing durability.
"""

import sqlite3
from pathlib import Path
from threading import RLock
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import AwareDatetime, BaseModel, ConfigDict, StrictBool, model_validator

from .database import read_session_events
from .models import AnalyticsEvent, Identifier


class ObservationModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ObservedAttempt(ObservationModel):
    payload: AnalyticsEvent
    initialized: StrictBool
    delivery_attempted: StrictBool


class RuntimeLog(ObservationModel):
    timestamp: AwareDatetime
    code: Literal[
        "customer_action", "delivery_skipped_uninitialized", "delivery_attempted",
        "http_response", "delivery_error", "analytics_initialized",
    ]
    event_id: Identifier | None
    detail: str


class SessionEvidence(ObservationModel):
    analytics_initialized: StrictBool
    attempts: list[ObservedAttempt]
    logs: list[RuntimeLog]

    @model_validator(mode="after")
    def consistent_evidence(self):
        ids = [attempt.payload.event_id for attempt in self.attempts]
        if len(ids) != len(set(ids)):
            raise ValueError("Expected event IDs must be unique")
        if any(log.event_id is not None and log.event_id not in ids for log in self.logs):
            raise ValueError("Runtime logs must refer to this session's expected events")
        return self


class DiagnosticTools:
    def __init__(self, database_path: Path):
        self.database_path = database_path
        self._observations: dict[str, SessionEvidence] = {}
        self._lock = RLock()

    def record_observation(self, session_id: str, evidence: SessionEvidence) -> None:
        """Telemetry intake only; not a diagnostic tool or remediation command."""
        if any(attempt.payload.session_id != session_id for attempt in evidence.attempts):
            raise HTTPException(422, "All observed events must belong to the requested session")
        with self._lock:
            self._observations[session_id] = evidence.model_copy(deep=True)

    def _evidence(self, session_id: str) -> SessionEvidence:
        with self._lock:
            evidence = self._observations.get(session_id)
            if evidence is None:
                raise HTTPException(404, "No browser evidence is available for this session")
            return evidence.model_copy(deep=True)

    def get_sdk_state(self, session_id: str) -> dict:
        evidence = self._evidence(session_id)
        return {"session_id": session_id, "initialized": evidence.analytics_initialized,
                "source": "browser_simulation_observation"}

    def get_event_delivery(self, session_id: str) -> dict:
        evidence = self._evidence(session_id)
        try:
            stored = [AnalyticsEvent.model_validate(row) for row in read_session_events(self.database_path, session_id)]
        except sqlite3.OperationalError as exc:
            raise HTTPException(503, "Storage could not be verified; delivery is unconfirmed") from exc
        matched = [attempt.payload.event_id for attempt in evidence.attempts if attempt.payload in stored]
        return {
            "session_id": session_id, "customer_actions": len(evidence.attempts),
            "delivery_attempts": sum(attempt.delivery_attempted for attempt in evidence.attempts),
            "events_received": len(matched), "stored_event_ids": matched,
            "session_events_received": len(stored),
            "attempts": [attempt.model_dump(mode="json") for attempt in evidence.attempts],
            "storage_source": "sqlite",
        }

    def get_runtime_logs(self, session_id: str) -> dict:
        evidence = self._evidence(session_id)
        return {"session_id": session_id, "source": "browser_simulation_observation",
                "entries": [log.model_dump(mode="json") for log in evidence.logs]}

    def diagnose(self, session_id: str) -> dict:
        # One coherent observation while invoking only read-only tools. No fix,
        # event generation, or storage write is available to this investigation.
        with self._lock:
            sdk = self.get_sdk_state(session_id)
            delivery = self.get_event_delivery(session_id)
            logs = self.get_runtime_logs(session_id)
        expected_ids = {attempt["payload"]["event_id"] for attempt in delivery["attempts"]}
        actions = {log["event_id"] for log in logs["entries"] if log["code"] == "customer_action"}
        dropped = {log["event_id"] for log in logs["entries"] if log["code"] == "delivery_skipped_uninitialized"}
        found = (
            sdk["initialized"] is False and bool(expected_ids)
            and all(not attempt["initialized"] for attempt in delivery["attempts"])
            and delivery["delivery_attempts"] == 0
            and delivery["session_events_received"] == 0
            and expected_ids <= actions and expected_ids <= dropped
        )
        return {
            "issue": "sdk_not_initialized" if found else None,
            "message": (
                "Nova’s analytics integration was not initialized. Customer actions occurred normally, "
                "but analytics never attempted to send those events."
                if found else "The available evidence does not confirm the missing-initialization incident."
            ),
            "checks": ["get_sdk_state", "get_event_delivery", "get_runtime_logs"],
            "evidence": {"analytics_initialized": sdk["initialized"],
                         "customer_actions": delivery["customer_actions"],
                         "delivery_attempts": delivery["delivery_attempts"],
                         "events_received": delivery["events_received"]},
            "expected_event_ids": sorted(expected_ids),
            "tools": {"sdk_state": sdk, "event_delivery": delivery, "runtime_logs": logs},
        }


def diagnostic_router(database_path: Path) -> APIRouter:
    tools = DiagnosticTools(database_path)

    def no_cache(response: Response):
        response.headers["Cache-Control"] = "no-store"

    router = APIRouter(prefix="/diagnostics/sessions", tags=["Local diagnostics"], dependencies=[Depends(no_cache)])

    @router.put("/{session_id}/evidence", status_code=204)
    def observe(session_id: Identifier, evidence: SessionEvidence):
        tools.record_observation(session_id, evidence)

    @router.get("/{session_id}/sdk-state")
    def sdk_state(session_id: Identifier):
        return tools.get_sdk_state(session_id)

    @router.get("/{session_id}/event-delivery")
    def event_delivery(session_id: Identifier):
        return tools.get_event_delivery(session_id)

    @router.get("/{session_id}/runtime-logs")
    def runtime_logs(session_id: Identifier):
        return tools.get_runtime_logs(session_id)

    @router.get("/{session_id}/diagnosis")
    def diagnosis(session_id: Identifier):
        return tools.diagnose(session_id)

    return router
