from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routes import auth, care, identify, pages, plants
from app.services.http import aclose_client

settings = get_settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await aclose_client()


app = FastAPI(title="Perfect Bloom API", lifespan=lifespan)

# Uploaded photos. Moves behind the storage interface's S3 backend in production.
app.mount("/media", StaticFiles(directory=settings.upload_dir), name="media")

app.include_router(pages.router)
app.include_router(auth.router)
app.include_router(identify.router)
app.include_router(care.router)
app.include_router(plants.router)
