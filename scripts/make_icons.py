"""Generate the placeholder PWA icons in app/static/icons.

Placeholder art — replace with a designed mark before launch. Kept as a script so
the committed PNGs aren't unexplained binaries.

    uv run python scripts/make_icons.py
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

GREEN = (47, 107, 70, 255)
CREAM = (248, 247, 243, 255)
OUT = Path(__file__).resolve().parent.parent / "app" / "static" / "icons"


def leaf_mask(size: int, inset: float) -> Image.Image:
    """Two horizontally offset circles intersect in a pointed lens — a leaf, tilted 45°."""
    offset = size * 0.55
    left_x = -offset / 2
    left = Image.new("L", (size, size), 0)
    ImageDraw.Draw(left).ellipse([left_x, 0, left_x + size, size], fill=255)
    right = Image.new("L", (size, size), 0)
    ImageDraw.Draw(right).ellipse([left_x + offset, 0, left_x + offset + size, size], fill=255)

    lens = ImageChops.multiply(left, right).rotate(-45, resample=Image.BICUBIC)
    scaled = lens.resize((int(size * (1 - inset)),) * 2, Image.LANCZOS)
    canvas = Image.new("L", (size, size), 0)
    margin = (size - scaled.width) // 2
    canvas.paste(scaled, (margin, margin))
    return canvas


def icon(size: int, inset: float) -> Image.Image:
    image = Image.new("RGBA", (size, size), GREEN)
    image.paste(Image.new("RGBA", (size, size), CREAM), mask=leaf_mask(size, inset))
    return image


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    # Maskable icons get extra inset so nothing is lost to the platform's mask.
    for name, size, inset in [
        ("icon-192.png", 192, 0.30),
        ("icon-512.png", 512, 0.30),
        ("icon-maskable-512.png", 512, 0.45),
    ]:
        icon(size, inset).save(OUT / name)
        print(f"wrote {OUT / name}")
