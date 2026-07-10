"""
Escanea rutastransporte y genera data/rutastransporte-route-map.json.
Incluye combis (01) y foráneos (02). Omite coberturas y carpetas sin KML usable.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(".")
OUT = ROOT / "data" / "rutastransporte-route-map.json"
SCAN_DIRS = (
    ROOT / "rutastransporte" / "01_RUTAS_DE_COMBI",
    ROOT / "rutastransporte" / "02_RUTAS_DE_AUTOBUSES_FORANEOS",
)
SKIP_KEYWORDS = ("cobertura", "coberturas")

# Paleta resaltada (un poco más viva). Negra con casing claro en fix_route_colors.
COLOR_RULES: list[tuple[str, str]] = [
    ("negra", "#1A1A1A"),
    ("negro", "#1A1A1A"),
    ("amarilla", "#FFD000"),
    ("amarillo", "#FFD000"),
    ("roja", "#EF4444"),
    ("rojo", "#EF4444"),
    ("azul", "#1E88E5"),
    ("verde", "#43A047"),
    ("cafe", "#8D6E63"),
    ("café", "#8D6E63"),
    ("coral", "#FF7043"),
    ("crema", "#D4B483"),
    ("gris", "#8A8A8A"),
    ("guinda", "#C2185B"),
    ("rosa", "#EC407A"),
    ("dorado", "#F0B429"),
    ("naranja", "#FF9800"),
    ("morada", "#9C27B0"),
    ("morado", "#9C27B0"),
]


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    text = re.sub(r"-{2,}", "-", text)
    return text or "ruta"


def pick_color(name: str) -> str:
    low = name.lower()
    for key, color in COLOR_RULES:
        if key in low:
            return color
    return "#3b82f6"


def find_kml(folder: Path) -> Path | None:
    candidates: list[Path] = []
    for pattern in ("**/*.kml", "**/*.KML"):
        candidates.extend(folder.glob(pattern))
    if not candidates:
        return None
    # Preferir KML en subcarpeta KML*
    candidates.sort(
        key=lambda p: (
            0 if re.search(r"kml", p.parent.name, re.I) else 1,
            len(str(p)),
            str(p).lower(),
        )
    )
    return candidates[0]


def human_name(folder_name: str) -> str:
    # 10_CAFE_1 -> Cafe 1
    parts = folder_name.split("_", 1)
    label = parts[1] if len(parts) > 1 else folder_name
    label = label.replace("_", " ").strip()
    return label.title()


def transport_type(path: Path) -> str:
    if "FORANEOS" in str(path):
        return "foraneo"
    return "combi"


def scan() -> list[dict]:
    entries: list[dict] = []
    seen_ids: set[str] = set()

    for base in SCAN_DIRS:
        if not base.exists():
            continue
        for folder in sorted(base.iterdir()):
            if not folder.is_dir():
                continue
            folder_key = folder.name.lower()
            if any(k in folder_key for k in SKIP_KEYWORDS):
                continue
            kml = find_kml(folder)
            if kml is None:
                continue

            base_id = slugify(human_name(folder.name))
            route_id = f"ruta-{base_id}"
            suffix = 2
            while route_id in seen_ids:
                route_id = f"ruta-{base_id}-{suffix}"
                suffix += 1
            seen_ids.add(route_id)

            name = human_name(folder.name)
            entries.append(
                {
                    "routeId": route_id,
                    "routeName": f"Ruta {name}",
                    "color": pick_color(name),
                    "casingColor": "#222222",
                    "transportType": transport_type(folder),
                    "sourceKml": str(kml.relative_to(ROOT)).replace("\\", "/"),
                    "sourceFolder": str(folder.relative_to(ROOT)).replace("\\", "/"),
                }
            )
    return entries


def merge_existing(new_entries: list[dict]) -> list[dict]:
    if not OUT.exists():
        return new_entries
    existing = json.loads(OUT.read_text(encoding="utf-8"))
    by_kml = {e["sourceKml"]: e for e in existing}
    for entry in new_entries:
        prev = by_kml.get(entry["sourceKml"])
        if prev:
            entry["routeId"] = prev.get("routeId", entry["routeId"])
            entry["routeName"] = prev.get("routeName", entry["routeName"])
        by_kml[entry["sourceKml"]] = entry
    merged = list(by_kml.values())
    merged.sort(key=lambda e: e["routeId"])
    return merged


if __name__ == "__main__":
    entries = merge_existing(scan())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] {len(entries)} rutas -> {OUT}")