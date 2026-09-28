"""The first public analytics event contract."""

import re
from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
)


Identifier = Annotated[
    str,
    StringConstraints(strict=True, min_length=1, max_length=128, pattern=r"^\S+$"),
]


class AnalyticsEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: Identifier = Field(description="Globally unique, case-sensitive event ID.")
    event: Literal["product_viewed", "product_added_to_cart"]
    session_id: Identifier
    timestamp: AwareDatetime = Field(
        description="Event time: YYYY-MM-DDTHH:MM:SS[.ffffff]Z or an explicit +/-HH:MM offset."
    )
    product_id: Identifier = Field(description="Required for both supported product events.")

    @field_validator("timestamp", mode="before")
    @classmethod
    def require_timestamp_string(cls, value: object) -> str:
        # Pydantic also accepts Unix timestamps by default; this HTTP contract does not.
        if not isinstance(value, str) or not re.fullmatch(
            r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})",
            value,
        ):
            raise ValueError("timestamp must be an ISO 8601 string with seconds and a timezone")
        return value

    @field_validator("timestamp")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        try:
            return value.astimezone(UTC)
        except OverflowError as exc:
            raise ValueError("timestamp must be within the supported UTC date range") from exc


class EventReceipt(BaseModel):
    event_id: Identifier
    status: Literal["accepted"] = "accepted"
