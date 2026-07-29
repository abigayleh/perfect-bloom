import hashlib
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Device
from app.models.base import utcnow

TOKEN_BYTES = 32


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def register_device(session: AsyncSession) -> str:
    """Issue a token for a fresh install. Plaintext is returned once, never stored.

    Deliberately unauthenticated — there is no identity to prove yet. That does
    mean registration itself is unmetered: someone determined can re-register to
    reset their quota. The quota stops accidental and casual abuse and gives a
    revocation handle; it is not a defence against a motivated attacker. Rate
    limiting this route per IP is the next step if that ever matters.
    """
    token = secrets.token_urlsafe(TOKEN_BYTES)
    session.add(Device(token_hash=hash_token(token)))
    await session.commit()
    return token


async def resolve_device(session: AsyncSession, token: str) -> Device | None:
    if not token:
        return None
    result = await session.execute(select(Device).where(Device.token_hash == hash_token(token)))
    return result.scalar_one_or_none()


async def within_quota(session: AsyncSession, device: Device, limit: int) -> bool:
    """Count one proxied call against today's allowance.

    A cache hit still costs a request, so it still counts — one posture is easier
    to reason about than exempting the paths that happen to be cheap today.
    """
    today = utcnow().date().isoformat()
    if device.quota_day != today:
        device.quota_day = today
        device.quota_used = 0

    if device.quota_used >= limit:
        return False

    device.quota_used += 1
    await session.commit()
    return True
