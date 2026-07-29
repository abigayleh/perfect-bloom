import hashlib
import secrets
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuthToken, User
from app.models.base import utcnow

TOKEN_BYTES = 32
TOKEN_TTL = timedelta(days=90)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def issue_token(session: AsyncSession, user: User) -> str:
    """Returns the plaintext token. It is never stored and never recoverable."""
    token = secrets.token_urlsafe(TOKEN_BYTES)
    session.add(
        AuthToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=utcnow() + TOKEN_TTL,
        )
    )
    await session.commit()
    return token


async def resolve_token(session: AsyncSession, token: str) -> User | None:
    """Returns the owner of a live token, or None if it is unknown or expired."""
    if not token:
        return None
    result = await session.execute(
        select(AuthToken).where(AuthToken.token_hash == hash_token(token))
    )
    stored = result.scalar_one_or_none()
    if stored is None or stored.expires_at <= utcnow():
        return None
    return await session.get(User, stored.user_id)


async def revoke_token(session: AsyncSession, token: str) -> None:
    """Logout. Idempotent — revoking an unknown token is not an error."""
    await session.execute(delete(AuthToken).where(AuthToken.token_hash == hash_token(token)))
    await session.commit()
