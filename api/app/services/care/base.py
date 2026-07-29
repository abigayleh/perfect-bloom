from dataclasses import dataclass, field
from typing import Literal, Protocol

MatchKind = Literal["exact", "genus", "none"]


@dataclass(frozen=True, slots=True)
class CareRecord:
    """Care facts as the provider stated them. Nothing here is inferred.

    The toxicity fields are tri-state on purpose. None means the source did not
    say, and callers must render that as "unknown" — never as safe.
    """

    provider_id: int | None = None
    matched_name: str | None = None
    common_name: str | None = None
    watering: str | None = None
    sunlight: tuple[str, ...] = ()
    cycle: str | None = None
    poisonous_to_pets: bool | None = None
    poisonous_to_humans: bool | None = None
    raw: dict = field(default_factory=dict)


class CareProvider(Protocol):
    async def lookup(self, query: str, *, genus_only: bool) -> CareRecord | None: ...


class CareError(Exception):
    """A care-lookup failure the client is expected to render."""


class CareUnavailable(CareError):
    """The provider timed out, errored, or rejected our credentials."""


def parse_toxicity(value: object) -> bool | None:
    """Coerce a provider's toxicity field, defaulting to unknown.

    Anything unrecognized becomes None rather than False. Guessing "not
    poisonous" from a field we failed to parse is the one mistake in this app
    that can kill an animal.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return bool(value) if value in (0, 1) else None
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("true", "1", "yes"):
            return True
        if lowered in ("false", "0", "no"):
            return False
    return None
