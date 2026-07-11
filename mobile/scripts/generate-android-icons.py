"""Generate Android launcher + splash assets from public/brand icons."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC_CANDIDATES = [
    ROOT / "public" / "brand" / "icono.png",
    ROOT / "public" / "brand" / "icono-sin-fondo.png",
    ROOT / "icono.png",
]
RES = ROOT / "mobile" / "android" / "app" / "src" / "main" / "res"
RESOURCES = ROOT / "mobile" / "resources"

EMERALD = (4, 120, 87, 255)
SLATE = (248, 250, 252, 255)


def fit_square(
    im: Image.Image,
    size: int,
    bg: tuple[int, int, int, int] = SLATE,
    pad_ratio: float = 0.12,
) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg)
    inner = int(size * (1 - 2 * pad_ratio))
    icon = im.copy()
    icon.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - icon.width) // 2
    y = (size - icon.height) // 2
    canvas.paste(icon, (x, y), icon)
    return canvas


def main() -> None:
    src = next((p for p in SRC_CANDIDATES if p.exists()), None)
    if not src:
        raise SystemExit("No brand icon found in public/brand/")
    img = Image.open(src).convert("RGBA")

    mipmap_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    fg_sizes = {
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }

    for folder, size in mipmap_sizes.items():
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        icon = fit_square(img, size, bg=EMERALD, pad_ratio=0.14)
        icon.save(out_dir / "ic_launcher.png")
        icon.save(out_dir / "ic_launcher_round.png")

    for folder, size in fg_sizes.items():
        out_dir = RES / folder
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        inner = int(size * 0.58)
        icon = img.copy()
        icon.thumbnail((inner, inner), Image.Resampling.LANCZOS)
        x = (size - icon.width) // 2
        y = (size - icon.height) // 2
        canvas.paste(icon, (x, y), icon)
        canvas.save(out_dir / "ic_launcher_foreground.png")

    splash_folders = [
        "drawable",
        "drawable-port-mdpi",
        "drawable-port-hdpi",
        "drawable-port-xhdpi",
        "drawable-port-xxhdpi",
        "drawable-port-xxxhdpi",
        "drawable-land-mdpi",
        "drawable-land-hdpi",
        "drawable-land-xhdpi",
        "drawable-land-xxhdpi",
        "drawable-land-xxxhdpi",
    ]
    for folder in splash_folders:
        out_dir = RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        side = 480 if "xxx" in folder else 360 if "xx" in folder else 288 if "xhdpi" in folder else 240
        if folder == "drawable":
            side = 480
        splash = fit_square(img, side, bg=SLATE, pad_ratio=0.2)
        splash.save(out_dir / "splash.png")

    RESOURCES.mkdir(parents=True, exist_ok=True)
    fit_square(img, 1024, bg=EMERALD, pad_ratio=0.12).save(RESOURCES / "icon.png")
    fit_square(img, 2732, bg=SLATE, pad_ratio=0.35).save(RESOURCES / "splash.png")
    print(f"OK icons from {src}")


if __name__ == "__main__":
    main()
