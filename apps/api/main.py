"""Run with: python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000."""

import logging
import os
import sqlite3
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, status

from .database import initialize_database, insert_event
from .models import AnalyticsEvent, EventReceipt


logger = logging.getLogger(__name__)


def create_app(database_path: str | Path | None = None) -> FastAPI:
    """Create an app with its own database path; importing the module writes no data."""
    path = Path(
        database_path
        if database_path is not None
        else os.environ.get("SIGNALTRACE_DB_PATH", "data/signaltrace.sqlite3")
    )
    if str(path) == ":memory:":
        raise ValueError("Use a SQLite file path; in-memory databases are not supported")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        initialize_database(path)
        yield

    app = FastAPI(
        title="SignalTrace Event Ingestion",
        version="0.1.0",
        description="Validate and persist individual analytics events in SQLite.",
        lifespan=lifespan,
    )

    @app.post(
        "/events",
        response_model=EventReceipt,
        status_code=status.HTTP_201_CREATED,
        responses={
            409: {"description": "This event_id is already stored; the original is unchanged."},
            503: {"description": "Event storage is unavailable; no acceptance is reported."},
        },
    )
    def ingest_event(event: AnalyticsEvent) -> EventReceipt:
        try:
            inserted = insert_event(path, event)
        except sqlite3.OperationalError as exc:
            logger.exception("Event storage failed")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "storage_unavailable", "message": "Event storage is unavailable."},
            ) from exc

        if not inserted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "duplicate_event_id",
                    "message": "An event with this event_id already exists.",
                    "event_id": event.event_id,
                },
            )
        return EventReceipt(event_id=event.event_id)

    return app


app = create_app()
