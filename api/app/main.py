from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routes import care, devices, identify, pages
from app.services.http import aclose_client


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await aclose_client()


# A proxy for two paid APIs, plus the shared species cache. It holds no user data:
# plants, waterings and photos all live on the device. There is no /media mount
# any more, because no photo is ever written here.
app = FastAPI(title="Perfect Bloom API", lifespan=lifespan)

app.include_router(pages.router)
app.include_router(devices.router)
app.include_router(identify.router)
app.include_router(care.router)
