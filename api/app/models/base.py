from datetime import UTC, datetime

from sqlalchemy import DateTime, TypeDecorator
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    """All timestamps are stored UTC-aware; local time exists only at the schedule boundary."""
    return datetime.now(UTC)


class UtcDateTime(TypeDecorator):
    """A timestamp column that always reads back as timezone-aware UTC.

    SQLite has no timezone type and hands back naive datetimes, which raise on
    comparison with aware ones. Postgres round-trips correctly. This makes both
    behave identically so the schedule math can't silently differ per backend.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("naive datetime written to a UTC column")
        return value.astimezone(UTC)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
