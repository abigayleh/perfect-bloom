from datetime import UTC, datetime

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    """All timestamps are stored UTC-aware; local time exists only at the schedule boundary."""
    return datetime.now(UTC)
