# Reporte — Revisión Naranjas vs PDF / KML

**Fecha:** 2026-07-08  
**Alcance:** 8 PDFs en la raíz (Moovit) + KML/PDF/JPG IMPLAN en `rutastransporte`  
**Excluida a pedido:** `ruta-naranja-3-centro` (Naranja 3 Centro / “directo”)

---

## Qué se revisó

| # | PDF en raíz | route_id | Carpeta rutastransporte |
|---|-------------|----------|-------------------------|
| 1 | `Naranja 1 [Issste].pdf` | `ruta-naranja-1-issste` | `38_NARANJA_1_ISSSTE` |
| 2 | `Naranja 1 [La Soledad].pdf` | `ruta-naranja-1-la-soledad` | `39_NARANJA_1_LA_SOLEDAD` |
| 3 | `Naranja 2 [3 De Agosto].pdf` | `ruta-naranja-2-3-de-agosto` | `40_NARANJA_2-3_DE_AGOSTO` |
| 4 | `NARANJA 2 ( Santa Fe).pdf` | `ruta-naranja-2-santa-fe` | `41_NARANJA_2_SANTA_FE` |
| 5 | `Naranja 3 [Centro - Puerta Del Sol].pdf` | `ruta-naranja-3-centro-puerta-del-sol` | `42_NARANJA_3_CENTRO-PUERTA_DEL_SOL` |
| 6 | `Naranja 3 [Sta. María - Erandeni].pdf` | `ruta-naranja-3-santa-maria-erandeni` | `44_NARANJA_3_SANTA_MARIA-ERANDENI` |
| 7 | `Naranja 3 [Sta. María - Ita]}.pdf` | `ruta-naranja-3-santa-maria-ita` | `45_NARANJA_3_SANTA_MARIA-ITA` |
| 8 | `Naranja 3 [Trico - Metrópolis].pdf` | `ruta-naranja-3-trico-metropolis` | `46_NARANJA_3_TRICO-METROPOLIS` |

**No revisada:** `43_NARANJA_3_CENTRO` / `ruta-naranja-3-centro`.

---

## Hallazgos importantes

### 1. PDFs de la raíz ≠ PDF de MAPAS IMPLAN
Los 8 PDFs de la raíz son capturas **Moovit** (lista de paradas + mapa esquemático).  
Los PDF/JPG de `rutastransporte/.../MAPAS_*` son mapas **IMPLAN** (trazo oficial del corredor).

- **No son el mismo archivo** (MD5 distinto).
- La geometría operativa se toma del **KML IMPLAN** + validación Valhalla/OSRM.
- Moovit se usa como **referencia de corredor / secuencia**, no como coordenadas finales (no georreferenciado; además el proyecto no usa paradas oficiales).

### 2. Bug previo: geometrías cruzadas
Antes de reimportar:
- ISSSTE y La Soledad compartían la **misma** geometría.
- Varias Naranja 3 (CPS / Erandeni / Trico) tenían trazos idénticos o casi idénticos.

**Causa:** KML de un solo circuito cerrado mal importado / datos viejos; ida/vuelta se generaba mal (offset o datos cruzados).

### 3. Corrección aplicada
1. Mejorado `scripts/import_rutastransporte_routes.py`: si el KML es **circuito cerrado**, se parte en **ida/vuelta por longitud** (sin inventar calles).
2. Reimport de las 8 desde su KML propio.
3. Map-match estricto Valhalla+OSRM + QA.
4. Publicación a `public/routes/` de las 8.

---

## Resultado QA (Valhalla + OSRM)

| route_id | Final QA | Publicado | Fidelity KML→matched (aprox.) |
|----------|----------|-----------|-------------------------------|
| ruta-naranja-1-issste | **approved** | sí | ida/vuelta ~95% pts ≤50 m, ratio ~1.00–1.08 |
| ruta-naranja-1-la-soledad | **approved** | sí | ~95–96% ≤50 m, ratio ~1.00–1.07 |
| ruta-naranja-2-3-de-agosto | **approved** | sí | ~95–97% ≤50 m, ratio ~1.00 |
| ruta-naranja-2-santa-fe | **approved** | sí | ~94–97% ≤50 m, ratio ~1.00–1.03 |
| ruta-naranja-3-centro-puerta-del-sol | **approved** | sí | ~95% ≤50 m, ratio ~1.00 |
| ruta-naranja-3-santa-maria-erandeni | **approved** | sí | ~93–95% ≤50 m, ratio ~1.00 |
| ruta-naranja-3-santa-maria-ita | **approved** | sí | ~95% ≤50 m, ratio ~1.00 |
| ruta-naranja-3-trico-metropolis | **approved** | sí | ~94% ≤50 m; **ida ratio 1.13** (ligera elongación) |

Auditoría JSON: `data/qa-reports/naranja-pdf-audit.json`

### Coincidencia visual mapa IMPLAN / Moovit
Revisados JPG IMPLAN de las 8 + mapas Moovit en PDF raíz (p. ej. ISSSTE, 3 de Agosto):

| Ruta | Corredor vs IMPLAN | Corredor vs Moovit (esquema) |
|------|--------------------|------------------------------|
| Naranja 1 ISSSTE | Coincide (eje N–S + sur Periférico/ISSSTE) | Coincide |
| Naranja 1 La Soledad | Coincide (misma espina + extremo sur Soledad) | Coincide (misma familia) |
| Naranja 2 3 de Agosto | Coincide (sur oeste + bucle Cuauhtémoc + norte Centenario) | Coincide |
| Naranja 2 Santa Fe | Coincide (sur SW + norte hasta Santa Fe / El Pedrisco) | Coincide (misma familia N2) |
| Naranja 3 CPS | Coincide (norte Puerta del Sol / Torreón + eje centro) | Coincide |
| Naranja 3 Erandeni | Coincide (eje + extremo sur Erandeni) | Coincide (familia N3) |
| Naranja 3 ITA | Coincide (similar Erandeni, extremo ITA) | Coincide |
| Naranja 3 Trico-Metrópolis | Coincide (norte Loma Colorada/Trico + eje) | Coincide |

---

## Sobre el “100%”

| Criterio | Estado |
|----------|--------|
| Cada ruta con **su** KML (sin cruces) | ✅ |
| Ida + vuelta generados del circuito KML | ✅ |
| Valhalla+OSRM **approved** y publicados | ✅ |
| Corredor alineado a mapa IMPLAN | ✅ (revisión visual) |
| Corredor alineado a mapa Moovit (esquema) | ✅ (revisión visual) |
| Mismo archivo PDF raíz = PDF MAPAS | ❌ (fuentes distintas a propósito) |
| Snap 100% de cada vértice KML a ≤25 m del matched | ⚠️ ~72–84% ≤25 m; ~93–97% ≤50 m (normal al pegar a OSM) |
| Lista Moovit de paradas como geometría | ❌ no aplicable (no usamos paradas oficiales) |

**Conclusión operativa:** las 8 naranjas quedan **publicables y coherentes** con KML + mapa IMPLAN + esquema Moovit. No se puede afirmar “pixel-perfect 100%” respecto a los PDF Moovit (no son la fuente geométrica), ni snap métrico absoluto de cada vértice del KML sin residual de map-matching.

---

## Archivos tocados

- `scripts/import_rutastransporte_routes.py` — split de circuito cerrado
- `data/processed/geojson/ruta-naranja-*.geojson` (8)
- `data/processed/matched/ruta-naranja-*.geojson` (8)
- `public/routes/ruta-naranja-*.geojson` (8) + `public/routes/index.json`
- `data/qa-reports/ruta-naranja-*.final_qa.json`
- `data/qa-reports/naranja-pdf-audit.json`
- `scripts/_audit_naranja_pdfs.py`, `scripts/_naranja_qa_summary.py`

---

## Cómo revalidar

```bash
# WSL
source ~/.venv-gis-wsl/bin/activate
bash scripts/start_valhalla_wsl.sh
python scripts/import_rutastransporte_routes.py \
  ruta-naranja-1-issste ruta-naranja-1-la-soledad \
  ruta-naranja-2-3-de-agosto ruta-naranja-2-santa-fe \
  ruta-naranja-3-centro-puerta-del-sol \
  ruta-naranja-3-santa-maria-erandeni \
  ruta-naranja-3-santa-maria-ita \
  ruta-naranja-3-trico-metropolis
ONLY_ROUTES=ruta-naranja-1-issste,ruta-naranja-1-la-soledad,ruta-naranja-2-3-de-agosto,ruta-naranja-2-santa-fe,ruta-naranja-3-centro-puerta-del-sol,ruta-naranja-3-santa-maria-erandeni,ruta-naranja-3-santa-maria-ita,ruta-naranja-3-trico-metropolis \
  python scripts/strict_map_match_valhalla_osrm.py
ONLY_ROUTES=... python scripts/qa_validate_routes.py
python scripts/_audit_naranja_pdfs.py
```

En la app: `/admin/qa` o mapa principal filtrando naranjas.

---

## Siguiente (opcional)

1. Revisión visual humana en UI de **Trico ida** (ratio 1.13) y **Santa Fe** (93.8% ≤50 m ida).
2. Si se quiere forzar aún más al KML (menos snap OSM), afinar umbrales de match — riesgo de perder “eje vial real”.
3. Naranja 3 Centro (directo) queda **fuera** de este lote a propósito.
