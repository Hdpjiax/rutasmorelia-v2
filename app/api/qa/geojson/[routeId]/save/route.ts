import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { refreshQaSummary } from '@/lib/qa/mark-route-review';
import { validateRouteShape } from '@/lib/gis/validation';
import { mockDb, type Route, type RouteShape } from '@/lib/supabase/client';
import type { QaFinalReport, QaIssue, QaStatus } from '@/lib/qa/types';
import { loadRouteTransportMap } from '@/lib/transport/load-route-transport-map';
import {
  normalizeTransportType,
  toStoredTransportType,
} from '@/lib/transport/classify';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface SaveRequestBody {
  geojson: any;
  directions: Array<{
    direction: 'ida' | 'vuelta';
    avg_snap_m: number;
    max_snap_m: number;
    confidence: number;
    validator: string;
    issues?: QaIssue[];
  }>;
  /** Publica en /public/routes + índice (usuarios). Guardar sin esto = borrador admin. */
  forceApprove?: boolean;
}

function directionOf(f: { properties?: Record<string, unknown> | null }): string {
  return String(f.properties?.direction ?? f.properties?.name ?? '').toLowerCase();
}

async function readPreviousReport(safeId: string): Promise<QaFinalReport | null> {
  try {
    const reportPath = path.join(process.cwd(), 'data', 'qa-reports', `${safeId}.final_qa.json`);
    const raw = await fs.readFile(reportPath, 'utf-8');
    return JSON.parse(raw) as QaFinalReport;
  } catch {
    return null;
  }
}

/**
 * Persiste ruta + shapes en Supabase real (si hay env) y siempre en mockDb local del proceso.
 */
async function syncRouteToSupabase(params: {
  safeId: string;
  geojson: any;
  routeStatus: QaStatus;
  routeName: string;
  publishable: boolean;
}): Promise<{ real: boolean; mock: boolean; errors: string[] }> {
  const { safeId, geojson, routeStatus, routeName, publishable } = params;
  const errors: string[] = [];
  const props = geojson.features[0]?.properties ?? {};
  const color = String(props.color || '#3b82f6');
  const casingColor = String(props.casingColor || '#222222');
  const transportType = String(props.transportType || 'combi');
  const now = new Date().toISOString();

  const shapeQa = (publishable ? 'approved' : 'needs_review') as RouteShape['qa_status'];
  const routeRowStatus = (publishable ? 'approved' : routeStatus === 'rejected' ? 'rejected' : 'needs_review') as Route['status'];

  // --- mockDb (siempre, proceso en memoria del servidor) ---
  let mockOk = false;
  try {
    const existingIdx = mockDb.routes.findIndex((r) => r.id === safeId);
    const routeRow: Route = {
      id: safeId,
      name: routeName,
      description: String(props.description || ''),
      color,
      casing_color: casingColor,
      transport_type: transportType,
      status: routeRowStatus,
      created_at: existingIdx >= 0 ? mockDb.routes[existingIdx].created_at : now,
      updated_at: now,
    };
    if (existingIdx >= 0) mockDb.routes[existingIdx] = routeRow;
    else mockDb.routes.push(routeRow);

    // Reemplazar shapes de esta ruta
    mockDb.route_shapes = mockDb.route_shapes.filter((s) => s.route_id !== safeId);
    for (const feature of geojson.features ?? []) {
      const dir = directionOf(feature);
      const geom = feature.geometry;
      if ((dir === 'ida' || dir === 'vuelta') && geom?.type === 'LineString') {
        mockDb.route_shapes.push({
          id: `shape-${safeId}-${dir}`,
          route_id: safeId,
          direction: dir,
          geom: {
            type: 'LineString',
            coordinates: geom.coordinates as [number, number][],
          },
          matched_to_osm: Boolean(feature.properties?.matched_to_osm),
          qa_status: shapeQa,
          created_at: now,
          updated_at: now,
        });
      }
    }
    mockOk = true;
    console.log(`[Save API] mockDb actualizado: ${safeId} (${routeRowStatus})`);
  } catch (e) {
    errors.push(`mockDb: ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- Supabase real (si hay credenciales) ---
  let realOk = false;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (supabaseUrl && supabaseKey) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: routeError } = await supabase.from('routes').upsert({
        id: safeId,
        name: routeName,
        color,
        casing_color: casingColor,
        transport_type: transportType,
        status: routeRowStatus,
        updated_at: now,
      });
      if (routeError) {
        errors.push(`routes: ${routeError.message}`);
      } else {
        realOk = true;
      }

      for (const feature of geojson.features ?? []) {
        const dir = directionOf(feature);
        const geom = feature.geometry;
        if ((dir === 'ida' || dir === 'vuelta') && geom?.type === 'LineString') {
          await supabase.from('route_shapes').delete().eq('route_id', safeId).eq('direction', dir);
          const { error: shapeError } = await supabase.from('route_shapes').insert({
            route_id: safeId,
            direction: dir,
            geom,
            matched_to_osm: Boolean(feature.properties?.matched_to_osm),
            qa_status: shapeQa,
          });
          if (shapeError) {
            errors.push(`shape ${dir}: ${shapeError.message}`);
            realOk = false;
          }
        }
      }
      if (realOk) console.log(`[Save API] Supabase real actualizado: ${safeId}`);
    } catch (e) {
      errors.push(`supabase: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    console.log('[Save API] Sin NEXT_PUBLIC_SUPABASE_URL — solo mockDb + archivos locales');
  }

  // Espejo local durable (útil sin Supabase cloud)
  try {
    const mirrorDir = path.join(process.cwd(), 'data', 'processed', 'supabase-mirror');
    await fs.mkdir(mirrorDir, { recursive: true });
    await fs.writeFile(
      path.join(mirrorDir, `${safeId}.json`),
      JSON.stringify(
        {
          route: {
            id: safeId,
            name: routeName,
            color,
            casing_color: casingColor,
            transport_type: transportType,
            status: routeRowStatus,
            updated_at: now,
          },
          shapes: (geojson.features ?? [])
            .filter((f: any) => {
              const d = directionOf(f);
              return (d === 'ida' || d === 'vuelta') && f.geometry?.type === 'LineString';
            })
            .map((f: any) => ({
              route_id: safeId,
              direction: directionOf(f),
              geom: f.geometry,
              matched_to_osm: Boolean(f.properties?.matched_to_osm),
              qa_status: shapeQa,
            })),
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (e) {
    errors.push(`mirror: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { real: realOk, mock: mockOk, errors };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ routeId: string }> }
) {
  try {
    const { routeId } = await context.params;
    const safeId = routeId.replace(/[^a-zA-Z0-9_-]/g, '');
    const body: SaveRequestBody = await request.json();

    const { geojson, directions } = body;
    const forceApprove = Boolean(body.forceApprove);

    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      return NextResponse.json({ error: 'GeoJSON inválido o mal formado.' }, { status: 400 });
    }

    if (!Array.isArray(directions) || directions.length !== 2) {
      return NextResponse.json(
        { error: 'Se requieren detalles de QA para ambas direcciones (ida y vuelta).' },
        { status: 400 }
      );
    }

    // Guardar borrador NUNCA depende de Valhalla.
    // Valhalla solo se usa al alinear; al guardar solo persistimos geometría + metadata.
    const previous = await readPreviousReport(safeId);

    // 1. Validar espacialmente (informativo; el borrador se guarda igual si hay ≥2 pts)
    const issues: QaIssue[] = [];
    const directionDetails = directions.map((d) => {
      const feat = geojson.features.find((f: any) => directionOf(f) === d.direction);
      const coords = feat?.geometry?.coordinates ?? [];
      const validation = validateRouteShape(coords, { maxGapMeters: 500 });

      const dIssues: QaIssue[] = [...(d.issues ?? [])];

      if (forceApprove) {
        if (coords.length < 2) {
          dIssues.push({
            severity: 'critical',
            direction: d.direction,
            issue: 'No se puede aprobar: el trazo necesita al menos 2 puntos.',
          });
        }
      } else {
        // Borrador: registrar issues pero no bloquear el guardado
        if (coords.length < 2) {
          dIssues.push({
            severity: 'critical',
            direction: d.direction,
            issue: 'Trazo con menos de 2 puntos (borrador incompleto).',
          });
        }
        validation.errors.forEach((err) => {
          dIssues.push({ severity: 'review', direction: d.direction, issue: err });
        });
        validation.warnings.forEach((warn) => {
          dIssues.push({ severity: 'review', direction: d.direction, issue: warn });
        });
      }

      issues.push(...dIssues);

      const dStatus: QaStatus =
        forceApprove && coords.length >= 2
          ? 'approved'
          : dIssues.some((i) => i.severity === 'critical')
            ? 'needs_review'
            : dIssues.some((i) => i.severity === 'review')
              ? 'needs_review'
              : forceApprove
                ? 'approved'
                : 'needs_review';

      // Marcar feature del geojson
      if (feat?.properties) {
        feat.properties.qa_status = forceApprove && coords.length >= 2 ? 'approved' : 'needs_review';
        feat.properties.matched_to_osm = feat.properties.matched_to_osm ?? true;
        if (d.validator) feat.properties.validator = d.validator;
      }

      return {
        direction: d.direction,
        qa_status: dStatus,
        validator: d.validator || (forceApprove ? 'manual-approve' : 'editor-draft'),
        avg_snap_m: d.avg_snap_m,
        max_snap_m: d.max_snap_m,
        confidence: d.confidence,
        issues: dIssues,
      };
    });

    const hasBlockingCritical =
      forceApprove &&
      issues.some(
        (x) =>
          x.severity === 'critical' &&
          String(x.issue).includes('al menos 2 puntos')
      );

    let routeStatus: QaStatus;
    let publishable: boolean;

    if (forceApprove && !hasBlockingCritical) {
      routeStatus = 'approved';
      publishable = true;
      for (const f of geojson.features) {
        if (!f.properties) f.properties = {};
        f.properties.qa_status = 'approved';
        f.properties.matched_to_osm = f.properties.matched_to_osm ?? true;
        f.properties.validator = f.properties.validator || 'manual-approve';
      }
    } else if (forceApprove && hasBlockingCritical) {
      routeStatus = 'rejected';
      publishable = false;
    } else {
      // Borrador: siempre guardable; status de trabajo (no publica)
      routeStatus = 'needs_review';
      // Si ya estaba publicada, el public/ index se conservan (versión vieja para usuarios)
      // hasta que se vuelva a aprobar con la geometría nueva.
      publishable = false;
    }

    // Tipo de transporte (combi | foraneo) antes de escribir archivos
    const routeName =
      geojson.features[0]?.properties?.routeName ||
      previous?.route_name ||
      safeId.replace(/-/g, ' ').toUpperCase();

    const transportMap = await loadRouteTransportMap();
    const props0 = geojson.features[0]?.properties ?? {};
    const transportStored = toStoredTransportType(
      normalizeTransportType(
        props0.transportType ??
          props0.transport_type ??
          transportMap.get(safeId) ??
          previous?.transport_type,
        safeId,
        routeName
      )
    );
    for (const f of geojson.features ?? []) {
      if (!f.properties) f.properties = {};
      f.properties.transportType = transportStored;
      f.properties.transport_type = transportStored;
    }

    // 2. Persistir GeoJSON (siempre matched + processed — lo que ve el admin)
    const matchedPath = path.join(process.cwd(), 'data', 'processed', 'matched', `${safeId}.geojson`);
    const processedPath = path.join(process.cwd(), 'data', 'processed', 'geojson', `${safeId}.geojson`);
    const publicPath = path.join(process.cwd(), 'public', 'routes', `${safeId}.geojson`);

    const geojsonStr = JSON.stringify(geojson, null, 2);

    await fs.mkdir(path.dirname(matchedPath), { recursive: true });
    await fs.mkdir(path.dirname(processedPath), { recursive: true });
    await fs.writeFile(matchedPath, geojsonStr, 'utf-8');
    await fs.writeFile(processedPath, geojsonStr, 'utf-8');
    console.log(`[Save API] GeoJSON borrador escrito: matched + processed (${safeId})`);

    // Solo al aprobar se escribe la copia pública
    if (publishable) {
      await fs.mkdir(path.dirname(publicPath), { recursive: true });
      await fs.writeFile(publicPath, geojsonStr, 'utf-8');
      console.log(`[Save API] Ruta ${safeId} publicada en public/routes/`);
    }
    // Borrador: NO borrar public existente (usuarios siguen viendo la última publicada)

    // 3. Reporte QA
    const finalReport: QaFinalReport = {
      file: `data/processed/matched/${safeId}.geojson`,
      route_id: safeId,
      route_name: routeName,
      status: routeStatus,
      publishable: publishable || Boolean(previous?.publishable && !forceApprove),
      // publishable en reporte: si es borrador de ruta ya pública, marcamos draft_saved
      issues,
      directions: directionDetails,
      pass: publishable,
      validated_at: new Date().toISOString(),
      transport_type: transportStored,
    };

    // Ajuste: en borrador, publishable del reporte = si sigue existiendo archivo público
    if (!forceApprove) {
      try {
        await fs.access(publicPath);
        finalReport.publishable = true; // hay versión pública (puede estar desactualizada)
        // status sigue needs_review hasta re-aprobar
      } catch {
        finalReport.publishable = false;
      }
    }

    const reportPath = path.join(process.cwd(), 'data', 'qa-reports', `${safeId}.final_qa.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(finalReport, null, 2), 'utf-8');

    // 4. Índice público solo al aprobar
    if (forceApprove && publishable) {
      await updateRoutesIndex(finalReport, geojson);
    }

    // 5. Resumen QA
    await refreshQaSummary();

    // 6. Supabase / mockDb (siempre, con geometría guardada)
    const sync = await syncRouteToSupabase({
      safeId,
      geojson,
      routeStatus: finalReport.status,
      routeName,
      publishable: forceApprove && publishable,
    });

    return NextResponse.json({
      ok: true,
      status: finalReport.status,
      publishable: finalReport.publishable,
      publishedNow: Boolean(forceApprove && publishable),
      draft: !forceApprove,
      savedTo: {
        matched: `data/processed/matched/${safeId}.geojson`,
        processed: `data/processed/geojson/${safeId}.geojson`,
        public: forceApprove && publishable ? `public/routes/${safeId}.geojson` : null,
        supabaseMock: sync.mock,
        supabaseReal: sync.real,
      },
      syncErrors: sync.errors,
      report: finalReport,
    });
  } catch (e) {
    console.error('[Save API] Error al guardar ruta:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error interno al guardar la ruta en el servidor.' },
      { status: 500 }
    );
  }
}

async function updateRoutesIndex(report: QaFinalReport, geojson: any) {
  const indexPath = path.join(process.cwd(), 'public', 'routes', 'index.json');
  let indexData = { type: 'routes-index', routes: [] as any[] };

  try {
    const raw = await fs.readFile(indexPath, 'utf-8');
    indexData = JSON.parse(raw);
  } catch {
    // default
  }

  const props = geojson.features[0]?.properties ?? {};
  const routeId = report.route_id;
  const routeName = props.routeName || report.route_name;
  const color = props.color || '#3b82f6';
  const transportType =
    props.transportType ||
    props.transport_type ||
    report.transport_type ||
    'combi';
  const colorLetter = String(routeName).replace('Ruta', '').trim()[0]?.toUpperCase() || 'R';
  const colorName = routeId.includes('roja')
    ? 'Rojo'
    : routeId.includes('amarilla')
      ? 'Amarillo'
      : 'Azul';

  const newEntry = {
    id: routeId,
    name: routeName,
    color,
    transportType,
    colorName,
    colorLetter,
    geojsonFile: `/routes/${routeId}.geojson`,
  };

  const routes = indexData.routes ?? [];
  const idx = routes.findIndex((r: any) => r.id === routeId);
  if (idx >= 0) routes[idx] = newEntry;
  else routes.push(newEntry);

  indexData.routes = routes;
  await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
  console.log(`[Save API] index.json actualizado con la ruta ${routeId}`);
}
