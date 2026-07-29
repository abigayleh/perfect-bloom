from app.services.care.base import CareRecord
from app.services.care.normalize import normalize

# Keyed by binomial, plus a couple of genus-only entries to exercise the fallback.
_SPECIES: dict[str, CareRecord] = {
    "Monstera deliciosa": CareRecord(
        provider_id=1001,
        matched_name="Monstera deliciosa",
        common_name="Swiss cheese plant",
        watering="Average",
        sunlight=("part shade",),
        cycle="Perennial",
        poisonous_to_pets=True,
        poisonous_to_humans=True,
    ),
    "Epipremnum aureum": CareRecord(
        provider_id=1002,
        matched_name="Epipremnum aureum",
        common_name="Golden pothos",
        watering="Average",
        sunlight=("part shade", "full shade"),
        cycle="Perennial",
        poisonous_to_pets=True,
        poisonous_to_humans=True,
    ),
    "Lilium longiflorum": CareRecord(
        provider_id=1003,
        matched_name="Lilium longiflorum",
        common_name="Easter lily",
        watering="Average",
        sunlight=("full sun",),
        cycle="Perennial",
        poisonous_to_pets=True,
        poisonous_to_humans=False,
    ),
    # Deliberately missing toxicity: exercises the "unknown" path, which must
    # never render as safe.
    "Sansevieria trifasciata": CareRecord(
        provider_id=1004,
        matched_name="Sansevieria trifasciata",
        common_name="Snake plant",
        watering="Minimum",
        sunlight=("full sun", "part shade"),
        cycle="Perennial",
        poisonous_to_pets=None,
        poisonous_to_humans=None,
    ),
}

_GENERA: dict[str, CareRecord] = {
    "Philodendron": CareRecord(
        provider_id=2001,
        matched_name="Philodendron",
        common_name="Philodendron",
        watering="Average",
        sunlight=("part shade",),
        cycle="Perennial",
        poisonous_to_pets=True,
        poisonous_to_humans=True,
    ),
}


class FakeCareProvider:
    """Offline care data for dev and tests. Never touches the network."""

    async def lookup(self, query: str, *, genus_only: bool) -> CareRecord | None:
        parsed = normalize(query)
        if parsed is None:
            return None
        if genus_only:
            return _GENERA.get(parsed.genus)
        return _SPECIES.get(parsed.binomial) if parsed.binomial else None
