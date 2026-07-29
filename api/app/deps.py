from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.models import Device
from app.services.devices import resolve_device, within_quota

SessionDep = Annotated[AsyncSession, Depends(get_session)]

UNKNOWN_DEVICE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="This app install isn't registered. Reopen the app to try again.",
    headers={"WWW-Authenticate": "Bearer"},
)

OVER_QUOTA = HTTPException(
    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
    detail="You've used today's lookups. Try again tomorrow.",
)


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str | None:
    """Pulls the token out of `Authorization: Bearer <token>`."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        return None
    return token.strip() or None


TokenDep = Annotated[str | None, Depends(bearer_token)]


async def metered_device(session: SessionDep, token: TokenDep) -> Device:
    """The only guard on the proxy: a known device, still inside today's quota.

    Resolving and metering are one dependency because both routes behind it spend
    third-party credits — there is no unmetered authenticated route that would
    want a plain resolver.
    """
    if token is None:
        raise UNKNOWN_DEVICE
    device = await resolve_device(session, token)
    if device is None:
        raise UNKNOWN_DEVICE
    if not await within_quota(session, device, get_settings().device_daily_call_limit):
        raise OVER_QUOTA
    return device


MeteredDevice = Annotated[Device, Depends(metered_device)]
