from datetime import timedelta

from sqlalchemy import select

from app.models import SpeciesCache
from app.models.base import utcnow
from app.services.care.base import CareRecord
from app.services.care.fake import FakeCareProvider
from app.services.care.lookup import resolve_care


class CountingProvider:
    """Records every call so cache behaviour is observable."""

    def __init__(self, species: dict[str, CareRecord] | None = None, genera=None):
        self.species = species or {}
        self.genera = genera or {}
        self.calls: list[tuple[str, bool]] = []

    async def lookup(self, query: str, *, genus_only: bool) -> CareRecord | None:
        self.calls.append((query, genus_only))
        return (self.genera if genus_only else self.species).get(query)


MONSTERA = CareRecord(
    provider_id=1,
    matched_name="Monstera deliciosa",
    common_name="Swiss cheese plant",
    watering="Average",
    sunlight=("part shade",),
    cycle="Perennial",
    poisonous_to_pets=True,
    poisonous_to_humans=True,
)
PHILODENDRON = CareRecord(provider_id=2, matched_name="Philodendron", poisonous_to_pets=True)


async def test_exact_match_is_cached_and_not_refetched(session):
    provider = CountingProvider(species={"Monstera deliciosa": MONSTERA})

    first = await resolve_care(session, "Monstera deliciosa Liebm.", provider)
    second = await resolve_care(session, "Monstera deliciosa", provider)

    assert first is not None and second is not None
    assert first.match_kind == "exact"
    assert first.from_cache is False
    assert second.from_cache is True
    assert second.poisonous_to_pets is True
    assert len(provider.calls) == 1, "the second lookup must not hit the provider"


async def test_falls_back_to_genus_and_labels_it(session):
    provider = CountingProvider(genera={"Philodendron": PHILODENDRON})

    result = await resolve_care(session, "Philodendron hederaceum", provider)

    assert result is not None
    assert result.match_kind == "genus"
    assert result.matched_name == "Philodendron"
    assert provider.calls == [("Philodendron hederaceum", False), ("Philodendron", True)]


async def test_a_miss_is_cached_so_the_rate_limit_is_not_burned(session):
    provider = CountingProvider()

    first = await resolve_care(session, "Nothing realis", provider)
    second = await resolve_care(session, "Nothing realis", provider)

    assert first is not None and first.match_kind == "none"
    assert first.found is False
    assert second is not None and second.from_cache is True
    assert len(provider.calls) == 2, "one attempt only: binomial then genus"


async def test_a_stale_miss_is_retried(session):
    provider = CountingProvider()
    await resolve_care(session, "Nothing realis", provider)

    row = (
        await session.execute(
            select(SpeciesCache).where(SpeciesCache.normalized_name == "Nothing realis")
        )
    ).scalar_one()
    row.fetched_at = utcnow() - timedelta(days=31)
    await session.commit()

    provider.species["Nothing realis"] = MONSTERA
    result = await resolve_care(session, "Nothing realis", provider)

    assert result is not None
    assert result.match_kind == "exact"
    assert result.from_cache is False


async def test_a_hit_never_goes_stale(session):
    provider = CountingProvider(species={"Monstera deliciosa": MONSTERA})
    await resolve_care(session, "Monstera deliciosa", provider)

    row = (
        await session.execute(
            select(SpeciesCache).where(SpeciesCache.normalized_name == "Monstera deliciosa")
        )
    ).scalar_one()
    row.fetched_at = utcnow() - timedelta(days=3650)
    await session.commit()

    result = await resolve_care(session, "Monstera deliciosa", provider)

    assert result is not None and result.from_cache is True
    assert len(provider.calls) == 1


async def test_unknown_toxicity_stays_unknown(session):
    provider = CountingProvider(
        species={"Sansevieria trifasciata": CareRecord(matched_name="Sansevieria trifasciata")}
    )

    result = await resolve_care(session, "Sansevieria trifasciata", provider)

    assert result is not None
    assert result.match_kind == "exact"
    assert result.poisonous_to_pets is None
    assert result.poisonous_to_humans is None
    assert result.toxicity_known is False


async def test_variants_of_one_name_share_a_cache_row(session):
    provider = CountingProvider(species={"Monstera deliciosa": MONSTERA})

    for variant in (
        "Monstera deliciosa",
        "Monstera deliciosa Liebm.",
        "monstera deliciosa",
        "Monstera deliciosa var. borsigiana",
    ):
        assert (await resolve_care(session, variant, provider)) is not None

    rows = (await session.execute(select(SpeciesCache))).scalars().all()
    assert len(rows) == 1
    assert len(provider.calls) == 1


async def test_unparseable_name_returns_none(session):
    assert await resolve_care(session, "123", CountingProvider()) is None


async def test_fake_provider_backs_the_offline_flow(session):
    result = await resolve_care(session, "Lilium longiflorum", FakeCareProvider())

    assert result is not None
    assert result.match_kind == "exact"
    assert result.poisonous_to_pets is True
