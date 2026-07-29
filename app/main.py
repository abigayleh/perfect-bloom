from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.deps import NotAuthenticated
from app.routes import auth, identify, pages
from app.services.http import aclose_client

settings = get_settings()
STATIC_DIR = Path(__file__).parent / "static"
settings.upload_dir.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await aclose_client()


app = FastAPI(title="perfect bloom", lifespan=lifespan)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    same_site="lax",
    https_only=not settings.is_dev,
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/media", StaticFiles(directory=settings.upload_dir), name="media")

app.include_router(pages.router)
app.include_router(auth.router)
app.include_router(identify.router)


@app.exception_handler(NotAuthenticated)
async def redirect_to_login(request: Request, exc: NotAuthenticated) -> Response:
    if request.headers.get("HX-Request"):
        return Response(status_code=204, headers={"HX-Redirect": "/login"})
    return RedirectResponse("/login", status_code=303)


@app.get("/sw.js", include_in_schema=False)
async def service_worker() -> FileResponse:
    """Served from the root so the worker's scope covers the whole origin."""
    return FileResponse(
        STATIC_DIR / "sw.js",
        media_type="text/javascript",
        headers={"Service-Worker-Allowed": "/"},
    )
