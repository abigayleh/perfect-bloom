import logging

from fastapi import APIRouter, Request, UploadFile

from app.deps import RequiredUser
from app.services.identify import IdentificationError, get_identifier
from app.services.images import (
    UploadRejected,
    get_storage,
    process_upload,
    validate_batch,
    validate_size,
    validate_upload,
)
from app.templating import templates

log = logging.getLogger(__name__)
router = APIRouter()


@router.get("/identify")
async def identify_form(request: Request, user: RequiredUser):
    return templates.TemplateResponse(request, "identify.html", {"user": user})


@router.post("/identify")
async def identify(request: Request, user: RequiredUser, images: list[UploadFile]):
    """HTMX target. Always returns the results partial — errors render, they don't 500."""

    identifier = get_identifier()

    def problem(message: str, status: int = 400):
        return templates.TemplateResponse(
            request,
            "partials/candidates.html",
            {"error": message, "attribution": identifier.attribution},
            status_code=status,
        )

    try:
        validate_batch(len(images))
        processed = []
        for upload in images:
            validate_size(upload.size)  # before reading it into memory
            data = await upload.read()
            validate_upload(data, upload.content_type)
            processed.append(await process_upload(data))
    except UploadRejected as exc:
        return problem(str(exc))

    try:
        candidates = await identifier.identify(processed)
    except IdentificationError as exc:
        return problem(str(exc), status=503)

    storage = get_storage()
    image_url = storage.url(await storage.save(processed[0]))

    return templates.TemplateResponse(
        request,
        "partials/candidates.html",
        {
            "candidates": candidates,
            "image_url": image_url,
            "attribution": identifier.attribution,
        },
    )
