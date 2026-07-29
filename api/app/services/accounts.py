import re
from functools import lru_cache
from zoneinfo import available_timezones

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.security import hash_password, needs_rehash, password_problem, verify_password

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AccountError(ValueError):
    """A signup/login failure with a message safe to show the user."""


@lru_cache
def _dummy_hash() -> str:
    return hash_password("no-such-account-timing-equalizer")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def valid_timezone(name: str) -> bool:
    return name in available_timezones()


def signup_problem(email: str, password: str, timezone: str) -> str | None:
    if not _EMAIL_RE.match(email):
        return "That doesn't look like an email address."
    if problem := password_problem(password):
        return problem
    if not valid_timezone(timezone):
        return "Pick a time zone so reminders arrive at noon where you are."
    return None


async def create_account(session: AsyncSession, email: str, password: str, timezone: str) -> User:
    email = normalize_email(email)
    if problem := signup_problem(email, password, timezone):
        raise AccountError(problem)

    user = User(email=email, password_hash=hash_password(password), timezone=timezone)
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AccountError("That email is already registered.") from exc
    return user


async def update_timezone(session: AsyncSession, user: User, timezone: str) -> User:
    """Keeps due dates honest when someone travels — the domain rule says a user
    who moves zones gets noon in the new one."""
    if not valid_timezone(timezone):
        raise AccountError("That isn't a recognised time zone.")
    user.timezone = timezone
    await session.commit()
    return user


async def authenticate(session: AsyncSession, email: str, password: str) -> User | None:
    """Returns the user, or None. Never distinguishes unknown-email from wrong-password."""
    result = await session.execute(select(User).where(User.email == normalize_email(email)))
    user = result.scalar_one_or_none()
    if user is None:
        # Do the same work anyway, so response timing doesn't leak which emails exist.
        verify_password(_dummy_hash(), password)
        return None
    if not verify_password(user.password_hash, password):
        return None
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        await session.commit()
    return user
