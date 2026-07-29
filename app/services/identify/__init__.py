from functools import lru_cache

from app.config import Settings, get_settings
from app.services.identify.base import (
    Candidate,
    IdentificationError,
    IdentificationRejected,
    IdentificationUnavailable,
    PlantIdentifier,
)
from app.services.identify.fake import FakeIdentifier
from app.services.identify.plantnet import PlantNetIdentifier

__all__ = [
    "Candidate",
    "FakeIdentifier",
    "IdentificationError",
    "IdentificationRejected",
    "IdentificationUnavailable",
    "PlantIdentifier",
    "PlantNetIdentifier",
    "build_identifier",
    "get_identifier",
]


def build_identifier(settings: Settings) -> PlantIdentifier:
    """Adding a provider is a new file plus one line here — never a refactor."""
    match settings.identify_provider:
        case "fake":
            return FakeIdentifier()
        case "plantnet":
            return PlantNetIdentifier(settings.plantnet_api_key, settings.plantnet_base_url)
        case unknown:
            raise ValueError(f"unknown IDENTIFY_PROVIDER: {unknown!r}")


@lru_cache
def get_identifier() -> PlantIdentifier:
    return build_identifier(get_settings())
