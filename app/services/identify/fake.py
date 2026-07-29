import hashlib

from app.services.identify.base import Candidate, IdentificationRejected

MAX_IMAGES = 5

_FIXTURES: list[list[Candidate]] = [
    [
        Candidate(
            "Monstera deliciosa",
            0.91,
            ("Swiss cheese plant", "Split-leaf philodendron"),
            genus="Monstera",
            family="Araceae",
        ),
        Candidate(
            "Monstera adansonii", 0.34, ("Adanson's monstera",), genus="Monstera", family="Araceae"
        ),
    ],
    [
        Candidate(
            "Epipremnum aureum",
            0.88,
            ("Golden pothos", "Devil's ivy"),
            genus="Epipremnum",
            family="Araceae",
        ),
        Candidate(
            "Philodendron hederaceum",
            0.21,
            ("Heartleaf philodendron",),
            genus="Philodendron",
            family="Araceae",
        ),
    ],
    [
        Candidate(
            "Sansevieria trifasciata",
            0.79,
            ("Snake plant", "Mother-in-law's tongue"),
            genus="Sansevieria",
            family="Asparagaceae",
        ),
    ],
    [
        # Deliberately a lily: exercises the toxicity path that must never say "safe".
        Candidate("Lilium longiflorum", 0.84, ("Easter lily",), genus="Lilium", family="Liliaceae"),
    ],
    [],  # no match — the branch where care fields stay null and the user sets an interval
]


class FakeIdentifier:
    """Deterministic offline identifier for dev and tests. Never touches the network."""

    attribution = None  # nothing was called, so crediting anyone would be a lie

    async def identify(self, images: list[bytes]) -> list[Candidate]:
        if not 1 <= len(images) <= MAX_IMAGES:
            raise IdentificationRejected(f"Send between 1 and {MAX_IMAGES} photos.")
        digest = hashlib.sha256(b"".join(images)).digest()
        return _FIXTURES[digest[0] % len(_FIXTURES)]
