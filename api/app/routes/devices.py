from fastapi import APIRouter, status

from app.deps import SessionDep
from app.schemas import DeviceOut
from app.services.devices import register_device

router = APIRouter(prefix="/api/v1", tags=["devices"])


@router.post("/devices", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def create(session: SessionDep) -> DeviceOut:
    """Issue a token to a fresh install, once, with no credentials involved.

    The app calls this the first time it needs the proxy and keeps the token in
    secure storage. Nothing personal is submitted or stored.
    """
    return DeviceOut(token=await register_device(session))
