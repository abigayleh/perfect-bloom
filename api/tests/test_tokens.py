from datetime import timedelta

from app.models import AuthToken
from app.models.base import utcnow
from app.services.accounts import create_account
from app.services.tokens import hash_token, issue_token, resolve_token, revoke_token

PASSWORD = "correct-horse-battery"


async def make_user(session, email="ada@example.com"):
    return await create_account(session, email, PASSWORD, "Europe/London")


async def test_issued_token_resolves_to_its_owner(session):
    user = await make_user(session)

    token = await issue_token(session, user)
    resolved = await resolve_token(session, token)

    assert resolved is not None
    assert resolved.id == user.id


async def test_plaintext_token_is_never_stored(session):
    user = await make_user(session)

    token = await issue_token(session, user)

    stored = await session.get(AuthToken, 1)
    assert stored.token_hash != token
    assert stored.token_hash == hash_token(token)


async def test_unknown_token_resolves_to_nothing(session):
    await make_user(session)

    assert await resolve_token(session, "not-a-real-token") is None
    assert await resolve_token(session, "") is None


async def test_expired_token_is_refused(session):
    user = await make_user(session)
    token = await issue_token(session, user)

    stored = await session.get(AuthToken, 1)
    stored.expires_at = utcnow() - timedelta(seconds=1)
    await session.commit()

    assert await resolve_token(session, token) is None


async def test_revoked_token_stops_working(session):
    user = await make_user(session)
    token = await issue_token(session, user)

    await revoke_token(session, token)

    assert await resolve_token(session, token) is None


async def test_revoking_an_unknown_token_is_not_an_error(session):
    await revoke_token(session, "never-existed")


async def test_tokens_are_unique_per_issue(session):
    user = await make_user(session)

    assert await issue_token(session, user) != await issue_token(session, user)


async def test_revoking_one_device_leaves_the_other_signed_in(session):
    user = await make_user(session)
    phone = await issue_token(session, user)
    tablet = await issue_token(session, user)

    await revoke_token(session, phone)

    assert await resolve_token(session, tablet) is not None
