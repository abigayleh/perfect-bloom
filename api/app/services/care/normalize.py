import re
from dataclasses import dataclass

# Infraspecific ranks. Everything from here rightward is below species level and
# is dropped — Perenual is searched at binomial or genus level only.
RANK_MARKERS = frozenset(
    {
        "subsp",
        "ssp",
        "var",
        "subvar",
        "f",
        "forma",
        "cv",
        "sect",
        "ser",
        "subgen",
        "nothosubsp",
        "nothovar",
        "aff",
        "cf",
        "sp",
        "spp",
    }
)

# Lowercase words that appear inside authorship ("Hook. ex Lindl.") and must
# never be mistaken for a species epithet.
AUTHORSHIP_WORDS = frozenset({"ex", "et", "and", "in", "non", "nom", "emend"})

_PARENTHETICAL = re.compile(r"\([^)]*\)")
_QUOTED = re.compile(r"[\"'‘’“”][^\"'‘’“”]*[\"'‘’“”]")
_EPITHET = re.compile(r"^[a-z][a-z-]+$")


@dataclass(frozen=True, slots=True)
class NormalizedName:
    genus: str
    species: str | None

    @property
    def binomial(self) -> str | None:
        return f"{self.genus} {self.species}" if self.species else None

    @property
    def cache_key(self) -> str:
        """What species_cache is keyed on — the binomial, or the genus alone."""
        return self.binomial or self.genus


def normalize(name: str) -> NormalizedName | None:
    """Reduce a scientific name to genus + species epithet.

    Strips authorship, hybrid markers, cultivar names, and infraspecific ranks:

        "Monstera deliciosa Liebm."                  -> Monstera deliciosa
        "Epipremnum aureum (Linden & Andre) Bunting" -> Epipremnum aureum
        "Sansevieria trifasciata var. laurentii"     -> Sansevieria trifasciata
        "Citrus x limon"                             -> Citrus limon
        "Rosa 'Peace'"                               -> Rosa (genus only)

    Returns None if there is nothing usable.
    """
    if not name:
        return None

    cleaned = _QUOTED.sub(" ", _PARENTHETICAL.sub(" ", name))
    cleaned = cleaned.replace("×", " ")  # hybrid multiplication sign

    # Casing is what separates the epithet from authorship, so it only works on
    # conventionally-cased input. Shouted input carries no such signal — lower it
    # and treat every word as a candidate epithet.
    if not any(character.islower() for character in cleaned):
        cleaned = cleaned.lower()

    tokens = [token.strip(".,;") for token in cleaned.split()]
    tokens = [token for token in tokens if token]
    # Standalone ASCII "x" is a hybrid marker, never part of a name.
    tokens = [token for token in tokens if token.lower() != "x"]
    tokens = [token for token in tokens if token.lower() not in RANK_MARKERS]

    if not tokens:
        return None

    genus = tokens[0].capitalize()
    if not genus.isalpha():
        return None

    for token in tokens[1:]:
        lowered = token.lower()
        if lowered in AUTHORSHIP_WORDS:
            continue
        # An epithet is all-lowercase in the source. Authorship is capitalized
        # or abbreviated with periods, so casing alone separates them.
        if token == lowered and _EPITHET.match(lowered):
            return NormalizedName(genus=genus, species=lowered)

    return NormalizedName(genus=genus, species=None)


def same_species(left: str, right: str) -> bool:
    """True when two raw scientific names reduce to the same binomial."""
    a, b = normalize(left), normalize(right)
    return bool(a and b and a.binomial and a.binomial == b.binomial)


def same_genus(left: str, right: str) -> bool:
    a, b = normalize(left), normalize(right)
    return bool(a and b and a.genus == b.genus)
