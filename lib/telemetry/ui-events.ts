/**
 * Telemetría anónima de UI (sin PII).
 * Buffer local + console en dev; opcional sendBeacon a /api/telemetry si existe.
 */

export type UiTelemetryEvent =
  | { type: 'panel_open'; panel: string; at: number }
  | { type: 'panel_close'; panel: string; openMs: number; at: number }
  | { type: 'map_load_fail'; kind: string; at: number }
  | { type: 'route_geojson_missing'; routeId: string; at: number }
  | { type: 'plan_empty'; at: number }
  | { type: 'plan_ok'; planCount: number; durationMs: number; at: number }
  | { type: 'geolocation_denied'; at: number }
  | { type: 'route_select'; routeId: string; at: number }
  | { type: 'time_to_route_select'; ms: number; at: number }
  | { type: 'report_route'; routeId: string; reason: string; at: number }
  | { type: 'offline_mode'; online: boolean; at: number };

const KEY = 'vm_ui_telemetry_v1';
const MAX = 80;
const panelOpenAt = new Map<string, number>();
let sessionStart = 0;
let firstRouteSelectLogged = false;

function now() {
  return Date.now();
}

function readBuf(): UiTelemetryEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UiTelemetryEvent[];
  } catch {
    return [];
  }
}

function writeBuf(events: UiTelemetryEvent[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX)));
  } catch {
    /* quota */
  }
}

function push(event: UiTelemetryEvent) {
  if (typeof window === 'undefined') return;
  if (!sessionStart) sessionStart = now();
  const buf = readBuf();
  buf.push(event);
  writeBuf(buf);
  if (process.env.NODE_ENV === 'development') {
    console.info('[telemetry]', event.type, event);
  }
  // Best-effort beacon (endpoint opcional; no rompe si no existe)
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const body = JSON.stringify({ event });
      navigator.sendBeacon('/api/telemetry', new Blob([body], { type: 'application/json' }));
    }
  } catch {
    /* ignore */
  }
}

export const uiTelemetry = {
  panelOpen(panel: string) {
    panelOpenAt.set(panel, now());
    push({ type: 'panel_open', panel, at: now() });
  },
  panelClose(panel: string) {
    const opened = panelOpenAt.get(panel);
    const openMs = opened != null ? now() - opened : 0;
    panelOpenAt.delete(panel);
    push({ type: 'panel_close', panel, openMs, at: now() });
  },
  mapLoadFail(kind: string) {
    push({ type: 'map_load_fail', kind, at: now() });
  },
  routeGeojsonMissing(routeId: string) {
    push({ type: 'route_geojson_missing', routeId, at: now() });
  },
  planEmpty() {
    push({ type: 'plan_empty', at: now() });
  },
  planOk(planCount: number, durationMs: number) {
    push({ type: 'plan_ok', planCount, durationMs, at: now() });
  },
  geolocationDenied() {
    push({ type: 'geolocation_denied', at: now() });
  },
  routeSelect(routeId: string) {
    push({ type: 'route_select', routeId, at: now() });
    if (!firstRouteSelectLogged && sessionStart) {
      firstRouteSelectLogged = true;
      push({ type: 'time_to_route_select', ms: now() - sessionStart, at: now() });
    }
  },
  reportRoute(routeId: string, reason: string) {
    push({ type: 'report_route', routeId, reason, at: now() });
  },
  offlineMode(online: boolean) {
    push({ type: 'offline_mode', online, at: now() });
  },
  /** Últimos eventos (debug / admin local). */
  recent(limit = 20): UiTelemetryEvent[] {
    return readBuf().slice(-limit);
  },
};
