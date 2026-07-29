from io import BytesIO

import pytest
from PIL import Image

from app.services.images import UploadRejected, process_upload, validate_upload
from app.services.images.validation import validate_batch, validate_size

ORIENTATION_TAG = 274
MAKE_TAG = 271
GPS_IFD_TAG = 34853


def jpeg_with_exif(width: int = 100, height: int = 50, orientation: int = 1) -> bytes:
    image = Image.new("RGB", (width, height), (10, 120, 60))
    exif = image.getexif()
    exif[ORIENTATION_TAG] = orientation
    exif[MAKE_TAG] = "PerfectBloomTestCamera"
    gps = exif.get_ifd(GPS_IFD_TAG)
    gps[1] = "N"
    gps[2] = (51.5, 30.0, 0.0)
    out = BytesIO()
    image.save(out, format="JPEG", exif=exif.tobytes())
    return out.getvalue()


async def test_strips_exif_including_gps():
    original = jpeg_with_exif()
    original_exif = Image.open(BytesIO(original)).getexif()
    assert original_exif[MAKE_TAG] == "PerfectBloomTestCamera"
    assert original_exif.get_ifd(GPS_IFD_TAG), "fixture must actually carry GPS"

    cleaned = await process_upload(original)

    cleaned_exif = Image.open(BytesIO(cleaned)).getexif()
    assert not dict(cleaned_exif)
    assert not cleaned_exif.get_ifd(GPS_IFD_TAG)


async def test_applies_orientation_before_stripping_it():
    # Orientation 6 means "rotate 90° to display" — dropping the tag without
    # applying it would leave the photo sideways.
    cleaned = await process_upload(jpeg_with_exif(100, 50, orientation=6))

    assert Image.open(BytesIO(cleaned)).size == (50, 100)


async def test_downscales_oversized_images():
    huge = Image.new("RGB", (4000, 3000))
    buffer = BytesIO()
    huge.save(buffer, format="JPEG")

    cleaned = await process_upload(buffer.getvalue())

    assert max(Image.open(BytesIO(cleaned)).size) == 2048


async def test_unreadable_bytes_are_rejected():
    with pytest.raises(UploadRejected):
        await process_upload(b"\xff\xd8\xff" + b"garbage" * 20)


def test_validate_upload_accepts_a_real_jpeg():
    validate_upload(jpeg_with_exif(), "image/jpeg")


@pytest.mark.parametrize(
    "data,content_type",
    [
        (b"", "image/jpeg"),
        (b"%PDF-1.7 not an image", "application/pdf"),
        (b"%PDF-1.7 lying about its type", "image/jpeg"),
    ],
)
def test_validate_upload_rejects(data, content_type):
    with pytest.raises(UploadRejected):
        validate_upload(data, content_type)


def test_validate_upload_rejects_oversized():
    with pytest.raises(UploadRejected):
        validate_upload(b"\xff\xd8\xff" + b"\x00" * (9 * 1024 * 1024), "image/jpeg")


def test_validate_size_rejects_before_reading():
    validate_size(None)  # unknown size is not grounds for rejection on its own
    validate_size(1024)
    with pytest.raises(UploadRejected):
        validate_size(9 * 1024 * 1024)


@pytest.mark.parametrize("count", [0, 6])
def test_validate_batch_rejects(count):
    with pytest.raises(UploadRejected):
        validate_batch(count)


# The storage tests went with storage itself: the server never writes a photo now,
# so there is no key to traverse and no /media mount to serve one from. EXIF
# stripping is still covered above, because it still runs before every forward.
