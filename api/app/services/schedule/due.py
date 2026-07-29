from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

Anchor = Literal["watering", "created"]


@dataclass(frozen=True, slots=True)
class Schedule:
    """A plant's watering state, always computed — never stored.

    Nothing here is persisted. Writing a future due date into the database is
    what makes schedules drift out of sync with reality when a user waters late.
    """

    interval_days: int | None
    last_watered_at: datetime | None
    anchor: Anchor
    next_due_on: date | None
    days_until_due: int | None
    is_due: bool

    @property
    def has_schedule(self) -> bool:
        return self.interval_days is not None

    @property
    def days_overdue(self) -> int:
        return -self.days_until_due if self.days_until_due is not None and self.is_due else 0


def resolve_zone(timezone: str) -> ZoneInfo:
    """Falls back to UTC rather than raising — a bad stored zone must not break
    the whole collection."""
    try:
        return ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def local_date(moment: datetime, zone: ZoneInfo) -> date:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(zone).date()


def compute_schedule(
    *,
    interval_days: int | None,
    last_watered_at: datetime | None,
    created_at: datetime,
    timezone: str,
    now: datetime,
) -> Schedule:
    """Next due = last watered + interval, in the user's local calendar.

    Local *dates*, not instants: a reminder fires at noon local, so a plant
    watered at 11pm must be due on the calendar day the reminder lands, not 11pm
    that night. Water two days late and every subsequent date shifts with you —
    that is the intended behaviour, not drift.

    With no watering logged yet, the anchor is when the plant joined the
    collection. That is a real timestamp, not an invented schedule.
    """
    zone = resolve_zone(timezone)
    anchor_at = last_watered_at or created_at
    anchor: Anchor = "watering" if last_watered_at else "created"

    if interval_days is None:
        return Schedule(
            interval_days=None,
            last_watered_at=last_watered_at,
            anchor=anchor,
            next_due_on=None,
            days_until_due=None,
            is_due=False,
        )

    next_due_on = local_date(anchor_at, zone) + timedelta(days=interval_days)
    days_until_due = (next_due_on - local_date(now, zone)).days

    return Schedule(
        interval_days=interval_days,
        last_watered_at=last_watered_at,
        anchor=anchor,
        next_due_on=next_due_on,
        days_until_due=days_until_due,
        is_due=days_until_due <= 0,
    )
