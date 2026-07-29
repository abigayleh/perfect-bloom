from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SpeciesCache
from app.models.base import utcnow
from app.services.care.base import CareProvider, CareRecord, MatchKind
from app.services.care.normalize import normalize

# A hit never expires — care facts are stable, and this table is also where
# manual corrections live. A miss is retried eventually, because Perenual adds
# species over time and a permanent "no data" would never heal.
MISS_RETRY_AFTER = timedelta(days=30)


@dataclass(frozen=True, slots=True)
class CareResult:
    requested_name: str
    normalized_name: str
    match_kind: MatchKind
    matched_name: str | None = None
    common_name: str | None = None
    watering: str | None = None
    sunlight: tuple[str, ...] = ()
    cycle: str | None = None
    poisonous_to_pets: bool | None = None
    poisonous_to_humans: bool | None = None
    from_cache: bool = False

    @property
    def found(self) -> bool:
        return self.match_kind != "none"

    @property
    def toxicity_known(self) -> bool:
        return self.poisonous_to_pets is not None or self.poisonous_to_humans is not None


def _from_row(row: SpeciesCache, requested: str, *, from_cache: bool) -> CareResult:
    return CareResult(
        requested_name=requested,
        normalized_name=row.normalized_name,
        match_kind=row.match_kind,  # type: ignore[arg-type]
        matched_name=row.matched_name,
        common_name=row.common_name,
        watering=row.watering,
        sunlight=tuple(row.sunlight or ()),
        cycle=row.cycle,
        poisonous_to_pets=row.poisonous_to_pets,
        poisonous_to_humans=row.poisonous_to_humans,
        from_cache=from_cache,
    )


def _is_usable(row: SpeciesCache) -> bool:
    if row.match_kind != "none":
        return True
    return utcnow() - row.fetched_at < MISS_RETRY_AFTER


async def _read_cache(session: AsyncSession, key: str) -> SpeciesCache | None:
    result = await session.execute(select(SpeciesCache).where(SpeciesCache.normalized_name == key))
    return result.scalar_one_or_none()


async def _write_cache(
    session: AsyncSession, key: str, kind: MatchKind, record: CareRecord | None
) -> SpeciesCache:
    row = await _read_cache(session, key)
    if row is None:
        row = SpeciesCache(normalized_name=key)
        session.add(row)

    record = record or CareRecord()
    row.match_kind = kind
    row.matched_name = record.matched_name
    row.perenual_id = record.provider_id
    row.common_name = record.common_name
    row.watering = record.watering
    row.sunlight = list(record.sunlight) or None
    row.cycle = record.cycle
    row.poisonous_to_pets = record.poisonous_to_pets
    row.poisonous_to_humans = record.poisonous_to_humans
    row.payload = record.raw or None
    row.fetched_at = utcnow()

    await session.commit()
    return row


async def resolve_care(
    session: AsyncSession, scientific_name: str, provider: CareProvider
) -> CareResult | None:
    """Cache-first care lookup: exact binomial, then genus, then a cached miss.

    Returns None only when the name can't be parsed at all. A genuine "no care
    data" is a CareResult with match_kind "none", so callers can tell the two
    apart — and so a miss is never re-queried against the rate limit.
    """
    parsed = normalize(scientific_name)
    if parsed is None:
        return None

    key = parsed.cache_key
    cached = await _read_cache(session, key)
    if cached is not None and _is_usable(cached):
        return _from_row(cached, scientific_name, from_cache=True)

    record: CareRecord | None = None
    kind: MatchKind = "none"

    if parsed.binomial:
        record = await provider.lookup(parsed.binomial, genus_only=False)
        if record is not None:
            kind = "exact"

    if record is None:
        record = await provider.lookup(parsed.genus, genus_only=True)
        if record is not None:
            kind = "genus"

    row = await _write_cache(session, key, kind, record)
    return _from_row(row, scientific_name, from_cache=False)
