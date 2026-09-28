"""File-backed SQLite persistence with atomic duplicate detection."""

import sqlite3
from contextlib import closing
from pathlib import Path

from .models import AnalyticsEvent


def initialize_database(database_path: Path) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(database_path)) as connection:
        with connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    event_id TEXT PRIMARY KEY NOT NULL,
                    event TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    product_id TEXT NOT NULL
                )
                """
            )


def insert_event(database_path: Path, event: AnalyticsEvent) -> bool:
    """Return True only after a new event commits; duplicates leave the row intact."""
    with closing(sqlite3.connect(database_path)) as connection:
        with connection:
            cursor = connection.execute(
                """
                INSERT INTO events (event_id, event, session_id, timestamp, product_id)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(event_id) DO NOTHING
                """,
                (
                    event.event_id,
                    event.event,
                    event.session_id,
                    event.timestamp.isoformat(),
                    event.product_id,
                ),
            )
            inserted = cursor.rowcount == 1
    return inserted
