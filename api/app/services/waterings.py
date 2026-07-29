from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Plant, WateringEvent
from app.models.base import utcnow

# A watering can be backdated but not invented in the future — the whole schedule
# is anchored to things that actually happened.
MAX_BACKDATE = timedelta(days=365)


class WateringError(ValueError):
    """A watering that can't be logged, with a message safe to show."""


def _as_utc(moment: datetime | None) -> datetime | None:
    """SQL aggregates can lose the column's timezone coercion; re-apply it."""
    if moment is None:
        return None
    return moment.replace(tzinfo=UTC) if moment.tzinfo is None else moment.astimezone(UTC)


async def log_watering(
    session: AsyncSession,
    plant: Plant,
    *,
    watered_at: datetime | None = None,
    now: datetime | None = None,
) -> WateringEvent:
    """Append a watering. Never updates an existing row — this log is the record
    that makes V2 diagnosis possible, so it only ever grows."""
    now = now or utcnow()
    moment = _as_utc(watered_at) or now

    if moment > now + timedelta(minutes=5):  # small slack for clock skew
        raise WateringError("You can't log a watering in the future.")
    if moment < now - MAX_BACKDATE:
        raise WateringError("That date is too far in the past.")

    event = WateringEvent(plant_id=plant.id, watered_at=moment)
    session.add(event)
    await session.commit()
    return event


async def last_watered_at(session: AsyncSession, plant_id: int) -> datetime | None:
    result = await session.execute(
        select(func.max(WateringEvent.watered_at)).where(WateringEvent.plant_id == plant_id)
    )
    return _as_utc(result.scalar_one_or_none())


async def last_watered_for(session: AsyncSession, plant_ids: list[int]) -> dict[int, datetime]:
    """One query for the whole collection rather than one per plant."""
    if not plant_ids:
        return {}
    result = await session.execute(
        select(WateringEvent.plant_id, func.max(WateringEvent.watered_at))
        .where(WateringEvent.plant_id.in_(plant_ids))
        .group_by(WateringEvent.plant_id)
    )
    return {plant_id: _as_utc(moment) for plant_id, moment in result.all() if moment is not None}


async def watering_history(
    session: AsyncSession, plant_id: int, *, limit: int = 100
) -> list[WateringEvent]:
    result = await session.execute(
        select(WateringEvent)
        .where(WateringEvent.plant_id == plant_id)
        .order_by(WateringEvent.watered_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
