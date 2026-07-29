from fastapi import APIRouter, HTTPException, status

from app.deps import RequiredUser, SessionDep
from app.models import Plant
from app.schemas import PlantCreate, PlantOut, PlantUpdate
from app.services.images import get_storage
from app.services.images.storage import is_safe_key
from app.services.plants import (
    PlantError,
    create_plant,
    delete_plant,
    get_plant,
    list_plants,
    update_plant,
)

router = APIRouter(prefix="/api/v1/plants", tags=["plants"])

NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, detail="Plant not found.")


def _to_out(plant: Plant) -> PlantOut:
    storage = get_storage()
    return PlantOut(
        id=plant.id,
        nickname=plant.nickname,
        scientific_name=plant.scientific_name,
        common_name=plant.common_name,
        image_url=storage.url(plant.image_key) if plant.image_key else None,
        interval_days=plant.interval_days,
        created_at=plant.created_at,
    )


@router.post("", response_model=PlantOut, status_code=status.HTTP_201_CREATED)
async def create(body: PlantCreate, user: RequiredUser, session: SessionDep) -> PlantOut:
    if body.image_key is not None and not is_safe_key(body.image_key):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="That photo reference is invalid.")
    try:
        plant = await create_plant(
            session,
            user,
            scientific_name=body.scientific_name,
            nickname=body.nickname,
            common_name=body.common_name,
            image_key=body.image_key,
            interval_days=body.interval_days,
        )
    except PlantError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_out(plant)


@router.get("", response_model=list[PlantOut])
async def index(user: RequiredUser, session: SessionDep) -> list[PlantOut]:
    return [_to_out(plant) for plant in await list_plants(session, user)]


@router.get("/{plant_id}", response_model=PlantOut)
async def show(plant_id: int, user: RequiredUser, session: SessionDep) -> PlantOut:
    plant = await get_plant(session, user, plant_id)
    if plant is None:
        raise NOT_FOUND
    return _to_out(plant)


@router.patch("/{plant_id}", response_model=PlantOut)
async def update(
    plant_id: int, body: PlantUpdate, user: RequiredUser, session: SessionDep
) -> PlantOut:
    try:
        plant = await update_plant(
            session,
            user,
            plant_id,
            nickname=body.nickname,
            interval_days=body.interval_days,
            clear_interval=body.clear_interval,
        )
    except PlantError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if plant is None:
        raise NOT_FOUND
    return _to_out(plant)


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def destroy(plant_id: int, user: RequiredUser, session: SessionDep) -> None:
    if not await delete_plant(session, user, plant_id):
        raise NOT_FOUND
