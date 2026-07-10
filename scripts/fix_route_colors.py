"""
Corrige y resalta colores de rutas publicadas.

- Negra 1/2 → negro real (visible en mapa con casing claro)
- Rutas con color erróneo (#3b82f6 genérico u otros) → color de familia por nombre
- Toda la paleta un poco más viva (resaltada)

Actualiza: public/routes/index.json, data/rutastransporte-route-map.json,
geojson public/processed/matched, y QA summary si existe.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Paleta resaltada (un poco más viva que la anterior)
# (color, casing, colorName)
FAMILY: dict[str, tuple[str, str, str]] = {
    "amarilla": ("#FFD000", "#222222", "Amarillo"),
    "amarillo": ("#FFD000", "#222222", "Amarillo"),
    "roja": ("#EF4444", "#222222", "Rojo"),
    "rojo": ("#EF4444", "#222222", "Rojo"),
    "azul": ("#1E88E5", "#0D47A1", "Azul"),
    "verde": ("#43A047", "#1B5E20", "Verde"),
    "cafe": ("#8D6E63", "#3E2723", "Café"),
    "café": ("#8D6E63", "#3E2723", "Café"),
    "coral": ("#FF7043", "#BF360C", "Coral"),
    "crema": ("#D4B483", "#5D4037", "Crema"),
    "gris": ("#8A8A8A", "#212121", "Gris"),
    "guinda": ("#C2185B", "#4A0026", "Guinda"),
    "rosa": ("#EC407A", "#880E4F", "Rosa"),
    "dorado": ("#F0B429", "#5D4037", "Dorado"),
    "naranja": ("#FF9800", "#E65100", "Naranja"),
    "morada": ("#9C27B0", "#4A148C", "Morado"),
    "morado": ("#9C27B0", "#4A148C", "Morado"),
    # Combis negras: negro grafito + casing claro para que se vea en mapa blanco
    "negra": ("#1A1A1A", "#F5F5F5", "Negro"),
    "negro": ("#1A1A1A", "#F5F5F5", "Negro"),
}

# Casos especiales por id o palabras en el nombre
SPECIAL: dict[str, tuple[str, str, str]] = {
    "ruta-paloma-azul-arquito": FAMILY["azul"],
    "ruta-paloma-azul-campina": FAMILY["azul"],
    "ruta-paloma-azul-zimpanio": FAMILY["azul"],
    "ruta-oro-verde-encinos": FAMILY["verde"],
    "ruta-oro-verde-soledad": FAMILY["verde"],
    "ruta-oro-verde-trincheras": FAMILY["verde"],
    "ruta-prados-verdes-a": FAMILY["verde"],
    "ruta-prados-verdes-b": FAMILY["verde"],
    "ruta-roja-4-tinijaro": FAMILY["roja"],
    "ruta-roja-4-tzindurio": FAMILY["roja"],
    "ruta-negra-1": FAMILY["negra"],
    "ruta-negra-2": FAMILY["negra"],
    # Foráneos / sin color de combi: índigo-azul sobrio (no azul genérico Tailwind)
    "ruta-alberca-gertrudis": ("#00897B", "#004D40", "Alberca"),
    "ruta-alberca-metropolis": ("#00897B", "#004D40", "Alberca"),
    "ruta-centros-comerciales-leandro-valle": ("#5C6BC0", "#283593", "Comercial"),
    "ruta-centros-comerciales-lucio-cabanas": ("#5C6BC0", "#283593", "Comercial"),
    "ruta-circuito-carrillo": ("#5C6BC0", "#283593", "Circuito"),
    "ruta-ruta-2": ("#5C6BC0", "#283593", "Ruta 2"),
    "ruta-el-pedregal": ("#78909C", "#37474F", "Pedregal"),
    "ruta-panteon": ("#546E7A", "#263238", "Panteón"),
    "ruta-trincheras": ("#795548", "#3E2723", "Trincheras"),
    "ruta-durazo-santa-maria": ("#8D6E63", "#3E2723", "Durazno"),
    "ruta-campestre-mision-del-valle": ("#66BB6A", "#2E7D32", "Campestre"),
    "ruta-campestre-posta-trebol-monarca": ("#66BB6A", "#2E7D32", "Campestre"),
    "ruta-arroyo-colorado": ("#FF7043", "#BF360C", "Arroyo"),
}

DEFAULT_FORANEO = ("#5C6BC0", "#283593", "Foráneo")
DEFAULT_OTHER = ("#607D8B", "#37474F", "General")

# Colores viejos de familia → resaltados (para rutas que ya tenían color correcto)
BOOST_MAP: dict[str, str] = {
    "#ffc800": "#FFD000",
    "#e53935": "#EF4444",
    "#ff0000": "#EF4444",
    "#1565c0": "#1E88E5",
    "#2e7d32": "#43A047",
    "#6f4e37": "#8D6E63",
    "#ff6f61": "#FF7043",
    "#c4a574": "#D4B483",
    "#757575": "#8A8A8A",
    "#880e4f": "#C2185B",
    "#e91e63": "#EC407A",
    "#d4a017": "#F0B429",
    "#f57c00": "#FF9800",
    "#7b1fa2": "#9C27B0",
    "#3b82f6": "",  # placeholder: se resuelve por nombre
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower()


def pick_for_route(route_id: str, name: str, transport: str | None) -> tuple[str, str, str]:
    if route_id in SPECIAL:
        return SPECIAL[route_id]

    blob = norm(f"{route_id} {name}")

    # Orden importa: más específico primero
    order = [
        "negra",
        "negro",
        "paloma",  # handled via azul below if "azul" in name
        "guinda",
        "morada",
        "morado",
        "naranja",
        "amarilla",
        "amarillo",
        "coral",
        "crema",
        "dorado",
        "gris",
        "rosa",
        "roja",
        "rojo",
        "cafe",
        "café",
        "verde",
        "azul",
    ]
    for key in order:
        if key == "paloma":
            continue
        if key in blob:
            # "oro verde" cae en verde; "cafe oro" en cafe (cafe aparece antes si está en order - cafe before verde)
            return FAMILY[key if key != "café" else "cafe"]

    if "paloma" in blob and "azul" in blob:
        return FAMILY["azul"]
    if "oro" in blob and "verde" in blob:
        return FAMILY["verde"]

    if transport and "foran" in transport.lower():
        return DEFAULT_FORANEO
    # foráneos típicos por nombre de pueblo
    for token in (
        "charo",
        "atecuaro",
        "chucandiro",
        "capula",
        "coeneo",
        "cointzio",
        "chihuerio",
        "hidalgo",
        "jesus",
        "arco",
        "arcos",
        "indaparapeo",
        "atapaneo",
    ):
        if token in blob:
            return DEFAULT_FORANEO

    return DEFAULT_OTHER


def update_geojson(path: Path, color: str, casing: str, route_name: str | None) -> bool:
    if not path.is_file():
        return False
    data = json.loads(path.read_text(encoding="utf-8"))
    changed = False
    if isinstance(data.get("properties"), dict):
        pr = data["properties"]
        if pr.get("color") != color:
            pr["color"] = color
            changed = True
        if casing and pr.get("casingColor") != casing:
            pr["casingColor"] = casing
            changed = True
        if route_name and pr.get("routeName") and "Negra" in (pr.get("routeName") or ""):
            # keep existing display names; only force color
            pass
    for feat in data.get("features") or []:
        pr = feat.setdefault("properties", {})
        if pr.get("color") != color:
            pr["color"] = color
            changed = True
        if casing and pr.get("casingColor") != casing:
            pr["casingColor"] = casing
            changed = True
    if changed:
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changed


def main() -> int:
    index_path = ROOT / "public" / "routes" / "index.json"
    map_path = ROOT / "data" / "rutastransporte-route-map.json"

    index = json.loads(index_path.read_text(encoding="utf-8"))
    routes = index.get("routes") or []

    route_map = []
    if map_path.is_file():
        route_map = json.loads(map_path.read_text(encoding="utf-8"))
    map_by_id = {e["routeId"]: e for e in route_map}

    stats = {"updated_index": 0, "geojson": 0, "map": 0}
    summary: list[str] = []

    for r in routes:
        rid = r["id"]
        name = r.get("name") or rid
        transport = r.get("transportType") or r.get("transport_type")
        color, casing, color_name = pick_for_route(rid, name, transport)

        old = (r.get("color") or "").lower()
        if old != color.lower() or r.get("colorName") != color_name:
            summary.append(f"{rid}: {r.get('color')} → {color} ({color_name})")
            stats["updated_index"] += 1

        r["color"] = color
        r["colorName"] = color_name
        if "casingColor" in r or casing:
            r["casingColor"] = casing

        # GeoJSON copies
        for rel in (
            ROOT / "public" / "routes" / f"{rid}.geojson",
            ROOT / "data" / "processed" / "geojson" / f"{rid}.geojson",
            ROOT / "data" / "processed" / "matched" / f"{rid}.geojson",
        ):
            if update_geojson(rel, color, casing, name):
                stats["geojson"] += 1

        # route map entry
        if rid in map_by_id:
            e = map_by_id[rid]
            if e.get("color") != color or e.get("casingColor") != casing:
                e["color"] = color
                e["casingColor"] = casing
                stats["map"] += 1

    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if route_map:
        map_path.write_text(json.dumps(route_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # QA summary names/colors if present
    qa = ROOT / "data" / "qa-reports" / "qa-summary.json"
    if qa.is_file():
        data = json.loads(qa.read_text(encoding="utf-8"))
        by = {r["id"]: r for r in routes}
        for key in ("routes", "reports"):
            for item in data.get(key) or []:
                rid = item.get("route_id") or item.get("id")
                if rid in by:
                    item["route_name"] = item.get("route_name") or by[rid].get("name")
                    # optional color field
                    if "color" in item or True:
                        item["color"] = by[rid]["color"]
        qa.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"index routes touched (color/name): {stats['updated_index']}")
    print(f"geojson files written: {stats['geojson']}")
    print(f"route-map entries: {stats['map']}")
    print("--- cambios de color ---")
    for line in summary:
        print(line)
    # show negra + sample
    for r in routes:
        if "negr" in r["id"] or "gris" in r["id"] or "roja" in r["id"][:12]:
            print("OK", r["id"], r["name"], r["color"], r.get("colorName"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
