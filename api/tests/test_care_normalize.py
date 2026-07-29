import pytest

from app.services.care.normalize import normalize, same_genus, same_species


@pytest.mark.parametrize(
    "raw,expected",
    [
        # Plain binomials
        ("Monstera deliciosa", "Monstera deliciosa"),
        ("monstera deliciosa", "Monstera deliciosa"),
        ("MONSTERA DELICIOSA", "Monstera deliciosa"),
        ("  Monstera   deliciosa  ", "Monstera deliciosa"),
        # Authorship
        ("Monstera deliciosa Liebm.", "Monstera deliciosa"),
        ("Aloe vera (L.) Burm.f.", "Aloe vera"),
        ("Epipremnum aureum (Linden & Andre) G.S.Bunting", "Epipremnum aureum"),
        ("Dracaena trifasciata (Prain) Mabb.", "Dracaena trifasciata"),
        ("Ficus elastica Roxb. ex Hornem.", "Ficus elastica"),
        # Infraspecific ranks
        ("Sansevieria trifasciata var. laurentii", "Sansevieria trifasciata"),
        ("Hedera helix subsp. canariensis", "Hedera helix"),
        ("Ocimum basilicum f. citriodorum", "Ocimum basilicum"),
        ("Thymus vulgaris ssp. vulgaris", "Thymus vulgaris"),
        # Hybrids
        ("Citrus × limon", "Citrus limon"),
        ("Citrus x limon", "Citrus limon"),
        ("Philodendron × evansii", "Philodendron evansii"),
    ],
)
def test_normalizes_to_binomial(raw, expected):
    result = normalize(raw)

    assert result is not None
    assert result.binomial == expected
    assert result.cache_key == expected


@pytest.mark.parametrize(
    "raw,genus",
    [
        ("Rosa 'Peace'", "Rosa"),
        ('Monstera "Thai Constellation"', "Monstera"),
        ("Philodendron", "Philodendron"),
        ("Monstera sp.", "Monstera"),
        ("Ficus spp.", "Ficus"),
    ],
)
def test_falls_back_to_genus_when_there_is_no_epithet(raw, genus):
    result = normalize(raw)

    assert result is not None
    assert result.genus == genus
    assert result.species is None
    assert result.binomial is None
    assert result.cache_key == genus


@pytest.mark.parametrize("raw", ["", "   ", "123", "'''"])
def test_unusable_names_return_none(raw):
    assert normalize(raw) is None


def test_authorship_words_are_never_read_as_an_epithet():
    # "ex" is lowercase and would otherwise look like a species epithet.
    result = normalize("Ficus Roxb. ex Hornem.")

    assert result is not None
    assert result.species is None
    assert result.genus == "Ficus"


def test_same_species_ignores_authorship_and_rank():
    assert same_species("Monstera deliciosa", "Monstera deliciosa Liebm.")
    assert same_species("Sansevieria trifasciata var. laurentii", "Sansevieria trifasciata")
    assert not same_species("Monstera deliciosa", "Monstera adansonii")
    # A genus-only name is not a species match for anything.
    assert not same_species("Monstera", "Monstera deliciosa")


def test_same_genus_is_looser_than_same_species():
    assert same_genus("Monstera deliciosa", "Monstera adansonii")
    assert same_genus("Monstera", "Monstera deliciosa Liebm.")
    assert not same_genus("Monstera deliciosa", "Philodendron hederaceum")
