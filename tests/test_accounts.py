import pytest

from app.security import hash_password, verify_password
from app.services.accounts import (
    AccountError,
    authenticate,
    create_account,
    normalize_email,
    signup_problem,
)

GOOD_PASSWORD = "correct-horse-battery"


async def test_creates_and_authenticates(session):
    user = await create_account(session, "Ada@Example.com ", GOOD_PASSWORD, "Europe/London")

    assert user.email == "ada@example.com"
    assert GOOD_PASSWORD not in user.password_hash
    assert await authenticate(session, "ada@example.com", GOOD_PASSWORD) is not None


async def test_rejects_wrong_password_and_unknown_email(session):
    await create_account(session, "ada@example.com", GOOD_PASSWORD, "UTC")

    assert await authenticate(session, "ada@example.com", "wrong-password-here") is None
    assert await authenticate(session, "nobody@example.com", GOOD_PASSWORD) is None


async def test_duplicate_email_is_rejected(session):
    await create_account(session, "ada@example.com", GOOD_PASSWORD, "UTC")

    with pytest.raises(AccountError):
        await create_account(session, "ADA@example.com", GOOD_PASSWORD, "UTC")


@pytest.mark.parametrize(
    "email,password,timezone",
    [
        ("not-an-email", GOOD_PASSWORD, "UTC"),
        ("ada@example.com", "short", "UTC"),
        ("ada@example.com", GOOD_PASSWORD, "Mars/Olympus_Mons"),
        ("ada@example.com", GOOD_PASSWORD, "GMT+5"),
    ],
)
def test_signup_problems(email, password, timezone):
    assert signup_problem(email, password, timezone) is not None


def test_accepts_a_real_iana_zone():
    assert signup_problem("ada@example.com", GOOD_PASSWORD, "America/Halifax") is None


def test_normalize_email():
    assert normalize_email("  Ada@Example.COM ") == "ada@example.com"


def test_password_hash_round_trip():
    stored = hash_password(GOOD_PASSWORD)
    assert verify_password(stored, GOOD_PASSWORD)
    assert not verify_password(stored, GOOD_PASSWORD + "x")
    assert not verify_password("not-a-hash", GOOD_PASSWORD)
