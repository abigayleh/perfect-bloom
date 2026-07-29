from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True, slots=True)
class Attribution:
    """Credit a provider requires us to display. Rendered wherever results are."""

    text: str
    url: str
    logo_path: str | None = None  # path under /static, once the asset is added


@dataclass(frozen=True, slots=True)
class Candidate:
    """One ranked identification result. Taxonomy only — no care data, no toxicity."""

    scientific_name: str
    score: float
    common_names: tuple[str, ...] = ()
    genus: str | None = None
    family: str | None = None
    extra: dict[str, str] = field(default_factory=dict)

    @property
    def confidence_percent(self) -> int:
        return round(self.score * 100)


class PlantIdentifier(Protocol):
    attribution: Attribution | None

    async def identify(self, images: list[bytes]) -> list[Candidate]: ...


class IdentificationError(Exception):
    """Base for identification failures the UI is expected to render."""


class IdentificationUnavailable(IdentificationError):
    """The provider timed out, errored, or rejected our credentials.

    Distinct from "no match" — a dead third party degrades the page, it does not 500 it.
    """


class IdentificationRejected(IdentificationError):
    """The provider refused the request itself (too many images, unusable photo)."""
