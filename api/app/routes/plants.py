from datetime import datetime

from fastapi import APIRouter, HTTPException, status

from app.deps import RequiredUser, SessionDep
from app.models import Plant, User
from app.models.base import utcnow
from app.schemas import PlantCreate, PlantOut, PlantUpdate, WateringCreate, WateringOut
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
from app.services.schedule import compute_schedule
from app.services.waterings import (
    WateringError,
    last_watered_at,
    last_watered_for,
    log_watering,
    watering_history,
)

router = APIRouter(prefix="/api/v1/plants", tags=["plants"])

NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, detail="Plant not found.")


def _to_out(plant: Plant, user: User, watered: datetime | None = None) -> PlantOut:
    storage = get_storage()
    schedule = compute_schedule(
        interval_days=plant.interval_days,
        last_watered_at=watered,
        created_at=plant.created_at,
        timezone=user.timezone,
        now=utcnow(),
    )
    return PlantOut(
        id=plant.id,
        nickname=plant.nickname,
        scientific_name=plant.scientific_name,
        common_name=plant.common_name,
        image_url=storage.url(plant.image_key) if plant.image_key else None,
        interval_days=plant.interval_days,
        created_at=plant.created_at,
        last_watered_at=schedule.last_watered_at,
        next_due_on=schedule.next_due_on,
        days_until_due=schedule.days_until_due,
        is_due=schedule.is_due,
        anchor=schedule.anchor,
    )


async def _load(session, user: User, plant_id: int) -> Plant:
    plant = await get_plant(session, user, plant_id)
    if plant is None:
        raise NOT_FOUND
    return plant


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
    return _to_out(plant, user)


@router.get("", response_model=list[PlantOut])
async def index(user: RequiredUser, session: SessionDep) -> list[PlantOut]:
    plants = await list_plants(session, user)
    # One aggregate query for the whole collection rather than one per plant.
    watered = await last_watered_for(session, [plant.id for plant in plants])
    return [_to_out(plant, user, watered.get(plant.id)) for plant in plants]


@router.get("/{plant_id}", response_model=PlantOut)
async def show(plant_id: int, user: RequiredUser, session: SessionDep) -> PlantOut:
    plant = await _load(session, user, plant_id)
    return _to_out(plant, user, await last_watered_at(session, plant_id))


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
    return _to_out(plant, user, await last_watered_at(session, plant_id))


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def destroy(plant_id: int, user: RequiredUser, session: SessionDep) -> None:
    if not await delete_plant(session, user, plant_id):
        raise NOT_FOUND


@router.post("/{plant_id}/waterings", response_model=PlantOut, status_code=status.HTTP_201_CREATED)
async def water(
    plant_id: int, body: WateringCreate, user: RequiredUser, session: SessionDep
) -> PlantOut:
    """Log a watering and hand back the re-anchored schedule."""
    plant = await _load(session, user, plant_id)
    try:
        await log_watering(session, plant, watered_at=body.watered_at)
    except WateringError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_out(plant, user, await last_watered_at(session, plant_id))


@router.get("/{plant_id}/waterings", response_model=list[WateringOut])
async def waterings(plant_id: int, user: RequiredUser, session: SessionDep) -> list[WateringOut]:
    await _load(session, user, plant_id)
    return [
        WateringOut(id=event.id, plant_id=event.plant_id, watered_at=event.watered_at)
        for event in await watering_history(session, plant_id)
    ]
