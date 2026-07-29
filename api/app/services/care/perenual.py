import logging

import httpx

from app.services.care.base import CareRecord, CareUnavailable, parse_toxicity
from app.services.care.normalize import same_genus, same_species
from app.services.http import request_with_retry

log = logging.getLogger(__name__)

# How many search hits to consider before giving up. Perenual's search is fuzzy,
# so a hit is only accepted if its own scientific name actually matches ours.
MAX_CANDIDATES = 10


class PerenualCareProvider:
    """https://perenual.com/api/v2

    Toxicity lives only in the details response, so a resolved species costs two
    calls. That is why every result — including a miss — is cached.
    """

    def __init__(self, api_key: str, base_url: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    async def lookup(self, query: str, *, genus_only: bool) -> CareRecord | None:
        results = await self._search(query)
        match = self._pick(results, query, genus_only=genus_only)
        if match is None:
            return None

        species_id = match.get("id")
        details = await self._details(species_id) if isinstance(species_id, int) else {}
        return _to_record(match, details)

    async def _search(self, query: str) -> list[dict]:
        payload = await self._get("/species-list", params={"q": query})
        data = payload.get("data")
        return data[:MAX_CANDIDATES] if isinstance(data, list) else []

    async def _details(self, species_id: int) -> dict:
        try:
            return await self._get(f"/species/details/{species_id}")
        except CareUnavailable:
            # Care data without toxicity is still useful; toxicity stays unknown,
            # which the UI must render as "unknown" rather than "safe".
            log.warning("perenual details unavailable for id=%s", species_id)
            return {}

    async def _get(self, path: str, params: dict | None = None) -> dict:
        try:
            response = await request_with_retry(
                "GET",
                f"{self._base_url}{path}",
                params={"key": self._api_key, **(params or {})},
            )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise CareUnavailable("Care data is unavailable right now.") from exc

        if response.status_code == 404:
            return {}
        if response.status_code in (401, 403):
            log.error("Perenual rejected our API key (%s)", response.status_code)
            raise CareUnavailable("Care data is unavailable right now.")
        if response.status_code == 429:
            raise CareUnavailable("Care lookups are rate limited right now.")
        if response.status_code >= 400:
            log.error("Perenual returned %s for %s", response.status_code, path)
            raise CareUnavailable("Care data is unavailable right now.")

        try:
            payload = response.json()
        except ValueError as exc:
            raise CareUnavailable("Care data came back unreadable.") from exc
        return payload if isinstance(payload, dict) else {}

    @staticmethod
    def _pick(results: list[dict], query: str, *, genus_only: bool) -> dict | None:
        """Accept a hit only if its own name matches — search is fuzzy, and the
        wrong species would carry the wrong toxicity."""
        matches = same_genus if genus_only else same_species
        for result in results:
            for name in _scientific_names(result):
                if matches(name, query):
                    return result
        return None


def _scientific_names(result: dict) -> list[str]:
    value = result.get("scientific_name")
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    return []


def _sunlight(value: object) -> tuple[str, ...]:
    if isinstance(value, str):
        return (value,)
    if isinstance(value, list):
        return tuple(item for item in value if isinstance(item, str))
    return ()


def _to_record(match: dict, details: dict) -> CareRecord:
    names = _scientific_names(match)
    return CareRecord(
        provider_id=match.get("id") if isinstance(match.get("id"), int) else None,
        matched_name=names[0] if names else None,
        common_name=match.get("common_name") or details.get("common_name"),
        watering=details.get("watering") or match.get("watering"),
        sunlight=_sunlight(details.get("sunlight") or match.get("sunlight")),
        cycle=details.get("cycle") or match.get("cycle"),
        poisonous_to_pets=parse_toxicity(details.get("poisonous_to_pets")),
        poisonous_to_humans=parse_toxicity(details.get("poisonous_to_humans")),
        raw={"list": match, "details": details},
    )
