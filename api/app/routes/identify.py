from fastapi import APIRouter, HTTPException, UploadFile, status

from app.deps import MeteredDevice
from app.schemas import AttributionOut, CandidateOut, IdentifyResponse
from app.services.identify import IdentificationError, get_identifier
from app.services.identify.base import Attribution, Candidate
from app.services.images import (
    UploadRejected,
    process_upload,
    validate_batch,
    validate_size,
    validate_upload,
)

router = APIRouter(prefix="/api/v1", tags=["identify"])


def _candidate_out(candidate: Candidate) -> CandidateOut:
    return CandidateOut(
        scientific_name=candidate.scientific_name,
        common_names=list(candidate.common_names),
        score=candidate.score,
        confidence_percent=candidate.confidence_percent,
        genus=candidate.genus,
        family=candidate.family,
    )


def _attribution_out(attribution: Attribution | None) -> AttributionOut | None:
    if attribution is None:
        return None
    return AttributionOut(
        text=attribution.text, url=attribution.url, logo_path=attribution.logo_path
    )


@router.post("/identify", response_model=IdentifyResponse)
async def identify(device: MeteredDevice, images: list[UploadFile]) -> IdentifyResponse:
    """Forward photos to the provider and return taxonomy. Nothing is stored.

    EXIF is still stripped unconditionally before anything leaves this process —
    the photo is about to reach a third party, and phone photos carry GPS. A
    provider outage is a 503 the client can explain, never an unhandled 500.
    """
    identifier = get_identifier()

    try:
        validate_batch(len(images))
        processed = []
        for upload in images:
            validate_size(upload.size)  # before reading it into memory
            data = await upload.read()
            validate_upload(data, upload.content_type)
            processed.append(await process_upload(data))
    except UploadRejected as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    try:
        candidates = await identifier.identify(processed)
    except IdentificationError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return IdentifyResponse(
        candidates=[_candidate_out(c) for c in candidates],
        attribution=_attribution_out(identifier.attribution),
    )
