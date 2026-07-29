import httpx
import pytest
import respx

from app.services.care.base import CareUnavailable, parse_toxicity
from app.services.care.perenual import PerenualCareProvider

HOST = "perenual.com"
BASE = "https://perenual.com/api/v2"

LIST_HIT = {
    "data": [
        {
            "id": 1234,
            "common_name": "Swiss cheese plant",
            "scientific_name": ["Monstera deliciosa Liebm."],
            "cycle": "Perennial",
            "watering": "Average",
            "sunlight": ["part shade"],
        }
    ]
}

DETAILS = {
    "id": 1234,
    "common_name": "Swiss cheese plant",
    "watering": "Average",
    "sunlight": ["part shade"],
    "cycle": "Perennial",
    "poisonous_to_pets": True,
    "poisonous_to_humans": True,
}


@pytest.fixture
def provider():
    return PerenualCareProvider("test-key", BASE)


def list_route():
    return respx.route(method="GET", host=HOST, path="/api/v2/species-list")


def details_route(species_id=1234):
    return respx.route(method="GET", host=HOST, path=f"/api/v2/species/details/{species_id}")


@respx.mock
async def test_resolves_species_and_reads_toxicity_from_details(provider):
    list_route().mock(return_value=httpx.Response(200, json=LIST_HIT))
    details_route().mock(return_value=httpx.Response(200, json=DETAILS))

    record = await provider.lookup("Monstera deliciosa", genus_only=False)

    assert record is not None
    assert record.provider_id == 1234
    assert record.common_name == "Swiss cheese plant"
    assert record.watering == "Average"
    assert record.sunlight == ("part shade",)
    assert record.poisonous_to_pets is True
    assert record.poisonous_to_humans is True


@respx.mock
async def test_rejects_a_fuzzy_hit_that_is_a_different_species(provider):
    # Perenual's search is fuzzy. Accepting this would attach the wrong plant's
    # toxicity to the user's plant.
    list_route().mock(
        return_value=httpx.Response(
            200,
            json={"data": [{"id": 99, "scientific_name": ["Philodendron hederaceum"]}]},
        )
    )

    assert await provider.lookup("Monstera deliciosa", genus_only=False) is None


@respx.mock
async def test_genus_mode_accepts_a_sibling_species(provider):
    list_route().mock(
        return_value=httpx.Response(
            200,
            json={"data": [{"id": 55, "scientific_name": ["Philodendron hederaceum"]}]},
        )
    )
    details_route(55).mock(return_value=httpx.Response(200, json={"poisonous_to_pets": True}))

    record = await provider.lookup("Philodendron", genus_only=True)

    assert record is not None
    assert record.provider_id == 55


@respx.mock
async def test_empty_search_is_a_miss_not_an_error(provider):
    list_route().mock(return_value=httpx.Response(200, json={"data": []}))

    assert await provider.lookup("Nothing realis", genus_only=False) is None


@respx.mock
async def test_details_failure_leaves_toxicity_unknown_not_safe(provider):
    list_route().mock(return_value=httpx.Response(200, json=LIST_HIT))
    details_route().mock(return_value=httpx.Response(500, json={}))

    record = await provider.lookup("Monstera deliciosa", genus_only=False)

    assert record is not None
    assert record.watering == "Average"  # list data still usable
    assert record.poisonous_to_pets is None  # unknown, never False
    assert record.poisonous_to_humans is None


@respx.mock
@pytest.mark.parametrize("status", [401, 403, 429, 500])
async def test_search_failures_degrade(provider, status):
    list_route().mock(return_value=httpx.Response(status, json={}))

    with pytest.raises(CareUnavailable):
        await provider.lookup("Monstera deliciosa", genus_only=False)


@respx.mock
async def test_timeout_degrades(provider):
    list_route().mock(side_effect=httpx.ReadTimeout("slow"))

    with pytest.raises(CareUnavailable):
        await provider.lookup("Monstera deliciosa", genus_only=False)


@respx.mock
async def test_sends_the_api_key(provider):
    mocked = list_route().mock(return_value=httpx.Response(200, json={"data": []}))

    await provider.lookup("Monstera deliciosa", genus_only=False)

    assert mocked.calls.last.request.url.params["key"] == "test-key"
    assert mocked.calls.last.request.url.params["q"] == "Monstera deliciosa"


@pytest.mark.parametrize(
    "value,expected",
    [
        (True, True),
        (False, False),
        (1, True),
        (0, False),
        ("1", True),
        ("0", False),
        ("yes", True),
        ("no", False),
        # Everything unrecognized must be unknown, never False.
        (None, None),
        ("", None),
        ("maybe", None),
        (2, None),
        ([], None),
        ({}, None),
    ],
)
def test_toxicity_parsing_never_guesses_safe(value, expected):
    assert parse_toxicity(value) is expected
