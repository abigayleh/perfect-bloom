import httpx
import pytest
import respx

from app.services.identify import IdentificationRejected, IdentificationUnavailable
from app.services.identify.plantnet import PlantNetIdentifier

HOST = "my-api.plantnet.org"
PATH = "/v2/identify/all"

PAYLOAD = {
    "results": [
        {
            "score": 0.8731,
            "species": {
                "scientificNameWithoutAuthor": "Monstera deliciosa",
                "scientificNameAuthorship": "Liebm.",
                "scientificName": "Monstera deliciosa Liebm.",
                "genus": {"scientificNameWithoutAuthor": "Monstera"},
                "family": {"scientificNameWithoutAuthor": "Araceae"},
                "commonNames": ["Swiss cheese plant", "Ceriman"],
            },
        },
        {"score": 0.02, "species": {}},  # unusable row — dropped, not crashed on
    ]
}


@pytest.fixture
def identifier():
    return PlantNetIdentifier("test-key", "https://my-api.plantnet.org/v2")


def route():
    return respx.route(method="POST", host=HOST, path=PATH)


@respx.mock
async def test_maps_results_and_strips_authorship(identifier):
    route().mock(return_value=httpx.Response(200, json=PAYLOAD))

    candidates = await identifier.identify([b"image-bytes"])

    assert len(candidates) == 1
    top = candidates[0]
    assert top.scientific_name == "Monstera deliciosa"  # authorship excluded
    assert top.common_names == ("Swiss cheese plant", "Ceriman")
    assert top.genus == "Monstera"
    assert top.family == "Araceae"
    assert top.confidence_percent == 87


@respx.mock
async def test_no_match_is_an_empty_list_not_an_error(identifier):
    route().mock(return_value=httpx.Response(404, json={"message": "Species not found"}))

    assert await identifier.identify([b"image-bytes"]) == []


@respx.mock
@pytest.mark.parametrize("status", [401, 403, 429, 500])
async def test_provider_failures_degrade(identifier, status):
    route().mock(return_value=httpx.Response(status, json={}))

    with pytest.raises(IdentificationUnavailable):
        await identifier.identify([b"image-bytes"])


@respx.mock
async def test_timeout_degrades(identifier):
    route().mock(side_effect=httpx.ReadTimeout("too slow"))

    with pytest.raises(IdentificationUnavailable):
        await identifier.identify([b"image-bytes"])


@respx.mock
async def test_unreadable_body_degrades(identifier):
    route().mock(return_value=httpx.Response(200, content=b"<html>not json</html>"))

    with pytest.raises(IdentificationUnavailable):
        await identifier.identify([b"image-bytes"])


@pytest.mark.parametrize("count", [0, 6])
async def test_image_count_is_enforced_before_any_call(identifier, count):
    with pytest.raises(IdentificationRejected):
        await identifier.identify([b"x"] * count)


@respx.mock
async def test_sends_every_image_with_the_api_key(identifier):
    mocked = route().mock(return_value=httpx.Response(200, json={"results": []}))

    await identifier.identify([b"one", b"two"])

    request = mocked.calls.last.request
    assert request.url.params["api-key"] == "test-key"
    assert request.content.count(b'name="images"') == 2
