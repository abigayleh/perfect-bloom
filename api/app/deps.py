from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import User
from app.services.tokens import resolve_token

SessionDep = Annotated[AsyncSession, Depends(get_session)]

UNAUTHENTICATED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Sign in to continue.",
    headers={"WWW-Authenticate": "Bearer"},
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


async def get_current_user(session: SessionDep, token: TokenDep) -> User | None:
    if token is None:
        return None
    return await resolve_token(session, token)


CurrentUser = Annotated[User | None, Depends(get_current_user)]


async def require_user(user: CurrentUser) -> User:
    if user is None:
        raise UNAUTHENTICATED
    return user


RequiredUser = Annotated[User, Depends(require_user)]


async def require_token(token: TokenDep) -> str:
    if token is None:
        raise UNAUTHENTICATED
    return token


RequiredToken = Annotated[str, Depends(require_token)]
