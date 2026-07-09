# Reporte — 10 notas de revisión (2026-07-09)

## Resumen ejecutivo

| Acción | Rutas | Resultado |
|--------|-------|-----------|
| **Borradas** | 2 | Eliminadas de geojson/matched/public/index/route-map/QA |
| **Reprocesadas** | 8 | Todas **approved** y publicadas (ida + vuelta) |

PDFs de raíz usados como referencia de nombre/corredor (Moovit). Geometría operativa desde **KML rutastransporte** + Valhalla/OSRM.

---

## 1. Borradas (a petición)

### `ruta-naranja-3-centro` — Naranja 3 (Directo)
- Nota: *borrar esta ruta por completo*
- Eliminado: processed geojson, matched, public, raw kml, qa reports, entrada en `index.json`, entrada en `rutastransporte-route-map.json`
- **No confundir** con `ruta-naranja-3-centro-puerta-del-sol` (sigue publicada)

### `ruta-isste-soledad` — Ruta Isste Soledad
- Nota: *borrar esta ruta por completo no te confundas con otras*
- Eliminado: mismos artefactos
- **No confundir** con naranjas ISSSTE/Soledad ni Charo Indaparapeo ISSSTE-Soledad

---

## 2. Reprocesadas con PDF de raíz

| route_id | PDF raíz | Nota original | QA | Publicado | Ida+Vuelta |
|----------|----------|---------------|-----|-----------|------------|
| `ruta-charo` | `charo.pdf` | solo una línea / falta segundo sentido | **approved** | sí | sí |
| `ruta-charo-indaparapeo-atapaneo-issste-soledad` | `charo.pdf` (familia) | solo una línea | **approved** | sí | sí |
| `ruta-charo-san-antonio-corrales` | `charo.pdf` (familia) | trazos amontonados | **approved** | sí | sí |
| `ruta-coral-1` | `Coral 1.pdf` | vueltas incorrectas | **approved** | sí | sí |
| `ruta-durazo-santa-maria` | `Durazno - Sta. María [Trincheras].pdf` | revisar con PDF | **approved** | sí | sí |
| `ruta-jesus-del-monte` | `Jesús Del Monte.pdf` | faltan trazos | **approved** | sí | sí |
| `ruta-morada-1-aldea` | `Morada 1 [Aldea].pdf` | volver a hacer | **approved** | sí | sí |
| `ruta-alberca-metropolis` | `Alberca [Metrópolis].pdf` | 100% con PDF/KML (sin forzar periférico) | **approved** | sí | sí |

### Qué se hizo en cada una
1. Reimport desde KML oficial (`import_rutastransporte_routes.py`).
2. Split ida/vuelta (2 features del KML o circuito cerrado por longitud).
3. Map-match Valhalla+OSRM (tune denso en Coral / Morada / Alberca / Charo).
4. QA estricto y publicación a `public/routes/`.

### Fix extra
- Bug en `qa_validate_routes.py` `decimate_coords`: inventaba saltos >500 m al acumular un segmento largo con el resto. Corregido (afectaba a Charo y posiblemente otras).

---

## 3. PDFs en raíz vs notas

| PDF raíz | Nota(s) atendidas |
|----------|-------------------|
| `charo.pdf` | Charo, Charo Indaparapeo…, Charo San Antonio Corrales |
| `Coral 1.pdf` | Coral 1 |
| `Durazno - Sta. María [Trincheras].pdf` | Durazo/Durazno Santa María |
| `Jesús Del Monte.pdf` | Jesús del Monte |
| `Morada 1 [Aldea].pdf` | Morada 1 Aldea |
| `Alberca [Metrópolis].pdf` | Alberca Metrópolis |

Las 3 Charo comparten el mismo PDF de familia en raíz (no había PDF dedicado por variante); cada una se reimportó de **su propio KML**.

---

## 4. Verificación rápida

```bash
# No deben existir:
ls public/routes/ruta-naranja-3-centro.geojson   # fail
ls public/routes/ruta-isste-soledad.geojson      # fail

# Deben existir y tener ida+vuelta:
# ruta-charo, ruta-charo-indaparapeo-..., ruta-charo-san-antonio-corrales,
# ruta-coral-1, ruta-durazo-santa-maria, ruta-jesus-del-monte,
# ruta-morada-1-aldea, ruta-alberca-metropolis
```

Notas actualizadas en: `data/qa-reports/review-notes.json`  
Batch log: `data/qa-reports/review-batch-2026-07-09.json`

---

## 5. Pendiente visual (opcional)

Revisar en el mapa de la app, con el PDF Moovit al lado:
1. **Charo** (foránea larga; segmentos con saltos OSM residuales &lt;500 m)
2. **Alberca Metrópolis** (corredor Periférico sin forzar oneway)
3. **Charo San Antonio Corrales** (antes “amontonada”)

Si ves un desvío concreto, márcalo de nuevo en `/admin/qa`.
