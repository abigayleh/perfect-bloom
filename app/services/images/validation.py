from app.config import get_settings

ALLOWED_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})

# Leading bytes we accept. Checked because a client-supplied content type is a hint,
# not a fact, and these bytes are about to be sent to a third party.
_MAGIC_PREFIXES: tuple[bytes, ...] = (
    b"\xff\xd8\xff",  # JPEG
    b"\x89PNG\r\n\x1a\n",  # PNG
)


class UploadRejected(ValueError):
    """An upload that must not reach processing, storage, or any provider."""


def _is_webp(data: bytes) -> bool:
    return data[:4] == b"RIFF" and data[8:12] == b"WEBP"


def validate_size(size: int | None) -> None:
    """Checked against the declared part size first, so an oversized upload is
    rejected before it is read into memory."""
    settings = get_settings()
    if size is not None and size > settings.max_upload_bytes:
        limit_mb = settings.max_upload_bytes // (1024 * 1024)
        raise UploadRejected(f"Images must be under {limit_mb} MB.")


def validate_upload(data: bytes, content_type: str | None) -> None:
    """Content type, size and magic bytes, checked before anything touches the image."""
    if not data:
        raise UploadRejected("That file was empty.")
    validate_size(len(data))
    if (content_type or "").split(";")[0].strip().lower() not in ALLOWED_CONTENT_TYPES:
        raise UploadRejected("Please upload a JPEG, PNG, or WebP image.")
    if not (data.startswith(_MAGIC_PREFIXES) or _is_webp(data)):
        raise UploadRejected("That file doesn't look like an image.")


def validate_batch(count: int) -> None:
    settings = get_settings()
    if count < 1:
        raise UploadRejected("Add at least one photo.")
    if count > settings.max_upload_images:
        raise UploadRejected(f"Up to {settings.max_upload_images} photos of the same plant.")
