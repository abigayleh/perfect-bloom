import logging

import httpx

from app.services.http import request_with_retry
from app.services.identify.base import (
    Attribution,
    Candidate,
    IdentificationRejected,
    IdentificationUnavailable,
)

log = logging.getLogger(__name__)

MAX_IMAGES = 5

# Required by PlantNet's free tier. Not a TODO — this stays on the results view.
# logo_path is None until the official logo asset is added under app/static/img/.
PLANTNET_ATTRIBUTION = Attribution(
    text="Plant identification powered by Pl@ntNet",
    url="https://plantnet.org",
    logo_path=None,
)


class PlantNetIdentifier:
    """https://my-api.plantnet.org/v2/identify/all

    Returns taxonomy only. Care data and toxicity come from Perenual, never from here.
    """

    attribution = PLANTNET_ATTRIBUTION

    def __init__(self, api_key: str, base_url: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    async def identify(self, images: list[bytes]) -> list[Candidate]:
        if not 1 <= len(images) <= MAX_IMAGES:
            raise IdentificationRejected(f"Send between 1 and {MAX_IMAGES} photos.")

        files = [
            ("images", (f"image{i}.jpg", image, "image/jpeg")) for i, image in enumerate(images)
        ]
        # One organ per image. Must be a dict of sequences — a list of tuples is
        # read by httpx as a raw body, not as form fields.
        form = {"organs": ["auto"] * len(images)}

        try:
            response = await request_with_retry(
                "POST",
                f"{self._base_url}/identify/all",
                params={"api-key": self._api_key},
                files=files,
                data=form,
            )
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise IdentificationUnavailable("Pl@ntNet didn't respond in time.") from exc

        return self._handle(response)

    def _handle(self, response: httpx.Response) -> list[Candidate]:
        # 404 is PlantNet's "no species matched", not an error condition.
        if response.status_code == 404:
            return []
        if response.status_code in (401, 403):
            log.error("PlantNet rejected our API key (%s)", response.status_code)
            raise IdentificationUnavailable("Plant identification is unavailable right now.")
        if response.status_code == 429:
            raise IdentificationUnavailable("Daily identification limit reached. Try tomorrow.")
        if response.status_code == 400:
            raise IdentificationRejected("Pl@ntNet couldn't read those photos. Try clearer ones.")
        if response.status_code >= 400:
            log.error("PlantNet returned %s", response.status_code)
            raise IdentificationUnavailable("Plant identification is unavailable right now.")

        try:
            payload = response.json()
        except ValueError as exc:
            raise IdentificationUnavailable("Pl@ntNet sent back something unreadable.") from exc

        return [
            candidate
            for result in payload.get("results", [])
            if (candidate := _to_candidate(result)) is not None
        ]


def _to_candidate(result: dict) -> Candidate | None:
    species = result.get("species") or {}
    name = species.get("scientificNameWithoutAuthor") or species.get("scientificName")
    if not name:
        return None
    return Candidate(
        scientific_name=name,
        score=float(result.get("score") or 0.0),
        common_names=tuple(species.get("commonNames") or ()),
        genus=(species.get("genus") or {}).get("scientificNameWithoutAuthor"),
        family=(species.get("family") or {}).get("scientificNameWithoutAuthor"),
    )
