from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import User

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class NotAuthenticated(Exception):
    """Handled app-wide as a redirect to /login (or HX-Redirect for HTMX requests)."""


async def get_current_user(request: Request, session: SessionDep) -> User | None:
    user_id = request.session.get("user_id")
    if user_id is None:
        return None
    return await session.get(User, user_id)


CurrentUser = Annotated[User | None, Depends(get_current_user)]


async def require_user(user: CurrentUser) -> User:
    if user is None:
        raise NotAuthenticated
    return user


RequiredUser = Annotated[User, Depends(require_user)]


def login_user(request: Request, user: User) -> None:
    request.session.clear()  # new session id per login, so a fixated cookie is useless
    request.session["user_id"] = user.id
