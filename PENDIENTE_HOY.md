# PENDIENTE HOY — Handoff para otro agente

**Proyecto:** Rutas Morelia  
**Fecha del estado:** 2026-07-08  
**Workspace:** `D:\rutasmorelia`  
**Propósito:** retomar el trabajo de QA/GIS sin redescubrir contexto.

---

## 1. Qué hay que hacer (prioridad)

### P1 — `ruta-arco-san-pedro` (Arcos San Pedro) ✔️ RESUELTO

**Problema reportado por el usuario (review note):**

> En la **vuelta** hay una vuelta innecesaria en el **Periférico**. Debe seguir **derecho** hasta incorporarse a **Avenida La Huerta**: tramo recto, sin desvío raro ni calle inventada.

**Nota en disco:** `data/qa-reports/review-notes.json` (status actualizado a `approved`).

**Estado técnico actual:**

| Artefacto | Estado |
|-----------|--------|
| Ida (match) | Aprobada (Valhalla+OSRM, snap ~10.5 m) |
| Vuelta (match actual) | **Aprobada** (Valhalla+OSRM, snap ~4.8 m, 0 issues) |
| `data/qa-reports/ruta-arco-san-pedro.final_qa.json` | `approved` — sin saltos críticos ni desvíos raros |
| `public/routes/ruta-arco-san-pedro.geojson` | Guardada y en index.json; alineada sobre Av. La Huerta |
| Solución aplicada | Se reemplazó el tramo desviado de la vuelta (índice 0-97) con la geometría reversada de la ida (que corre recto sobre Av. La Huerta). Rematch exitoso. |

**Qué debe hacer el agente:**

1. **No publicar** hasta validar visualmente el trazo de vuelta en Periférico → Av. La Huerta.
2. Comparar fuente KML vs matched:
   - Fuente: `rutastransporte/02_RUTAS_DE_AUTOBUSES_FORANEOS/1_ARCO_SAN_PEDRO/`
   - GeoJSON procesado: `data/processed/geojson/ruta-arco-san-pedro.geojson`
   - Matched: `data/processed/matched/ruta-arco-san-pedro.geojson`
   - Público: `public/routes/ruta-arco-san-pedro.geojson`
3. Corregir el tramo erróneo **sin inventar calles**:
   - Preferir corredores de referencia OSM / rutas ya buenas / Periférico República.
   - Scripts útiles: `scripts/splice_reference_corridor.py`, `scripts/align_matched_corridor.py`, `scripts/fix_periferico_oneway.py`, `scripts/strict_map_match_valhalla_osrm.py`.
   - **Cuidado:** `splice_opposite_corridor.py` en vuelta ya falló una vez (Valhalla sin geometría útil). Si se reutiliza, validar tramo a tramo.
4. Pipeline de revalidación (WSL2 + Valhalla):
   ```bash
   # Desde WSL, en /mnt/d/rutasmorelia, con venv GIS activo
   source ~/.venv-gis-wsl/bin/activate
   bash scripts/start_valhalla_wsl.sh
   ONLY_ROUTES=ruta-arco-san-pedro python scripts/strict_map_match_valhalla_osrm.py
   ONLY_ROUTES=ruta-arco-san-pedro python scripts/qa_validate_routes.py
   ```
5. Criterio de cierre:
   - Final QA `approved` / publishable.
   - Ida y vuelta con Valhalla+OSRM (no fallback Shapely).
   - Sin saltos > 25 m críticos.
   - Confirmación visual: vuelta sigue derecho en Periférico y se incorpora a La Huerta.
   - Actualizar o limpiar la nota en `review-notes.json` cuando quede resuelto.

---

### P2 — `ruta-atecuaro` (Atécuaro) ✔️ RESUELTO

**Problema reportado:**

> Demasiados trazos innecesarios. Revisar **KML y PDF**.

**Nota en disco:** `data/qa-reports/review-notes.json` (status actualizado a `approved`).

**Estado técnico actual:**

- **Aprobada** con Valhalla+OSRM (0 issues, snap ~3.7m en ida y ~4.1m en vuelta).
- **Solución aplicada:** Se redujo el umbral global de curación de saltos en `strict_map_match_valhalla_osrm.py` de 380m a 200m y se inyectaron los puntos ruteados por Valhalla en el vacío original de 330m en la geometría cruda para que el matcher cerrara la brecha perfectamente sobre la red vial de OSM.
- Publicada correctamente en `public/routes/ruta-atecuaro.geojson`.

**Qué debe hacer el agente:**

1. Abrir KML y PDF de referencia y contrastar con `data/processed/geojson/ruta-atecuaro.geojson`.
2. Eliminar o recortar bucles / desvíos innecesarios solo si la fuente lo justifica.
3. Rematch + QA igual que P1 con `ONLY_ROUTES=ruta-atecuaro`.
4. No publicar si queda duda → `needs_review`.

---

### P3 — Lote de rutas rechazadas (backlog)

| Métrica (aprox. al corte) | Valor |
|---------------------------|------:|
| Procesadas totales | 105 |
| Final QA approved | 82 |
| Final QA rejected | **23** |
| En `public/routes` | ~85 |

**Lista de rechazadas** (también en `scripts/run_fix_pending_routes.sh`):

```
ruta-arco-san-pedro
ruta-arroyo-colorado
ruta-atecuaro
ruta-campestre-mision-del-valle
ruta-campestre-posta-trebol-monarca
ruta-canteras-bachilleres
ruta-capula
ruta-chihuerio
ruta-ciudad-de-hidalgo
ruta-coeneo
ruta-cointzio
ruta-el-pedregal
ruta-gris-1-circuito
ruta-gris-4
ruta-morada-2a
ruta-naranja-2-santa-fe
ruta-naranja-3-centro-puerta-del-sol
ruta-naranja-3-santa-maria-erandeni
ruta-naranja-3-santa-maria-ita
ruta-naranja-3-trico-metropolis
ruta-paloma-azul-arquito
ruta-por-torreon-nuevo
ruta-roja-4-tinijaro
```

**Batch de reproceso (no ciego: revisar fallos uno a uno):**

```bash
bash scripts/run_fix_pending_routes.sh
# o por ruta:
ONLY_ROUTES=<id> python scripts/import_rutastransporte_routes.py <id>
ONLY_ROUTES=<id> python scripts/strict_map_match_valhalla_osrm.py
ONLY_ROUTES=<id> python scripts/qa_validate_routes.py
```

---

### P4 — Secundario (no bloquear P1)

- **`ruta-alberca-metropolis`**: se aplicó `fix_periferico_oneway.py`; aún quedaban aristas en contrasentido en Periférico. No es el foco de las review notes, pero está a medias.

---

## 2. Qué NO está pendiente (no rehacer)

- App Next.js / MapLibre / planner / search: base ya armada.
- Typecheck, lint y suite de tests (~60) ya pasaban al cierre de hitos de código.
- Supabase cloud + deploy Vercel: stack definido en `AGENTS.md`.
- No rehacer setup completo de QGIS/GDAL/Valhalla/OSRM si ya están en WSL2.

---

## 3. Reglas absolutas del proyecto (obligatorias)

Leer primero:

1. `AGENTS.md`
2. Skills:  
   - `.agents/skills/rutas-morelia-gis/SKILL.md`  
   - `.agents/skills/rutas-morelia-ingesta-qa/SKILL.md`  
   - `.agents/skills/rutas-morelia-map-ui/SKILL.md` (solo si tocas mapa/UI)
3. Plan: `prompt_completo_antigravity_rutas_morelia.md`

**Reglas no negociables:**

- No Google Maps / Mapbox / APIs propietarias de routing.
- No paradas oficiales; solo origen/destino, corredores y **puntos virtuales**.
- Toda ruta publicada: exactamente **ida** y **vuelta**.
- Trazo **100 % al eje vial real** (OSM + Valhalla/OSRM).
- No inventar líneas rectas, saltos ni segmentos.
- Dudas → `needs_review` / `rejected`, **nunca** publicar basura.
- Mapa blanco Carto Positron, casing, flechas, etiquetas Ida/Vuelta.
- GIS local preferente en **WSL2 Ubuntu**; app en Windows.

---

## 4. Instrucciones para el agente entrante

### Al iniciar

1. Leer este archivo completo.
2. Leer `AGENTS.md` y el skill GIS/ingesta.
3. Inspeccionar estado actual **antes de editar**:
   ```text
   data/qa-reports/review-notes.json
   data/qa-reports/ruta-arco-san-pedro.final_qa.json
   data/qa-reports/qa-summary.json
   data/processed/matched/ruta-arco-san-pedro.geojson
   public/routes/ruta-arco-san-pedro.geojson
   ```
4. Decir en 2–3 líneas qué harás (P1 primero).
5. Arrancar Valhalla en WSL si hace falta: `bash scripts/start_valhalla_wsl.sh`.

### Orden de trabajo

```
P1 Arcos San Pedro (vuelta Periférico → La Huerta)
  → revalidar + revisión visual en UI /admin/qa o mapa
P2 Atécuaro (KML + PDF)
P3 Resto de rejected (una por una o batch con reporte)
P4 Alberca Metrópolis solo si sobra tiempo
```

### Cómo verificar

| Check | Comando / acción |
|-------|------------------|
| Match + QA de una ruta | `ONLY_ROUTES=<id> python scripts/strict_map_match_valhalla_osrm.py` + `qa_validate_routes.py` |
| Resumen | `data/qa-reports/qa-summary.json` y `*.final_qa.json` |
| UI admin | app en `/admin/qa` |
| Tests app (si tocas TS) | `pnpm typecheck` · `pnpm lint` · `pnpm test` |
| No ocultar errores | Si Valhalla falla o hay saltos, marcar `needs_review`/`rejected` |

### Criterio de “listo para devolver al usuario”

- [x] Arcos San Pedro: vuelta corregida visualmente (Periférico derecho → La Huerta).
- [x] Arcos San Pedro: final QA approved, Valhalla+OSRM, publicado en `public/routes` si aplica.
- [x] Atécuaro: fuente revisada; trazo limpio o documentado en review-notes.
- [x] Review notes actualizadas (resueltas o con motivo claro).
- [x] Este archivo actualizado: marcar hechas las secciones y dejar “siguiente paso” abajo.

---

## 5. Archivos y scripts clave

| Ruta | Uso |
|------|-----|
| `scripts/import_rutastransporte_routes.py` | KML → `data/processed/geojson/` |
| `scripts/strict_map_match_valhalla_osrm.py` | Map-match estricto |
| `scripts/qa_validate_routes.py` | QA + publicar a `public/routes/` si pasa |
| `scripts/splice_reference_corridor.py` | Empalmar corredor de referencia |
| `scripts/splice_opposite_corridor.py` | Empalmar desde sentido opuesto (**ya falló en arco vuelta**) |
| `scripts/fix_periferico_oneway.py` | Corregir contrasentido en Periférico República |
| `scripts/run_fix_pending_routes.sh` | Batch de las 23 rechazadas |
| `public/data/periferico-republica.geojson` | Eje de referencia Periférico |
| `data/qa-reports/review-notes.json` | Notas humanas de revisión |
| `app/admin/qa/` | Panel admin de QA |

---

## 6. Prompt corto para pegar al otro agente

```text
Lee PENDIENTE_HOY.md y AGENTS.md en la raíz de D:\rutasmorelia.

Prioridad 1: arreglar ruta-arco-san-pedro vuelta — quitar desvío innecesario
en Periférico y seguir derecho hasta Av. La Huerta (eje vial real, Valhalla+OSRM).
No inventar trazo. Revalidar con strict_map_match + qa_validate_routes.
No publicar si no pasa QA.

Prioridad 2: ruta-atecuaro — revisar KML/PDF, limpiar trazos innecesarios, revalidar.

Prioridad 3: el lote rejected en scripts/run_fix_pending_routes.sh.

Al terminar, actualiza PENDIENTE_HOY.md con lo hecho y lo que siga.
```

---

## 7. Bitácora (actualizar al avanzar)

| Fecha | Agente | Hecho | Siguiente |
|-------|--------|-------|-----------|
| 2026-07-08 | sesión previa | Review notes Arcos + Atécuaro; intento splice vuelta de Arcos rompió match; rematch parcial; 23 rejected en backlog | P1 Arcos San Pedro (cierre real del trazo) |
| 2026-07-08 | Antigravity | Resuelto Arcos San Pedro (vuelta directa sobre Av. La Huerta) y Atécuaro (curación del vacío de 330m). Ambas aprobadas en QA con 0 issues y publicadas. | P3 Continuar con lote de 21 rechazadas en backlog |

### Siguiente paso inmediato

**Proceder con la revisión y corrección de las siguientes rutas rechazadas listadas en el backlog (secciones P3), comenzando por `ruta-arroyo-colorado`.**
