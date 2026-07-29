from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.deps import CurrentUser
from app.templating import templates

router = APIRouter()


@router.get("/")
async def home(request: Request, user: CurrentUser):
    return templates.TemplateResponse(request, "home.html", {"user": user})


@router.get("/healthz", include_in_schema=False)
async def healthz() -> JSONResponse:
    return JSONResponse({"status": "ok"})
