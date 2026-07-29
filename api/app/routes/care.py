from fastapi import APIRouter, HTTPException, Query, status

from app.deps import MeteredDevice, SessionDep
from app.schemas import CareResponse
from app.services.care import CareError, get_care_provider, resolve_care
from app.services.care.lookup import CareResult

router = APIRouter(prefix="/api/v1", tags=["care"])


def _to_response(result: CareResult) -> CareResponse:
    return CareResponse(
        requested_name=result.requested_name,
        normalized_name=result.normalized_name,
        match_kind=result.match_kind,
        matched_name=result.matched_name,
        common_name=result.common_name,
        watering=result.watering,
        sunlight=list(result.sunlight),
        cycle=result.cycle,
        poisonous_to_pets=result.poisonous_to_pets,
        poisonous_to_humans=result.poisonous_to_humans,
        toxicity_known=result.toxicity_known,
        from_cache=result.from_cache,
    )


@router.get("/care", response_model=CareResponse)
async def care(
    device: MeteredDevice,
    session: SessionDep,
    scientific_name: str = Query(min_length=2, max_length=255),
) -> CareResponse:
    """Care data for a scientific name, cache-first.

    A species with no care data is a 200 with match_kind "none" — not an error.
    That distinction matters: the client saves the plant either way and lets the
    user set their own interval.
    """
    try:
        result = await resolve_care(session, scientific_name, get_care_provider())
    except CareError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    if result is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="That doesn't look like a plant name."
        )
    return _to_response(result)
