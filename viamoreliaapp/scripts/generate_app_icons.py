"""Generate production launcher icons for Android/iOS/Web/Windows/macOS from brand logo."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "brand" / "icono-sin-fondo.png"

# Warm paper background (matches app paper UI)
BG = (250, 249, 246, 255)


def fit_logo(logo: Image.Image, canvas_size: int, pad_ratio: float = 0.14) -> Image.Image:
    """Place logo centered on transparent canvas with padding (adaptive safe zone)."""
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    max_side = int(canvas_size * (1 - 2 * pad_ratio))
    ratio = min(max_side / logo.width, max_side / logo.height)
    nw = max(1, int(logo.width * ratio))
    nh = max(1, int(logo.height * ratio))
    resized = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (canvas_size - nw) // 2
    y = (canvas_size - nh) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def with_bg(fg: Image.Image, color: tuple[int, int, int, int] = BG) -> Image.Image:
    out = Image.new("RGBA", fg.size, color)
    out.alpha_composite(fg)
    return out


def save_png(im: Image.Image, path: Path, *, solid: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if solid:
        im.convert("RGB").save(path, "PNG", optimize=True)
    else:
        im.save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)} {im.size}")


def main() -> None:
    logo = Image.open(SRC).convert("RGBA")
    android_res = ROOT / "android" / "app" / "src" / "main" / "res"

    print("=== masters ===")
    fg_1024 = fit_logo(logo, 1024, pad_ratio=0.12)
    full_1024 = with_bg(fg_1024)
    brand_dir = ROOT / "assets" / "brand"
    save_png(full_1024, brand_dir / "app-icon-1024.png", solid=True)
    save_png(fg_1024, brand_dir / "app-icon-foreground-1024.png")
    save_png(Image.new("RGBA", (1024, 1024), BG), brand_dir / "app-icon-background-1024.png", solid=True)

    print("=== android mipmaps ===")
    for folder, size in {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }.items():
        im = with_bg(fit_logo(logo, size, pad_ratio=0.10))
        save_png(im, android_res / folder / "ic_launcher.png", solid=True)
        save_png(im, android_res / folder / "ic_launcher_round.png", solid=True)

    print("=== android adaptive foreground ===")
    for density, size in {
        "drawable-mdpi": 108,
        "drawable-hdpi": 162,
        "drawable-xhdpi": 216,
        "drawable-xxhdpi": 324,
        "drawable-xxxhdpi": 432,
    }.items():
        save_png(
            fit_logo(logo, size, pad_ratio=0.18),
            android_res / density / "ic_launcher_foreground.png",
        )

    values = android_res / "values"
    values.mkdir(parents=True, exist_ok=True)
    colors = values / "colors.xml"
    colors.write_text(
        """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FAF9F6</color>
</resources>
""",
        encoding="utf-8",
    )
    print(f"  {colors.relative_to(ROOT)}")

    anydpi = android_res / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    adaptive_xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>
"""
    (anydpi / "ic_launcher.xml").write_text(adaptive_xml, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(adaptive_xml, encoding="utf-8")
    print("  adaptive xml written")

    manifest = ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
    m = manifest.read_text(encoding="utf-8")
    if "android:roundIcon" not in m:
        m = m.replace(
            'android:icon="@mipmap/ic_launcher"',
            'android:icon="@mipmap/ic_launcher"\n        android:roundIcon="@mipmap/ic_launcher_round"',
        )
        manifest.write_text(m, encoding="utf-8")
        print("  manifest roundIcon set")

    print("=== ios ===")
    ios_dir = ROOT / "ios" / "Runner" / "Assets.xcassets" / "AppIcon.appiconset"
    for name, size in [
        ("Icon-App-20x20@1x.png", 20),
        ("Icon-App-20x20@2x.png", 40),
        ("Icon-App-20x20@3x.png", 60),
        ("Icon-App-29x29@1x.png", 29),
        ("Icon-App-29x29@2x.png", 58),
        ("Icon-App-29x29@3x.png", 87),
        ("Icon-App-40x40@1x.png", 40),
        ("Icon-App-40x40@2x.png", 80),
        ("Icon-App-40x40@3x.png", 120),
        ("Icon-App-60x60@2x.png", 120),
        ("Icon-App-60x60@3x.png", 180),
        ("Icon-App-76x76@1x.png", 76),
        ("Icon-App-76x76@2x.png", 152),
        ("Icon-App-83.5x83.5@2x.png", 167),
        ("Icon-App-1024x1024@1x.png", 1024),
    ]:
        save_png(with_bg(fit_logo(logo, size, pad_ratio=0.10)), ios_dir / name, solid=True)

    print("=== web ===")
    web = ROOT / "web"
    for name, size, maskable in [
        ("icons/Icon-192.png", 192, False),
        ("icons/Icon-512.png", 512, False),
        ("icons/Icon-maskable-192.png", 192, True),
        ("icons/Icon-maskable-512.png", 512, True),
    ]:
        pad = 0.18 if maskable else 0.10
        save_png(with_bg(fit_logo(logo, size, pad_ratio=pad)), web / name, solid=True)
    save_png(with_bg(fit_logo(logo, 32, 0.08)), web / "favicon.png", solid=True)
    (web / "manifest.json").write_text(
        """{
    "name": "Vía Morelia",
    "short_name": "Vía Morelia",
    "start_url": ".",
    "display": "standalone",
    "background_color": "#FAF9F6",
    "theme_color": "#034A44",
    "description": "Transporte público de Morelia — origen y destino, ida y vuelta.",
    "orientation": "portrait-primary",
    "prefer_related_applications": false,
    "icons": [
        {
            "src": "icons/Icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "icons/Icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
        },
        {
            "src": "icons/Icon-maskable-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "maskable"
        },
        {
            "src": "icons/Icon-maskable-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "maskable"
        }
    ]
}
""",
        encoding="utf-8",
    )
    print("  web/manifest.json updated")

    print("=== windows ===")
    ico_path = ROOT / "windows" / "runner" / "resources" / "app_icon.ico"
    sizes_ico = [16, 32, 48, 64, 128, 256]
    largest = with_bg(fit_logo(logo, 256, 0.08)).convert("RGBA")
    largest.save(ico_path, format="ICO", sizes=[(s, s) for s in sizes_ico])
    print(f"  {ico_path.relative_to(ROOT)}")

    print("=== macos ===")
    mac = ROOT / "macos" / "Runner" / "Assets.xcassets" / "AppIcon.appiconset"
    for name, size in {
        "app_icon_16.png": 16,
        "app_icon_32.png": 32,
        "app_icon_64.png": 64,
        "app_icon_128.png": 128,
        "app_icon_256.png": 256,
        "app_icon_512.png": 512,
        "app_icon_1024.png": 1024,
    }.items():
        save_png(with_bg(fit_logo(logo, size, 0.10)), mac / name, solid=True)

    print("DONE")


if __name__ == "__main__":
    main()
