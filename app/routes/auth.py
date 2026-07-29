from typing import Annotated
from zoneinfo import available_timezones

from fastapi import APIRouter, Form, Request
from fastapi.responses import RedirectResponse

from app.deps import SessionDep, login_user
from app.services.accounts import AccountError, authenticate, create_account
from app.templating import templates

router = APIRouter()

TIMEZONES = sorted(available_timezones())


@router.get("/signup")
async def signup_form(request: Request):
    return templates.TemplateResponse(request, "signup.html", {"timezones": TIMEZONES, "email": ""})


@router.post("/signup")
async def signup(
    request: Request,
    session: SessionDep,
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
    timezone: Annotated[str, Form()] = "UTC",
):
    try:
        user = await create_account(session, email, password, timezone)
    except AccountError as exc:
        return templates.TemplateResponse(
            request,
            "signup.html",
            {"timezones": TIMEZONES, "email": email, "error": str(exc)},
            status_code=400,
        )
    login_user(request, user)
    return RedirectResponse("/", status_code=303)


@router.get("/login")
async def login_form(request: Request):
    return templates.TemplateResponse(request, "login.html", {"email": ""})


@router.post("/login")
async def login(
    request: Request,
    session: SessionDep,
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
):
    user = await authenticate(session, email, password)
    if user is None:
        return templates.TemplateResponse(
            request,
            "login.html",
            {"email": email, "error": "Email or password is incorrect."},
            status_code=401,
        )
    login_user(request, user)
    return RedirectResponse("/", status_code=303)


@router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse("/", status_code=303)
