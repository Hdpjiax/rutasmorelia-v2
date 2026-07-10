"""Limpia nombres/colorName/casing en public/routes/index.json y props de GeoJSON (sin tocar geometría)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "routes"


def norm_name(name: str) -> str:
    n = (name or "").strip()
    n = re.sub(r"^(Ruta\s+)+", "", n, flags=re.I).strip()
    n = re.sub(r"\s+", " ", n)
    for a, b in {
        "Lenadro": "Leandro",
        "Metropolis": "Metrópolis",
        "Mision": "Misión",
        "Satelite": "Satélite",
        "Inde co": "INDECO",
        "Campina": "Campiña",
        "Tzindurio": "Tzíndurio",
        "Tinijaro": "Tiníjaro",
    }.items():
        n = n.replace(a, b)
    return n


def color_name_from(rid: str, name: str, transport: str | None) -> str:
    blob = f"{rid} {name}".lower()
    rules = [
        ("negra", "Negro"),
        ("negro", "Negro"),
        ("guinda", "Guinda"),
        ("morada", "Morado"),
        ("naranja", "Naranja"),
        ("amarilla", "Amarillo"),
        ("coral", "Coral"),
        ("crema", "Crema"),
        ("dorado", "Dorado"),
        ("gris", "Gris"),
        ("rosa", "Rosa"),
        ("roja", "Rojo"),
        ("cafe", "Café"),
        ("café", "Café"),
        ("verde", "Verde"),
        ("azul", "Azul"),
        ("paloma", "Azul"),
        ("alberca", "Alberca"),
        ("campestre", "Campestre"),
        ("durazno", "Durazno"),
        ("trincheras", "Trincheras"),
        ("pedregal", "Pedregal"),
        ("panteon", "Panteón"),
    ]
    for k, v in rules:
        if k in blob:
            return v
    if (transport or "").lower().startswith("foran"):
        return "Foráneo"
    return "General"


def letter(name: str) -> str:
    n = re.sub(r"[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]", "", name)
    return (n[0] if n else "?").upper()


def main() -> None:
    idx_path = PUBLIC / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    log: list[str] = []

    for r in idx.get("routes") or []:
        old_name, old_cn = r.get("name"), r.get("colorName")
        r["name"] = norm_name(str(r.get("name") or r["id"]))
        r["colorName"] = color_name_from(r["id"], r["name"], r.get("transportType"))
        r["colorLetter"] = letter(r["name"])
        r["geojsonFile"] = f"/routes/{r['id']}.geojson"
        r.setdefault("casingColor", "#222222")
        if r.get("transportType") not in ("combi", "foraneo", "autobus"):
            # normalize autobus -> foraneo stored
            if "autobus" in str(r.get("transportType", "")).lower():
                r["transportType"] = "foraneo"

        gj_path = PUBLIC / f"{r['id']}.geojson"
        if gj_path.is_file():
            gj = json.loads(gj_path.read_text(encoding="utf-8"))
            dirty = False
            if isinstance(gj.get("properties"), dict):
                if gj["properties"].get("routeName") != r["name"]:
                    gj["properties"]["routeName"] = r["name"]
                    dirty = True
                if r.get("color") and gj["properties"].get("color") != r["color"]:
                    gj["properties"]["color"] = r["color"]
                    dirty = True
            for f in gj.get("features") or []:
                pr = f.setdefault("properties", {})
                if pr.get("routeName") != r["name"]:
                    pr["routeName"] = r["name"]
                    dirty = True
                if r.get("color") and pr.get("color") != r["color"]:
                    pr["color"] = r["color"]
                    dirty = True
                if r.get("casingColor") and pr.get("casingColor") != r["casingColor"]:
                    pr["casingColor"] = r["casingColor"]
                    dirty = True
                if pr.get("routeId") != r["id"]:
                    pr["routeId"] = r["id"]
                    dirty = True
            if dirty:
                gj_path.write_text(
                    json.dumps(gj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
                )
                log.append(f"geojson:{r['id']}")

        if old_name != r["name"] or old_cn != r["colorName"]:
            log.append(f"{r['id']}: {old_name}/{old_cn} -> {r['name']}/{r['colorName']}")

    idx["routes"].sort(key=lambda x: str(x.get("name", "")).lower())
    idx["count"] = len(idx["routes"])
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"OK routes={idx['count']} changes={len(log)}")
    for line in log[:50]:
        print(line)


if __name__ == "__main__":
    main()
