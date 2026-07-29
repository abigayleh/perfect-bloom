from fastapi import APIRouter, HTTPException, status

from app.deps import RequiredToken, RequiredUser, SessionDep
from app.models import User
from app.schemas import LoginRequest, SignupRequest, TokenOut, UserOut
from app.services.accounts import AccountError, authenticate, create_account
from app.services.tokens import issue_token, revoke_token

router = APIRouter(prefix="/api/v1", tags=["auth"])


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, timezone=user.timezone)


@router.post("/auth/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest, session: SessionDep) -> TokenOut:
    try:
        user = await create_account(session, body.email, body.password, body.timezone)
    except AccountError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TokenOut(token=await issue_token(session, user), user=_user_out(user))


@router.post("/auth/login", response_model=TokenOut)
async def login(body: LoginRequest, session: SessionDep) -> TokenOut:
    user = await authenticate(session, body.email, body.password)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect.")
    return TokenOut(token=await issue_token(session, user), user=_user_out(user))


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(token: RequiredToken, session: SessionDep) -> None:
    await revoke_token(session, token)


@router.get("/me", response_model=UserOut)
async def me(user: RequiredUser) -> UserOut:
    return _user_out(user)
