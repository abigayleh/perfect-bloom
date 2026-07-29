import pytest

from app.models import Device
from app.services.devices import hash_token, register_device, resolve_device, within_quota


async def test_registration_returns_a_token_that_resolves(session):
    token = await register_device(session)

    assert token
    device = await resolve_device(session, token)
    assert device is not None


async def test_the_plaintext_token_is_never_stored(session):
    token = await register_device(session)

    device = await resolve_device(session, token)
    assert device.token_hash != token
    assert device.token_hash == hash_token(token)


@pytest.mark.parametrize("token", ["", "not-a-real-token"])
async def test_an_unknown_token_resolves_to_nothing(session, token):
    await register_device(session)

    assert await resolve_device(session, token) is None


async def test_each_registration_is_a_distinct_device(session):
    first = await register_device(session)
    second = await register_device(session)

    assert first != second
    assert (await resolve_device(session, first)).id != (await resolve_device(session, second)).id


async def test_a_device_holds_no_personal_data():
    # The guard on the whole point of this table: it must stay anonymous.
    assert set(Device.__table__.columns.keys()) == {
        "id",
        "token_hash",
        "created_at",
        "quota_day",
        "quota_used",
    }


async def test_quota_allows_up_to_the_limit_then_refuses(session):
    device = await resolve_device(session, await register_device(session))

    assert [await within_quota(session, device, 3) for _ in range(3)] == [True, True, True]
    assert await within_quota(session, device, 3) is False


async def test_quota_resets_on_a_new_day(session):
    device = await resolve_device(session, await register_device(session))
    await within_quota(session, device, 1)
    assert await within_quota(session, device, 1) is False

    # A new UTC day resets on first use rather than needing a scheduled job.
    device.quota_day = "2000-01-01"

    assert await within_quota(session, device, 1) is True


async def test_devices_do_not_share_a_quota(session):
    first = await resolve_device(session, await register_device(session))
    second = await resolve_device(session, await register_device(session))

    await within_quota(session, first, 1)

    assert await within_quota(session, first, 1) is False
    assert await within_quota(session, second, 1) is True
