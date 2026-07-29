from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Plant, SpeciesCache, User
from app.models.base import utcnow
from app.services.care.normalize import normalize
from app.services.images.storage import Storage

MAX_INTERVAL_DAYS = 365


class PlantError(ValueError):
    """A plant write that failed validation, with a message safe to show."""


def _check_interval(interval_days: int | None) -> None:
    if interval_days is None:
        return
    if not 1 <= interval_days <= MAX_INTERVAL_DAYS:
        raise PlantError(f"Watering interval must be between 1 and {MAX_INTERVAL_DAYS} days.")


async def _link_species(session: AsyncSession, scientific_name: str | None) -> int | None:
    """Attach an already-cached species row if we have one.

    Deliberately does not trigger a care lookup — a save must not depend on a
    third party being up, and the client has usually warmed the cache already.
    """
    if not scientific_name:
        return None
    parsed = normalize(scientific_name)
    if parsed is None:
        return None
    result = await session.execute(
        select(SpeciesCache).where(SpeciesCache.normalized_name == parsed.cache_key)
    )
    row = result.scalar_one_or_none()
    return row.id if row else None


async def create_plant(
    session: AsyncSession,
    user: User,
    *,
    scientific_name: str = "",
    nickname: str | None = None,
    common_name: str | None = None,
    image_key: str | None = None,
    interval_days: int | None = None,
) -> Plant:
    scientific_name = (scientific_name or "").strip()
    nickname = (nickname or "").strip() or None

    if not scientific_name and not nickname:
        raise PlantError("Give the plant a name or a nickname.")
    _check_interval(interval_days)

    plant = Plant(
        user_id=user.id,
        scientific_name=scientific_name,
        nickname=nickname,
        common_name=(common_name or "").strip() or None,
        image_key=image_key,
        interval_days=interval_days,
        species_cache_id=await _link_species(session, scientific_name),
    )
    session.add(plant)
    await session.commit()
    return plant


async def list_plants(session: AsyncSession, user: User) -> list[Plant]:
    result = await session.execute(
        select(Plant)
        .where(Plant.user_id == user.id, Plant.deleted_at.is_(None))
        .order_by(Plant.created_at.desc())
    )
    return list(result.scalars().all())


async def get_plant(session: AsyncSession, user: User, plant_id: int) -> Plant | None:
    """Scoped by owner. Another user's plant is indistinguishable from a missing one."""
    result = await session.execute(
        select(Plant).where(
            Plant.id == plant_id,
            Plant.user_id == user.id,
            Plant.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def update_plant(
    session: AsyncSession,
    user: User,
    plant_id: int,
    *,
    nickname: str | None = None,
    interval_days: int | None = None,
    clear_interval: bool = False,
) -> Plant | None:
    plant = await get_plant(session, user, plant_id)
    if plant is None:
        return None

    if nickname is not None:
        plant.nickname = nickname.strip() or None
    if clear_interval:
        plant.interval_days = None
    elif interval_days is not None:
        _check_interval(interval_days)
        plant.interval_days = interval_days

    await session.commit()
    return plant


async def delete_plant(session: AsyncSession, user: User, plant_id: int, storage: Storage) -> bool:
    """Soft delete the row, hard delete the photo.

    watering_events must outlive the plant, per the domain rule — but the photo
    is not the log. It is a picture taken inside someone's home, so removing the
    plant removes it, and the key is cleared so nothing points at a gone file.
    Deleted after the commit: a storage failure must not undo the delete.
    """
    plant = await get_plant(session, user, plant_id)
    if plant is None:
        return False

    image_key = plant.image_key
    plant.deleted_at = utcnow()
    plant.image_key = None
    await session.commit()

    if image_key:
        await storage.delete(image_key)
    return True
