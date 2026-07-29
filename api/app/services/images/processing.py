from io import BytesIO

import anyio
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import get_settings
from app.services.images.validation import UploadRejected

JPEG_QUALITY = 88


def _process(data: bytes) -> bytes:
    """Re-encode to JPEG, dropping every metadata block including GPS.

    Orientation is *applied* first via exif_transpose — stripping EXIF without
    baking in the rotation would leave phone photos sideways.
    """
    try:
        image = Image.open(BytesIO(data))
        image = ImageOps.exif_transpose(image)
    except (UnidentifiedImageError, OSError) as exc:
        raise UploadRejected("That image couldn't be read.") from exc

    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    limit = get_settings().max_image_dimension
    image.thumbnail((limit, limit))

    out = BytesIO()
    # Pillow only writes EXIF when explicitly passed exif=, so this output has none.
    image.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue()


async def process_upload(data: bytes) -> bytes:
    """Strip metadata and normalize to JPEG. CPU-bound, so it runs off the event loop."""
    return await anyio.to_thread.run_sync(_process, data)
