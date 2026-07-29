import pytest

from app.config import Settings
from app.services.identify import (
    FakeIdentifier,
    PlantNetIdentifier,
    build_identifier,
)
from app.services.identify.plantnet import PLANTNET_ATTRIBUTION


def test_selects_provider_from_config():
    assert isinstance(build_identifier(Settings(identify_provider="fake")), FakeIdentifier)

    plantnet = build_identifier(Settings(identify_provider="plantnet", plantnet_api_key="k"))
    assert isinstance(plantnet, PlantNetIdentifier)


def test_unknown_provider_is_a_config_error():
    with pytest.raises(ValueError):
        build_identifier(Settings(identify_provider="nope"))


def test_plantnet_requires_a_key():
    with pytest.raises(ValueError):
        Settings(identify_provider="plantnet", plantnet_api_key="")


def test_plantnet_carries_required_attribution():
    assert PLANTNET_ATTRIBUTION.text
    assert PLANTNET_ATTRIBUTION.url


def test_fake_provider_credits_nobody():
    # It never calls PlantNet, so it must not claim PlantNet identified anything.
    assert FakeIdentifier.attribution is None


async def test_fake_provider_is_deterministic():
    identifier = FakeIdentifier()

    assert await identifier.identify([b"leaf"]) == await identifier.identify([b"leaf"])
