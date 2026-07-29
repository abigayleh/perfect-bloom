from functools import lru_cache

from app.config import Settings, get_settings
from app.services.care.base import (
    CareError,
    CareProvider,
    CareRecord,
    CareUnavailable,
    MatchKind,
)
from app.services.care.fake import FakeCareProvider
from app.services.care.lookup import CareResult, resolve_care
from app.services.care.normalize import NormalizedName, normalize
from app.services.care.perenual import PerenualCareProvider

__all__ = [
    "CareError",
    "CareProvider",
    "CareRecord",
    "CareResult",
    "CareUnavailable",
    "FakeCareProvider",
    "MatchKind",
    "NormalizedName",
    "PerenualCareProvider",
    "build_care_provider",
    "get_care_provider",
    "normalize",
    "resolve_care",
]


def build_care_provider(settings: Settings) -> CareProvider:
    match settings.care_provider:
        case "fake":
            return FakeCareProvider()
        case "perenual":
            return PerenualCareProvider(settings.perenual_api_key, settings.perenual_base_url)
        case unknown:
            raise ValueError(f"unknown CARE_PROVIDER: {unknown!r}")


@lru_cache
def get_care_provider() -> CareProvider:
    return build_care_provider(get_settings())
