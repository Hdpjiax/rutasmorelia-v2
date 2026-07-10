'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion } from 'motion/react';
import { ClipboardList, MessageSquareText, SendHorizontal, StickyNote, Undo2, Trash2, Save, X, Edit, Flag, HelpCircle } from 'lucide-react';
import type { QaFinalReport, QaStatus, QaSummary } from '@/lib/qa/types';
import type { ReviewNote, ReviewFlag } from '@/lib/qa/review-notes';
import {
  formatSnapDistance,
  isValhallaValidated,
  statusColorClass,
  statusLabel,
} from '@/lib/qa/assess-route';
import { initMoreliaMap, destroyMoreliaMap } from '@/lib/map/init-map';
import { ensureQaPreviewLayers, setQaPreviewData } from '@/lib/map/route-layers';
import { toast } from '@/lib/ui/toast';
import { getHaversineDistance } from '@/lib/supabase/client';
import {
  normalizeTransportType,
  transportBadgeClass,
  type TransportFilter,
} from '@/lib/transport/classify';
import {
  applyEditedDirection,
  directionOfFeature,
  filterGeojsonByDirection,
  getDirectionMode,
  stampDirectionMode,
  toSingleCorridorDisplay,
  type RouteFeature,
  type RouteFeatureCollection,
} from '@/lib/gis/direction-mode';

interface Props {
  initialSummary: QaSummary | null;
  initialReports: QaFinalReport[];
}

type FilterStatus = 'all' | QaStatus;
/** Vista del mapa: un sentido o ambos juntos (como PDF dual) */
type ViewMode = 'ida' | 'vuelta' | 'both';

function getDistanceToSegment(p1: [number, number], p2: [number, number], point: [number, number]): number {
  const x = point[0];
  const y = point[1];
  const x1 = p1[0];
  const y1 = p1[1];
  const x2 = p2[0];
  const y2 = p2[1];

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 0) {
    t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const proj: [number, number] = [projX, projY];

  return getHaversineDistance(point, proj);
}

const EDIT_VERTICES_SOURCE = 'edit-vertices-source';
const EDIT_VERTICES_HIT = 'edit-vertices-hit';
const EDIT_VERTICES_CIRCLE = 'edit-vertices-circle';
const EDIT_VERTICES_ENDPOINTS = 'edit-vertices-endpoints';

/** GeoJSON de vértices para capa nativa (sin DOM Markers). */
function coordsToVertexCollection(coords: [number, number][]) {
  return {
    type: 'FeatureCollection' as const,
    features: coords.map((coord, index) => ({
      type: 'Feature' as const,
      id: index,
      properties: {
        index,
        isEndpoint: index === 0 || index === coords.length - 1 ? 1 : 0,
      },
      geometry: { type: 'Point' as const, coordinates: coord },
    })),
  };
}

/** Preview: ida | vuelta | juntas (ambas del KML / dual_ring). */
function buildEditPreviewGeojson(
  geojson: RouteFeatureCollection,
  viewMode: ViewMode,
  editDirection: 'ida' | 'vuelta',
  isEditing: boolean,
  draftCoords?: [number, number][]
): RouteFeatureCollection {
  // En edición siempre el sentido activo (con borrador)
  if (isEditing) {
    return filterGeojsonByDirection(geojson, editDirection, draftCoords);
  }
  if (viewMode === 'both') {
    return toSingleCorridorDisplay(geojson, { role: 'full' });
  }
  return filterGeojsonByDirection(geojson, viewMode);
}

function ensureEditLayers(map: maplibregl.Map) {
  if (!map.getSource('edit-raw-source')) {
    map.addSource('edit-raw-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    map.addLayer({
      id: 'edit-raw-line',
      type: 'line',
      source: 'edit-raw-source',
      paint: {
        'line-color': '#f97316',
        'line-width': 3,
        'line-dasharray': [2, 2],
        'line-opacity': 0.85,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }

  if (!map.getSource(EDIT_VERTICES_SOURCE)) {
    map.addSource(EDIT_VERTICES_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      // id estable por índice → feature-state hover sin mover el punto
      promoteId: 'index',
    });

    // Capa hit grande (casi invisible) para click/barrido preciso sin mover el punto
    map.addLayer({
      id: EDIT_VERTICES_HIT,
      type: 'circle',
      source: EDIT_VERTICES_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 14, 18, 16],
        'circle-color': '#000000',
        'circle-opacity': 0.01,
      },
    });

    map.addLayer({
      id: EDIT_VERTICES_CIRCLE,
      type: 'circle',
      source: EDIT_VERTICES_SOURCE,
      paint: {
        // Un solo interpolate de zoom (MapLibre no permite varios en la misma expresión)
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12,
          ['case', ['==', ['get', 'isEndpoint'], 1], 5, 3.5],
          16,
          ['case', ['==', ['get', 'isEndpoint'], 1], 7, 5],
          18,
          ['case', ['==', ['get', 'isEndpoint'], 1], 8, 6],
        ],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#be123c',
          '#ea580c',
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.95,
      },
    });

    map.addLayer({
      id: EDIT_VERTICES_ENDPOINTS,
      type: 'circle',
      source: EDIT_VERTICES_SOURCE,
      filter: ['==', ['get', 'isEndpoint'], 1],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 16, 8, 18, 9],
        'circle-color': 'transparent',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#111111',
        'circle-opacity': 1,
      },
    });
  }
}

function setEditVerticesData(map: maplibregl.Map, coords: [number, number][], visible: boolean) {
  const source = map.getSource(EDIT_VERTICES_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  source.setData(visible ? coordsToVertexCollection(coords) : { type: 'FeatureCollection', features: [] });
}

function setEditVerticesPaintMode(map: maplibregl.Map, mode: 'draw' | 'erase' | 'flag') {
  if (!map.getLayer(EDIT_VERTICES_CIRCLE)) return;
  const erase = mode === 'erase';
  map.setPaintProperty(EDIT_VERTICES_CIRCLE, 'circle-color', [
    'case',
    ['boolean', ['feature-state', 'hover'], false],
    erase ? '#9f1239' : '#c2410c',
    erase ? '#e11d48' : '#ea580c',
  ]);
  // Un solo interpolate de zoom por expresión (regla de MapLibre)
  map.setPaintProperty(
    EDIT_VERTICES_CIRCLE,
    'circle-radius',
    erase
      ? (['interpolate', ['linear'], ['zoom'], 11, 5, 14, 7, 17, 9] as maplibregl.ExpressionSpecification)
      : ([
          'interpolate',
          ['linear'],
          ['zoom'],
          12,
          ['case', ['==', ['get', 'isEndpoint'], 1], 5, 3.5],
          16,
          ['case', ['==', ['get', 'isEndpoint'], 1], 7, 5],
          18,
          ['case', ['==', ['get', 'isEndpoint'], 1], 8, 6],
        ] as maplibregl.ExpressionSpecification)
  );
  if (map.getLayer(EDIT_VERTICES_HIT)) {
    map.setPaintProperty(
      EDIT_VERTICES_HIT,
      'circle-radius',
      erase
        ? (['interpolate', ['linear'], ['zoom'], 11, 14, 14, 18, 17, 22] as maplibregl.ExpressionSpecification)
        : (['interpolate', ['linear'], ['zoom'], 12, 10, 16, 14, 18, 16] as maplibregl.ExpressionSpecification)
    );
  }
}

function raiseEditLayers(map: maplibregl.Map) {
  for (const id of [
    'edit-raw-line',
    EDIT_VERTICES_HIT,
    EDIT_VERTICES_CIRCLE,
    EDIT_VERTICES_ENDPOINTS,
  ]) {
    if (map.getLayer(id)) {
      try {
        map.moveLayer(id);
      } catch {
        /* layer may not exist yet */
      }
    }
  }
}

/** Radio de borrado en metros según zoom del mapa. */
function eraseRadiusMeters(zoom: number): number {
  // ~14 m en z15; más generoso al alejar
  return Math.max(12, Math.min(90, 450 / Math.pow(2, Math.max(zoom, 10) - 12)));
}

/**
 * Borra un vértice o un tramo cercano al click.
 * - Si hay un vértice dentro del radio → elimina ese punto.
 * - Si el click cae sobre/cerca de la línea → elimina un tramo (puntos en el pincel).
 * Devuelve null si no hay nada que borrar.
 */
function eraseAtClick(
  coords: [number, number][],
  click: [number, number],
  radiusM: number
): { next: [number, number][]; removed: number; kind: 'point' | 'tramo' } | null {
  if (coords.length === 0) return null;

  let nearest = -1;
  let minD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = getHaversineDistance(coords[i], click);
    if (d < minD) {
      minD = d;
      nearest = i;
    }
  }

  // Un solo punto cercano
  if (nearest >= 0 && minD <= radiusM) {
    return {
      next: coords.filter((_, i) => i !== nearest),
      removed: 1,
      kind: 'point',
    };
  }

  // Tramo: puntos dentro del pincel + segmento más cercano
  const brush = radiusM * 2.2;
  const remove = new Set<number>();

  for (let i = 0; i < coords.length; i++) {
    if (getHaversineDistance(coords[i], click) <= brush) {
      remove.add(i);
    }
  }

  let bestSeg = -1;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = getDistanceToSegment(coords[i], coords[i + 1], click);
    if (d < bestDist) {
      bestDist = d;
      bestSeg = i;
    }
  }

  if (bestSeg >= 0 && bestDist <= brush) {
    // Ventana alrededor del segmento y expansión a lo largo del trazo
    const start = Math.max(0, bestSeg - 1);
    const end = Math.min(coords.length - 1, bestSeg + 2);
    for (let i = start; i <= end; i++) remove.add(i);

    let j = bestSeg - 1;
    while (j >= 0 && getHaversineDistance(coords[j], click) <= brush * 1.4) {
      remove.add(j);
      j--;
    }
    j = bestSeg + 2;
    while (j < coords.length && getHaversineDistance(coords[j], click) <= brush * 1.4) {
      remove.add(j);
      j++;
    }
  }

  if (remove.size === 0) return null;

  return {
    next: coords.filter((_, i) => !remove.has(i)),
    removed: remove.size,
    kind: 'tramo',
  };
}

export default function QaAdminPanel({ initialSummary, initialReports }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [reports, setReports] = useState(initialReports);
  const [summary, setSummary] = useState(initialSummary);
  const [reviewNotes, setReviewNotes] = useState<ReviewNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialReports[0]?.route_id ?? null
  );
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [transportFilter, setTransportFilter] = useState<TransportFilter>('all');

  // Estados del Editor de Rutas Interactivo
  const [loadedGeojson, setLoadedGeojson] = useState<any>(null);
  const [draftCoords, setDraftCoords] = useState<[number, number][]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editDirection, setEditDirection] = useState<'ida' | 'vuelta'>('ida');
  /** Vista: ida, vuelta o juntas (solo lectura; al editar se usa editDirection) */
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [editMode, setEditMode] = useState<'draw' | 'erase' | 'flag'>('draw');
  const [isDeleting, setIsDeleting] = useState(false);
  const [draftFlags, setDraftFlags] = useState<ReviewFlag[]>([]);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const [snappingMode, setSnappingMode] = useState<'fast' | 'route' | 'trace'>('fast');
  const [valhallaReady, setValhallaReady] = useState<boolean | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftNote, setDraftNote] = useState('');

  // Refs para handlers de mapa (evitan re-suscribir listeners y re-render en cada vértice)
  const draftCoordsRef = useRef<[number, number][]>([]);
  const editModeRef = useRef(editMode);
  const isEditingRef = useRef(isEditing);
  const editDirectionRef = useRef(editDirection);
  const viewModeRef = useRef(viewMode);
  const eraseSweepSetRef = useRef<Set<number>>(new Set());
  const eraseRafRef = useRef<number | null>(null);
  const eraseDraggingRef = useRef(false);
  /** Evita que el `click` posterior al arrastre/mousedown del borrador borre de nuevo */
  const eraseConsumedClickRef = useRef(false);
  const hoveredVertexIdRef = useRef<number | null>(null);

  useEffect(() => {
    draftCoordsRef.current = draftCoords;
  }, [draftCoords]);
  useEffect(() => {
    editModeRef.current = editMode;
  }, [editMode]);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);
  useEffect(() => {
    editDirectionRef.current = editDirection;
  }, [editDirection]);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const handleDirectionChange = (newDirection: 'ida' | 'vuelta') => {
    if (newDirection === editDirection && viewMode !== 'both') {
      setViewMode(newDirection);
      return;
    }

    // 1. Guardar el borrador actual (draftCoords) en loadedGeojson
    if (loadedGeojson && isEditing) {
      const featIdx = loadedGeojson.features?.findIndex(
        (f: any) => directionOfFeature(f) === editDirection
      );
      if (featIdx >= 0) {
        loadedGeojson.features[featIdx].geometry.coordinates = draftCoords;
      }
    }

    // 2. Cargar el trazo de la nueva dirección a draftCoords
    setEditDirection(newDirection);
    setViewMode(newDirection);
    const feat = loadedGeojson?.features?.find(
      (f: any) => directionOfFeature(f) === newDirection
    );
    const coords = feat?.geometry?.coordinates ?? [];
    setDraftCoords(coords);
  };

  const applyMapPreview = useCallback(
    (
      map: maplibregl.Map,
      geojson: RouteFeatureCollection,
      opts?: { fit?: boolean }
    ) => {
      const dir = editDirectionRef.current;
      const mode = viewModeRef.current;
      const editing = isEditingRef.current;
      const draft = draftCoordsRef.current;
      const preview = buildEditPreviewGeojson(
        geojson,
        mode,
        dir,
        editing,
        editing ? draft : undefined
      );
      setQaPreviewData(map, preview as Parameters<typeof setQaPreviewData>[1]);

      if (opts?.fit) {
        const coords: [number, number][] = [];
        for (const f of preview.features ?? []) {
          if (
            f.properties?.type === 'sense-label' ||
            f.geometry?.type !== 'LineString'
          ) {
            continue;
          }
          const c = f.geometry?.coordinates as [number, number][] | undefined;
          if (c?.length) coords.push(...c);
        }
        if (coords.length === 0) {
          for (const f of geojson.features ?? []) {
            const c = f.geometry?.coordinates as [number, number][] | undefined;
            if (c?.length) coords.push(...c);
          }
        }
        if (coords.length > 0) {
          const bounds = coords.reduce(
            (b, c) => b.extend(c),
            new maplibregl.LngLatBounds(coords[0], coords[0])
          );
          map.fitBounds(bounds, { padding: 48, maxZoom: 15 });
        }
      }
    },
    []
  );

  const selected = reports.find((r) => r.route_id === selectedId) ?? null;
  const filtered = reports.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (transportFilter === 'all') return true;
    const kind = normalizeTransportType(r.transport_type, r.route_id, r.route_name);
    return kind === transportFilter;
  });
  const selectedNote = reviewNotes.find((n) => n.route_id === selectedId) ?? null;
  const transportCounts = {
    all: reports.length,
    combi: reports.filter(
      (r) => normalizeTransportType(r.transport_type, r.route_id, r.route_name) === 'combi'
    ).length,
    autobus: reports.filter(
      (r) => normalizeTransportType(r.transport_type, r.route_id, r.route_name) === 'autobus'
    ).length,
  };

  const totals = summary?.totals ?? {
    routes: reports.length,
    approved: reports.filter((r) => r.status === 'approved').length,
    needs_review: reports.filter((r) => r.status === 'needs_review').length,
    rejected: reports.filter((r) => r.status === 'rejected').length,
  };

  const loadReviewNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/qa/review-notes');
      if (!res.ok) return;
      const data = await res.json();
      setReviewNotes(data.notes ?? []);
    } catch (e) {
      console.error('No se pudieron cargar notas de revisión', e);
    }
  }, []);

  useEffect(() => {
    loadReviewNotes();
  }, [loadReviewNotes]);

  // Precalentar Valhalla en background al abrir admin (no bloquea la UI)
  useEffect(() => {
    let cancelled = false;
    const warm = async () => {
      try {
        const statusRes = await fetch('/api/qa/valhalla/ready', { cache: 'no-store' });
        const status = await statusRes.json();
        if (!cancelled) setValhallaReady(Boolean(status.ready));
        if (!status.ready) {
          // Arranque en caliente sin esperar en la UI
          void fetch('/api/qa/valhalla/ready?warm=1', { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => {
              if (!cancelled) setValhallaReady(Boolean(d.ready));
            })
            .catch(() => {
              if (!cancelled) setValhallaReady(false);
            });
        }
      } catch {
        if (!cancelled) setValhallaReady(false);
      }
    };
    warm();
    const interval = setInterval(async () => {
      try {
        const r = await fetch('/api/qa/valhalla/ready', { cache: 'no-store' });
        const d = await r.json();
        if (!cancelled) setValhallaReady(Boolean(d.ready));
      } catch {
        /* ignore */
      }
    }, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    let map: maplibregl.Map | null = null;
    try {
      map = initMoreliaMap({
        container,
        includeWalkLayers: false,
        onReady: (m) => {
          ensureQaPreviewLayers(m);
          ensureEditLayers(m);
          setMapReady(true);
          m.resize();
        },
      });
      mapRef.current = map;
    } catch (e) {
      console.error('Error inicializando mapa QA', e);
    }

    return () => {
      destroyMoreliaMap(map);
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selected) return;

    const loadRoute = async () => {
      try {
        // Prioridad: borrador guardado (matched) vía API — no la copia pública vieja
        let res = await fetch(`/api/qa/geojson/${selected.route_id}?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          res = await fetch(`/routes/${selected.route_id}.geojson?t=${Date.now()}`, {
            cache: 'no-store',
          });
        }
        if (!res.ok) {
          toast('GeoJSON no disponible para esta ruta', 'warning');
          return;
        }
        const geojson = await res.json() as RouteFeatureCollection;
        setLoadedGeojson(geojson);
        const dir = editDirectionRef.current;
        const feat = geojson.features?.find((f) => directionOfFeature(f) === dir);
        const dirCoords = (feat?.geometry?.coordinates ?? []) as [number, number][];
        setDraftCoords(dirCoords);
        applyMapPreview(map, geojson, { fit: true });
        requestAnimationFrame(() => map.resize());
      } catch (e) {
        console.error('No se pudo cargar GeoJSON de preview', e);
        toast('Error al cargar la ruta en el mapa', 'error');
      }
    };

    loadRoute();
  }, [selected, mapReady, applyMapPreview]);

  // Limpiar estados de edición cuando cambia la ruta seleccionada
  useEffect(() => {
    setIsEditing(false);
    setLoadedGeojson(null);
    setDraftCoords([]);
    setDraftFlags([]);
    setSelectedFlagId(null);
    setViewMode('both');
    setEditMode('draw');
  }, [selectedId]);

  // Cargar marcas (flags) iniciales del reporte de notas de revisión
  useEffect(() => {
    if (selectedNote) {
      setDraftFlags(selectedNote.flags ?? []);
    } else {
      setDraftFlags([]);
    }
    setSelectedFlagId(null);
  }, [selectedNote, selectedId]);

  // Click del mapa: dibujar / borrar vértice / pin (handlers estables vía refs)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      if (!isEditingRef.current) return;

      // Si el borrador ya consumió el gesto (clic o arrastre), no re-borrar
      if (eraseConsumedClickRef.current) {
        eraseConsumedClickRef.current = false;
        return;
      }

      const mode = editModeRef.current;
      const { lng, lat } = e.lngLat;
      const clickCoord: [number, number] = [lng, lat];
      const draftCoords = draftCoordsRef.current;

      if (mode === 'erase') {
        // El borrado por clic/arrastre lo maneja el efecto de pincel (mousedown+mousemove)
        return;
      }

      if (mode === 'draw') {
        let closestIndex = -1;
        let minDistance = Infinity;

        for (let idx = 0; idx < draftCoords.length; idx++) {
          const dist = getHaversineDistance(draftCoords[idx], clickCoord);
          if (dist < minDistance) {
            minDistance = dist;
            closestIndex = idx;
          }
        }

        if (minDistance < 8 && closestIndex !== -1) {
          setDraftCoords((prev) => {
            const next = [...prev];
            next[closestIndex] = clickCoord;
            return next;
          });
          toast(`Vértice ${closestIndex + 1} realineado a la nueva posición`, 'info');
          return;
        }

        if (draftCoords.length < 2) {
          setDraftCoords((prev) => [...prev, clickCoord]);
          return;
        }

        let bestMinDistance = Infinity;
        let insertionIndex = draftCoords.length;

        const distToStart = getHaversineDistance(clickCoord, draftCoords[0]);
        const distToEnd = getHaversineDistance(clickCoord, draftCoords[draftCoords.length - 1]);

        if (distToStart < bestMinDistance) {
          bestMinDistance = distToStart;
          insertionIndex = 0;
        }
        if (distToEnd < bestMinDistance) {
          bestMinDistance = distToEnd;
          insertionIndex = draftCoords.length;
        }

        for (let i = 0; i < draftCoords.length - 1; i++) {
          const dist = getDistanceToSegment(draftCoords[i], draftCoords[i + 1], clickCoord);
          if (dist < bestMinDistance) {
            bestMinDistance = dist;
            insertionIndex = i + 1;
          }
        }

        setDraftCoords((prev) => {
          const next = [...prev];
          next.splice(insertionIndex, 0, clickCoord);
          return next;
        });

        if (insertionIndex === 0) {
          toast('Punto agregado al inicio del trazo', 'success');
        } else if (insertionIndex === draftCoords.length) {
          toast('Punto agregado al final del trazo', 'success');
        } else {
          toast(`Punto insertado en el segmento intermedio ${insertionIndex}`, 'success');
        }
        return;
      }

      if (mode === 'flag') {
        const newFlag: ReviewFlag = {
          id: `flag-${Date.now()}`,
          coords: clickCoord,
          note: '',
          created_at: new Date().toISOString(),
          severity: 'review',
        };
        setDraftFlags((prev) => [...prev, newFlag]);
        setSelectedFlagId(newFlag.id);
        setEditMode('draw');
        toast('Pin colocado. Edita su comentario en el menú flotante.', 'info');
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [mapReady]);

  // Borrado por arrastre: en modo borrador, clic+arrastrar borra tramos/puntos (sin Shift)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const flushEraseSweep = () => {
      eraseRafRef.current = null;
      const toRemove = eraseSweepSetRef.current;
      if (toRemove.size === 0) return;
      const remove = new Set(toRemove);
      eraseSweepSetRef.current = new Set();
      eraseConsumedClickRef.current = true;
      setDraftCoords((prev) => prev.filter((_, i) => !remove.has(i)));
    };

    const queueEraseAtLngLat = (lngLat: { lng: number; lat: number }) => {
      if (!isEditingRef.current || editModeRef.current !== 'erase') return;
      const draft = draftCoordsRef.current;
      if (draft.length === 0) return;
      const click: [number, number] = [lngLat.lng, lngLat.lat];
      const radius = eraseRadiusMeters(map.getZoom());

      // Pincel un poco generoso para arrastre cómodo
      const brush = radius * 2.2;
      for (let i = 0; i < draft.length; i++) {
        if (getHaversineDistance(draft[i], click) <= brush) {
          eraseSweepSetRef.current.add(i);
        }
      }
      for (let i = 0; i < draft.length - 1; i++) {
        if (getDistanceToSegment(draft[i], draft[i + 1], click) <= brush) {
          eraseSweepSetRef.current.add(i);
          eraseSweepSetRef.current.add(i + 1);
        }
      }

      if (eraseSweepSetRef.current.size > 0 && eraseRafRef.current == null) {
        eraseRafRef.current = requestAnimationFrame(flushEraseSweep);
      }
    };

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (!isEditingRef.current || editModeRef.current !== 'erase') return;
      if (e.originalEvent.button !== 0) return;
      eraseDraggingRef.current = true;
      eraseConsumedClickRef.current = false;
      map.dragPan.disable();
      map.getCanvas().style.cursor = 'crosshair';
      queueEraseAtLngLat(e.lngLat);
    };

    const onMouseUp = () => {
      if (eraseDraggingRef.current) {
        eraseDraggingRef.current = false;
        map.dragPan.enable();
        if (editModeRef.current === 'erase') {
          map.getCanvas().style.cursor = 'crosshair';
        }
        // Marca el gesto como consumido para que el `click` sintético no haga nada extra
        if (eraseSweepSetRef.current.size > 0 || eraseConsumedClickRef.current) {
          eraseConsumedClickRef.current = true;
        }
      }
    };

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const oe = e.originalEvent;
      // Arrastre con clic (o Shift+clic por compatibilidad)
      const dragging =
        eraseDraggingRef.current ||
        (oe.shiftKey && (oe.buttons & 1) === 1);
      if (
        isEditingRef.current &&
        editModeRef.current === 'erase' &&
        dragging
      ) {
        queueEraseAtLngLat(e.lngLat);
      }

      if (!isEditingRef.current || (editModeRef.current !== 'draw' && editModeRef.current !== 'erase')) {
        if (hoveredVertexIdRef.current != null) {
          try {
            map.setFeatureState(
              { source: EDIT_VERTICES_SOURCE, id: hoveredVertexIdRef.current },
              { hover: false }
            );
          } catch {
            /* source may be empty */
          }
          hoveredVertexIdRef.current = null;
        }
        return;
      }

      if (editModeRef.current === 'erase' && !eraseDraggingRef.current) {
        map.getCanvas().style.cursor = 'crosshair';
      }

      const hits = map.queryRenderedFeatures(e.point, { layers: [EDIT_VERTICES_HIT] });
      const nextId =
        hits[0] && hits[0].id != null
          ? Number(hits[0].id)
          : hits[0]?.properties?.index != null
            ? Number(hits[0].properties.index)
            : null;

      if (hoveredVertexIdRef.current !== nextId) {
        if (hoveredVertexIdRef.current != null) {
          try {
            map.setFeatureState(
              { source: EDIT_VERTICES_SOURCE, id: hoveredVertexIdRef.current },
              { hover: false }
            );
          } catch {
            /* ignore */
          }
        }
        if (nextId != null && !Number.isNaN(nextId)) {
          try {
            map.setFeatureState({ source: EDIT_VERTICES_SOURCE, id: nextId }, { hover: true });
          } catch {
            /* ignore */
          }
          hoveredVertexIdRef.current = nextId;
        } else {
          hoveredVertexIdRef.current = null;
        }
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mouseup', onMouseUp);
    map.on('mouseleave', onMouseUp);
    map.on('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      map.off('mousedown', onMouseDown);
      map.off('mouseup', onMouseUp);
      map.off('mouseleave', onMouseUp);
      map.off('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      map.dragPan.enable();
      eraseDraggingRef.current = false;
      if (eraseRafRef.current != null) cancelAnimationFrame(eraseRafRef.current);
      map.getCanvas().style.cursor = '';
    };
  }, [mapReady]);

  // Pines de revisión (pocos): DOM markers OK; sin scale al hover
  const flagMarkersRef = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    flagMarkersRef.current.forEach((m) => m.remove());
    flagMarkersRef.current = [];

    if (!map || !mapReady) return;

    draftFlags.forEach((flag) => {
      const el = document.createElement('div');
      el.className = `cursor-pointer flex items-center justify-center rounded-xl p-1 shadow-2xl border-2 ${
        flag.severity === 'critical'
          ? 'bg-rose-500 text-white border-rose-600'
          : flag.severity === 'review'
          ? 'bg-amber-500 text-white border-amber-600'
          : 'bg-slate-500 text-white border-slate-600'
      }`;
      el.style.width = '26px';
      el.style.height = '26px';
      el.style.transform = 'none';
      el.innerHTML = '🚩';

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2 text-sm text-[#111]">
          <strong class="capitalize">${flag.severity === 'critical' ? 'Crítica' : flag.severity === 'review' ? 'Revisión' : 'Nota'}</strong>
          <p class="mt-1">${flag.note || '<i>Sin anotación</i>'}</p>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el, draggable: false })
        .setLngLat(flag.coords)
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedFlagId(flag.id);
      });

      flagMarkersRef.current.push(marker);
    });

    return () => {
      flagMarkersRef.current.forEach((m) => m.remove());
      flagMarkersRef.current = [];
    };
  }, [mapReady, draftFlags]);

  // Línea cruda + vértices nativos + preview del sentido activo (oculta el otro)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    ensureEditLayers(map);

    const showVertices = isEditing && (editMode === 'draw' || editMode === 'erase');
    setEditVerticesData(map, draftCoords, showVertices);
    setEditVerticesPaintMode(map, editMode);
    if (isEditing) raiseEditLayers(map);

    const rawSource = map.getSource('edit-raw-source') as maplibregl.GeoJSONSource | undefined;
    if (rawSource) {
      rawSource.setData({
        type: 'FeatureCollection',
        features:
          isEditing && draftCoords.length > 0
            ? [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: {
                    type: 'LineString',
                    coordinates:
                      draftCoords.length === 1
                        ? [draftCoords[0], draftCoords[0]]
                        : draftCoords,
                  },
                },
              ]
            : [],
      });
    }

    if (loadedGeojson) {
      applyMapPreview(map, loadedGeojson);
      if (!isEditing) {
        map.getCanvas().style.cursor = '';
      }
    }
  }, [mapReady, isEditing, editMode, draftCoords, editDirection, viewMode, loadedGeojson, applyMapPreview]);

  // Alineación / Snapping de coordenadas usando la API de Valhalla
  const handleSnapping = async () => {
    if (draftCoords.length < 2) {
      toast('Dibuja al menos 2 puntos en el mapa antes de alinear.', 'warning');
      return;
    }
    setIsMatching(true);
    const modeLabel =
      snappingMode === 'fast' ? 'Rápido' : snappingMode === 'route' ? 'Hitos Valhalla' : 'Trace Valhalla';
    if (snappingMode === 'fast') {
      toast('Alineación rápida entre tus puntos…', 'info', 'Alinear');
    } else {
      toast(
        valhallaReady
          ? `Alineando con Valhalla (${modeLabel})…`
          : 'Esperando Valhalla (puede tardar la 1.ª vez)…',
        'info',
        'Valhalla'
      );
    }
    try {
      const res = await fetch(`/api/qa/geojson/${selectedId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: draftCoords,
          mode: snappingMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Error en snapping');
      }
      setDraftCoords(data.coordinates);
      const eng = data.engine ?? snappingMode;
      toast(
        `Listo (${modeLabel} · ${eng}). Puntos: ${data.snappedCount}.`,
        'success',
        eng.includes('local') ? 'Rápido' : 'Valhalla'
      );
      if (data.engine === 'local-densify' || data.engine === 'valhalla-hitos') {
        // refrescar estado de valhalla
        void fetch('/api/qa/valhalla/ready', { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => setValhallaReady(Boolean(d.ready)))
          .catch(() => undefined);
      }
      if (data.validation?.warnings?.length > 0) {
        toast(String(data.validation.warnings[0]), 'warning');
      }
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Error al alinear', 'error');
    } finally {
      setIsMatching(false);
    }
  };

  const buildDirectionsPayload = (geojson: any, editedDir?: 'ida' | 'vuelta') => {
    const dirs: Array<'ida' | 'vuelta'> = ['ida', 'vuelta'];
    return dirs.map((dir) => {
      const f = geojson.features?.find((feat: any) => directionOfFeature(feat) === dir);
      const isEditedDir = editedDir != null && dir === editedDir;
      return {
        direction: dir,
        avg_snap_m: isEditedDir ? 2.1 : (f?.properties?.avg_snap_m ?? selected?.directions?.find((d) => d.direction === dir)?.avg_snap_m ?? 5.0),
        max_snap_m: isEditedDir ? 5.8 : (f?.properties?.max_snap_m ?? selected?.directions?.find((d) => d.direction === dir)?.max_snap_m ?? 12.0),
        confidence: isEditedDir ? 1.0 : (f?.properties?.confidence ?? selected?.directions?.find((d) => d.direction === dir)?.confidence ?? 1.0),
        validator: isEditedDir
          ? 'valhalla-editor'
          : (f?.properties?.validator ?? selected?.directions?.find((d) => d.direction === dir)?.validator ?? 'valhalla+osrm'),
        issues: [] as { severity: string; direction: string; issue: string }[],
      };
    });
  };

  const refreshReports = async () => {
    const reportsRes = await fetch('/api/qa/reports');
    if (reportsRes.ok) {
      const refreshed = await reportsRes.json();
      if (refreshed.summary) setSummary(refreshed.summary);
      if (refreshed.reports) setReports(refreshed.reports);
    }
  };

  /** Copia el sentido actual (reverse) al opuesto y marca mode=mirrored. */
  const handleMirrorCurrentToOther = () => {
    if (!loadedGeojson || draftCoords.length < 2) {
      toast('Necesitas al menos 2 puntos para espejar el sentido.', 'warning');
      return;
    }
    const from = editDirection;
    const to = from === 'ida' ? 'vuelta' : 'ida';
    const next = applyEditedDirection(loadedGeojson, from, draftCoords, {
      forceMirrorSync: true,
    });
    setLoadedGeojson(next);
    toast(
      `Sentido ${to} = reverse(${from}). Modo espejo: editas un corredor, el otro se deriva.`,
      'success',
      'Espejo ida↔vuelta'
    );
  };

  /** Desvincula sentidos: se editan por separado (líneas independientes). */
  const handleUnlinkDirections = () => {
    if (!loadedGeojson) return;
    // Guardar draft actual sin sincronizar el opuesto
    const next = applyEditedDirection(loadedGeojson, editDirection, draftCoords, {
      forceMirrorSync: false,
    });
    setLoadedGeojson(stampDirectionMode(next, 'independent'));
    toast(
      'Sentidos independientes. Ida y vuelta se editan por separado.',
      'info',
      'Modo independent'
    );
  };

  // Guardar trazo editado (borrador admin): GeoJSON + Supabase, sin Valhalla ni publicar
  const handleSaveRoute = async () => {
    if (!selected || !loadedGeojson) return;
    if (draftCoords.length < 2) {
      toast('El trazo necesita al menos 2 puntos para guardar.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      // Si mode=mirrored, el opuesto se actualiza como reverse del editado
      const nextGeojson = applyEditedDirection(
        loadedGeojson,
        editDirection,
        draftCoords
      ) as RouteFeatureCollection;

      for (const f of nextGeojson.features ?? []) {
        if (!f.properties) f.properties = {};
        f.properties.matched_to_osm = true;
        f.properties.validator = f.properties.validator || 'editor-draft';
        f.properties.qa_status = 'needs_review';
      }

      const saveRes = await fetch(`/api/qa/geojson/${selected.route_id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geojson: nextGeojson,
          directions: buildDirectionsPayload(nextGeojson, editDirection),
          forceApprove: false,
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error ?? 'Error al guardar');
      }

      const currentNote = reviewNotes.find((n) => n.route_id === selected.route_id);
      await fetch('/api/qa/review-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_id: selected.route_id,
          route_name: selected.route_name,
          note: currentNote?.note || `Borrador guardado (${editDirection})`,
          flags: draftFlags,
          action: 'save_note',
        }),
      });

      await loadReviewNotes();
      await refreshReports();

      setIsEditing(false);
      setLoadedGeojson(nextGeojson);

      const sb =
        saveData.savedTo?.supabaseReal
          ? 'Supabase cloud'
          : saveData.savedTo?.supabaseMock
            ? 'Supabase local (mock)'
            : 'archivos';
      toast(
        `Borrador guardado en GeoJSON + ${sb}. Revisa en admin; publica cuando esté listo.`,
        'success',
        'Guardado'
      );
      if (saveData.syncErrors?.length) {
        toast(`Aviso sync: ${saveData.syncErrors[0]}`, 'warning');
      }
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Error al guardar el trazo', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /** Aprobar y publicar la ruta para que el usuario final la vea en el mapa. */
  const handleApproveRoute = async () => {
    if (!selected) return;
    if (
      !window.confirm(
        `¿Aprobar y publicar "${selected.route_name}"?\n\nLa ruta quedará disponible para usuarios en el mapa principal.`
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      let geojson = loadedGeojson;
      if (!geojson) {
        let res = await fetch(`/api/qa/geojson/${selected.route_id}?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          res = await fetch(`/routes/${selected.route_id}.geojson?t=${Date.now()}`, {
            cache: 'no-store',
          });
        }
        if (!res.ok) {
          throw new Error('No se pudo cargar el GeoJSON de la ruta para aprobar.');
        }
        geojson = await res.json();
      }

      let nextGeojson: RouteFeatureCollection = JSON.parse(JSON.stringify(geojson));

      // Si se está editando, aplicar borrador (+ mirror sync si aplica)
      if (isEditing && draftCoords.length >= 2) {
        nextGeojson = applyEditedDirection(nextGeojson, editDirection, draftCoords);
      }

      for (const f of nextGeojson.features ?? []) {
        if (!f.properties) f.properties = {};
        f.properties.qa_status = 'approved';
        f.properties.matched_to_osm = true;
      }

      const saveRes = await fetch(`/api/qa/geojson/${selected.route_id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geojson: nextGeojson,
          directions: buildDirectionsPayload(nextGeojson, isEditing ? editDirection : undefined),
          forceApprove: true,
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error ?? 'Error al aprobar la ruta');
      }

      setLoadedGeojson(nextGeojson);
      setIsEditing(false);
      await refreshReports();

      if (saveData.publishable || saveData.status === 'approved') {
        toast('Ruta aprobada y publicada. Ya es visible para usuarios.', 'success', 'Publicada');
      } else {
        toast(
          `No se pudo publicar (${saveData.status}). Revisa que ida y vuelta tengan trazo válido.`,
          'warning'
        );
      }
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Error al aprobar la ruta', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = () => {
    setDraftCoords((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    if (window.confirm('¿Seguro que deseas eliminar todos los vértices del borrador actual?')) {
      setDraftCoords([]);
    }
  };

  const handleDeleteRoute = async () => {
    if (!selected) return;
    const deletedId = selected.route_id;
    const ok = window.confirm(
      `¿Eliminar permanentemente la ruta "${selected.route_name}" (${deletedId})?\n\n` +
        `Se borrarán GeoJSON (matched/processed/public), reportes QA e índice. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/qa/routes/${encodeURIComponent(deletedId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo eliminar');

      const rest = reports.filter((r) => r.route_id !== deletedId);
      setReports(rest);
      setSelectedId(rest[0]?.route_id ?? null);
      setLoadedGeojson(null);
      setDraftCoords([]);
      setIsEditing(false);
      setViewMode('both');

      try {
        await refreshReports();
      } catch {
        /* ya actualizamos la lista local */
      }
      await loadReviewNotes();
      toast(`Ruta ${deletedId} eliminada`, 'success', 'Eliminada');
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Error al eliminar', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const postReviewAction = async (note: string, action: 'save_note' | 'send_to_review') => {
    if (!selected) return;
    const res = await fetch('/api/qa/review-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        route_id: selected.route_id,
        route_name: selected.route_name,
        note,
        action,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? 'Error en la solicitud');
    }
    return data;
  };

  const handleSaveReviewNote = async (note: string) => {
    if (!selected) return;
    try {
      await postReviewAction(note, 'save_note');
      await loadReviewNotes();
      toast('Nota guardada (la ruta no cambió de estado)', 'success', 'Nota');
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Error al guardar la nota', 'error');
    }
  };

  const handleSendToReview = async (note: string) => {
    if (!selected) return;
    try {
      const data = await postReviewAction(note, 'send_to_review');
      if (data.report) {
        setReports((prev) =>
          prev.map((r) => (r.route_id === selected.route_id ? data.report : r))
        );
      }
      const reportsRes = await fetch('/api/qa/reports');
      if (reportsRes.ok) {
        const refreshed = await reportsRes.json();
        if (refreshed.summary) setSummary(refreshed.summary);
        if (refreshed.reports) setReports(refreshed.reports);
      }
      await loadReviewNotes();
      setFilter('needs_review');
      toast('Ruta enviada a revisión. Ya no es publicable hasta corregir.', 'warning', 'Revisión');
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'No se pudo enviar a revisión', 'error');
    }
  };

  const handleDeleteReviewNote = async () => {
    if (!selected) return;
    try {
      const res = await fetch(
        `/api/qa/review-notes?route_id=${encodeURIComponent(selected.route_id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        toast('No se pudo eliminar la nota', 'error');
        return;
      }
      await loadReviewNotes();
      toast('Nota de revisión eliminada', 'info');
    } catch (e) {
      console.error(e);
      toast('Error al eliminar la nota', 'error');
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f6f7f9] text-[#1a1a1a]">
      <header className="shrink-0 border-b border-[#e5e7eb] bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">
              Rutas Morelia · Fase 5
            </p>
            <h1 className="text-lg font-semibold sm:text-xl">Panel QA de rutas</h1>
          </div>
          <Link
            href="/"
            className="shrink-0 rounded-lg border border-[#e5e7eb] px-3 py-1.5 text-sm transition hover:bg-[#f9fafb]"
          >
            Volver al mapa
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 shrink-0 flex-col overflow-hidden border-b border-[#e5e7eb] lg:order-2 lg:min-w-0 lg:flex-1 lg:border-b-0">
          <div className="relative h-[38vh] min-h-[200px] shrink-0 overflow-hidden bg-[#e8eaed] lg:min-h-0 lg:flex-1">
            <div ref={mapContainerRef} className="qa-map-canvas absolute inset-0 h-full w-full" />

            {/* Filtro de vista ida / vuelta / juntas (fuera del editor) */}
            {!isEditing && loadedGeojson && (
              <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
                <div className="flex rounded-xl border border-[#e5e7eb] bg-white/95 p-1 shadow-lg backdrop-blur-md text-[11px] font-bold">
                  {(
                    [
                      { id: 'ida' as const, label: 'Ida' },
                      { id: 'vuelta' as const, label: 'Vuelta' },
                      { id: 'both' as const, label: 'Juntas' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setViewMode(opt.id);
                        if (opt.id === 'ida' || opt.id === 'vuelta') {
                          setEditDirection(opt.id);
                          const feat = loadedGeojson.features?.find(
                            (f: RouteFeature) => directionOfFeature(f) === opt.id
                          );
                          setDraftCoords(
                            (feat?.geometry?.coordinates as [number, number][]) ?? []
                          );
                        }
                      }}
                      className={`rounded-lg px-2.5 py-1.5 transition cursor-pointer ${
                        viewMode === opt.id
                          ? 'bg-[#111] text-white shadow'
                          : 'text-[#4b5563] hover:bg-[#f3f4f6]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] text-[#6b7280] shadow">
                  Vista: {viewMode === 'both' ? 'ida + vuelta juntas' : viewMode}
                </p>
              </div>
            )}

            {/* Editor Toolbar Overlay */}
            {isEditing && (
              <div className="absolute left-4 top-4 z-10 flex flex-col gap-3 rounded-2xl border border-orange-200/60 bg-white/95 p-4 shadow-2xl backdrop-blur-md w-72 sm:w-80 select-none max-h-[85%] overflow-y-auto text-xs text-[#1a1a1a]">
                <div className="flex items-center justify-between border-b border-[#e5e7eb] pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-[#111] flex items-center gap-1.5">
                      <Edit className="h-4 w-4 text-orange-600 animate-pulse" />
                      Editor de Trazo
                    </h3>
                    <p className="text-[10px] text-[#6b7280]">
                      Modo activo: <span className="font-semibold text-orange-600 uppercase">{editDirection}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-full p-1 hover:bg-[#f3f4f6] text-[#4b5563] transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Alternar sentido de edición (el otro se oculta en el mapa) */}
                <div className="flex flex-col gap-1">
                  <div className="grid grid-cols-2 gap-1.5 bg-[#f3f4f6] p-1 rounded-lg text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleDirectionChange('ida')}
                      className={`py-1 rounded-md transition cursor-pointer ${editDirection === 'ida' ? 'bg-white shadow text-[#111]' : 'text-[#6b7280] hover:text-[#111]'}`}
                    >
                      Ida
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDirectionChange('vuelta')}
                      className={`py-1 rounded-md transition cursor-pointer ${editDirection === 'vuelta' ? 'bg-white shadow text-[#111]' : 'text-[#6b7280] hover:text-[#111]'}`}
                    >
                      Vuelta
                    </button>
                  </div>
                  <p className="text-[10px] text-[#9ca3af] leading-snug">
                    Una sola línea visible. Modo:{' '}
                    <span className="font-semibold text-[#374151]">
                      {loadedGeojson ? getDirectionMode(loadedGeojson) : '—'}
                    </span>
                    {loadedGeojson && getDirectionMode(loadedGeojson) === 'mirrored'
                      ? ' · al guardar, el otro sentido = reverse'
                      : ' · sentidos independientes'}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={handleMirrorCurrentToOther}
                      disabled={draftCoords.length < 2}
                      title="Copia reverse del sentido actual al opuesto y activa modo espejo"
                      className="rounded-md border border-sky-200 bg-sky-50 px-1.5 py-1 text-[10px] font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-40 cursor-pointer"
                    >
                      Espejar → {editDirection === 'ida' ? 'vuelta' : 'ida'}
                    </button>
                    <button
                      type="button"
                      onClick={handleUnlinkDirections}
                      title="Editar ida y vuelta por separado (calles de un solo sentido, desvíos)"
                      className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Desvincular
                    </button>
                  </div>
                </div>

                {/* Selector de Herramienta */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-wider">Herramienta</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setEditMode('draw'); setSelectedFlagId(null); }}
                      className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer ${
                        editMode === 'draw'
                          ? 'bg-orange-50 border-orange-200 text-orange-700 shadow-sm font-bold'
                          : 'bg-white border-[#e5e7eb] hover:bg-[#fafafa]'
                      }`}
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Dibujo
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditMode('erase'); setSelectedFlagId(null); }}
                      className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer ${
                        editMode === 'erase'
                          ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm font-bold'
                          : 'bg-white border-[#e5e7eb] hover:bg-[#fafafa]'
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Borrador
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditMode('flag')}
                      className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg border text-[10px] font-semibold transition cursor-pointer ${
                        editMode === 'flag'
                          ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm font-bold'
                          : 'bg-white border-[#e5e7eb] hover:bg-[#fafafa]'
                      }`}
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Pin 🚩
                    </button>
                  </div>
                </div>

                {editMode === 'draw' && (
                  <div className="rounded-lg bg-orange-50/50 border border-orange-100 p-2 text-[10px] text-orange-950 leading-relaxed">
                    💡 <strong>Modo Dibujo:</strong> Click en el mapa para insertar vértices. Click cerca de un punto existente (&lt;8 m) para realinearlo. Puedes panear y hacer zoom con normalidad.
                  </div>
                )}

                {editMode === 'erase' && (
                  <div className="rounded-lg bg-rose-50/50 border border-rose-100 p-2 text-[10px] text-rose-950 leading-relaxed">
                    💡 <strong>Modo Borrador:</strong> Click en un <strong>punto</strong> o en la <strong>línea</strong> para borrar.
                    <strong> Clic + arrastrar</strong> = pincel (borra tramos y vértices al pasar). El pan del mapa se desactiva solo mientras arrastras con el borrador.
                  </div>
                )}

                {editMode === 'flag' && (
                  <div className="rounded-lg bg-amber-50/50 border border-amber-100 p-2 text-[10px] text-amber-950 leading-relaxed">
                    💡 <strong>Modo Pin:</strong> Haz click en el mapa para colocar un Pin de comentarios y anotaciones de revisión de QA.
                  </div>
                )}

                {/* Subpanel de edición de Pin */}
                {selectedFlagId && (
                  <div className="border-t border-[#e5e7eb] pt-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1">
                        <Flag className="h-3 w-3" />
                        Anotación del Pin
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedFlagId(null)}
                        className="text-[10px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                      >
                        Cerrar Pin
                      </button>
                    </div>
                    <textarea
                      value={draftFlags.find((f) => f.id === selectedFlagId)?.note ?? ''}
                      onChange={(e) => {
                        const noteVal = e.target.value;
                        setDraftFlags((prev) =>
                          prev.map((f) => (f.id === selectedFlagId ? { ...f, note: noteVal } : f))
                        );
                      }}
                      placeholder="Ej: Curva incorrecta, calle de un solo sentido..."
                      rows={2}
                      className="w-full rounded-md border border-[#e5e7eb] bg-white p-2 text-xs text-[#1a1a1a] focus:border-amber-400 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      {(['note', 'review', 'critical'] as const).map((sev) => (
                        <button
                          key={sev}
                          type="button"
                          onClick={() => {
                            setDraftFlags((prev) =>
                              prev.map((f) => (f.id === selectedFlagId ? { ...f, severity: sev } : f))
                            );
                          }}
                          className={`flex-1 py-1 rounded text-[9px] font-bold uppercase transition border cursor-pointer ${
                            draftFlags.find((f) => f.id === selectedFlagId)?.severity === sev
                              ? sev === 'critical'
                                ? 'bg-rose-50 border-rose-300 text-rose-700 font-extrabold'
                                : sev === 'review'
                                ? 'bg-amber-50 border-amber-300 text-amber-700 font-extrabold'
                                : 'bg-slate-50 border-slate-300 text-slate-700 font-extrabold'
                              : 'bg-white border-transparent text-[#6b7280]'
                          }`}
                        >
                          {sev === 'critical' ? 'Crítico' : sev === 'review' ? 'Revisión' : 'Nota'}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftFlags((prev) => prev.filter((f) => f.id !== selectedFlagId));
                        setSelectedFlagId(null);
                        toast('Pin de marca eliminado', 'info');
                      }}
                      className="w-full py-1 text-xs text-rose-600 hover:bg-rose-50 rounded border border-rose-200 transition font-semibold cursor-pointer"
                    >
                      Eliminar Pin 🗑️
                    </button>
                  </div>
                )}

                {/* Alineación: Rápido (default) no espera Valhalla */}
                <div className="border-t border-[#e5e7eb] pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-wider">
                      Alineación
                    </span>
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${
                        valhallaReady === true
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : valhallaReady === false
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                      title="Estado de Valhalla (precalentado en 2º plano)"
                    >
                      {valhallaReady === true
                        ? 'Valhalla listo'
                        : valhallaReady === false
                          ? 'Valhalla frío'
                          : 'Valhalla…'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <label className="flex items-center gap-1 cursor-pointer" title="Instantáneo: densifica entre tus puntos; si Valhalla ya está, usa hitos">
                      <input
                        type="radio"
                        checked={snappingMode === 'fast'}
                        onChange={() => setSnappingMode('fast')}
                        className="accent-orange-600"
                      />
                      Rápido
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer" title="Ruteo Valhalla por hitos (espera si está frío)">
                      <input
                        type="radio"
                        checked={snappingMode === 'route'}
                        onChange={() => setSnappingMode('route')}
                        className="accent-orange-600"
                      />
                      Preciso
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer" title="Map-matching denso Valhalla (más lento)">
                      <input
                        type="radio"
                        checked={snappingMode === 'trace'}
                        onChange={() => setSnappingMode('trace')}
                        className="accent-orange-600"
                      />
                      Trace
                    </label>
                  </div>
                  <p className="text-[10px] text-[#9ca3af] leading-snug">
                    <strong>Rápido</strong> usa tus puntos al momento (sin esperar arranque). Preciso/Trace
                    pegan a la red vial cuando Valhalla está listo.
                  </p>

                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={isMatching || draftCoords.length < 2}
                      onClick={handleSnapping}
                      className="flex-1 rounded-lg bg-orange-600 disabled:bg-[#f3f4f6] disabled:text-[#9ca3af] hover:bg-orange-700 py-1.5 text-xs font-semibold text-white shadow-md transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {isMatching
                        ? snappingMode === 'fast'
                          ? 'Alineando rápido…'
                          : 'Alineando…'
                        : '⚡ Alinear'}
                    </button>
                    <button
                      type="button"
                      disabled={draftCoords.length === 0}
                      onClick={handleUndo}
                      title="Deshacer último vértice"
                      className="rounded-lg border border-[#e5e7eb] bg-white p-1.5 hover:bg-[#fafafa] transition text-[#4b5563] cursor-pointer"
                    >
                      <Undo2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={draftCoords.length === 0}
                      onClick={handleClearAll}
                      title="Limpiar borrador"
                      className="rounded-lg border border-[#e5e7eb] bg-white p-1.5 hover:bg-[#fafafa] transition text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Guardar / Aprobar / Cancelar */}
                <div className="border-t border-[#e5e7eb] pt-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 rounded-lg border border-[#e5e7eb] bg-white hover:bg-[#fafafa] py-2 text-xs font-bold text-[#4b5563] transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isSaving || isMatching}
                      onClick={handleSaveRoute}
                      className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-900 py-2 text-xs font-bold text-white shadow-lg transition flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSaving ? 'Guardando…' : 'Guardar borrador'}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#9ca3af] leading-snug">
                    Guardar = GeoJSON + Supabase (admin). No publica ni requiere Valhalla.
                  </p>
                  <button
                    type="button"
                    disabled={isSaving || isMatching || draftCoords.length < 2}
                    onClick={handleApproveRoute}
                    className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-bold text-white shadow-lg transition flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? 'Publicando…' : '✓ Aprobar y publicar'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <RouteDetailPanel
            selected={selected}
            className="max-h-[28vh] lg:max-h-[32vh]"
            isApproving={isSaving}
            isDeleting={isDeleting}
            viewMode={viewMode}
            isEditing={isEditing}
            editDirection={editDirection}
            directionMode={loadedGeojson ? getDirectionMode(loadedGeojson) : null}
            onViewModeChange={(mode) => {
              if (isEditing) {
                // En edición solo se edita un sentido a la vez
                if (mode === 'both') {
                  toast('En edición usa Ida o Vuelta. Sal del editor para ver juntas.', 'info');
                  return;
                }
                handleDirectionChange(mode);
                return;
              }
              setViewMode(mode);
              if (mode === 'ida' || mode === 'vuelta') {
                setEditDirection(mode);
                if (loadedGeojson) {
                  const feat = loadedGeojson.features?.find(
                    (f: RouteFeature) => directionOfFeature(f) === mode
                  );
                  setDraftCoords(
                    (feat?.geometry?.coordinates as [number, number][]) ?? []
                  );
                }
              }
            }}
            onApproveClick={handleApproveRoute}
            onDeleteClick={handleDeleteRoute}
            onEditClick={() => {
              if (selected) {
                // Al editar, partir del sentido activo (si estabas en juntas → ida)
                const dir = viewMode === 'both' ? editDirection : viewMode;
                setEditDirection(dir);
                setViewMode(dir);
                if (loadedGeojson) {
                  const feat = loadedGeojson.features?.find(
                    (f: RouteFeature) => directionOfFeature(f) === dir
                  );
                  setDraftCoords(
                    (feat?.geometry?.coordinates as [number, number][]) ?? []
                  );
                }
                setIsEditing(true);
                toast(`Modo edición · ${dir}`, 'info');
              }
            }}
          />
        </div>

        <aside className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white lg:order-1 lg:w-[400px] lg:shrink-0 lg:flex-none">
          <SidebarHeader
            totals={totals}
            filter={filter}
            setFilter={setFilter}
            transportFilter={transportFilter}
            setTransportFilter={setTransportFilter}
            transportCounts={transportCounts}
          />
          <ReviewNoteForm
            selected={selected}
            reviewNote={selectedNote}
            onSaveReviewNote={handleSaveReviewNote}
            onSendToReview={handleSendToReview}
            onDeleteReviewNote={handleDeleteReviewNote}
          />
          <RouteList
            filtered={filtered}
            selectedId={selectedId}
            reviewNotes={reviewNotes}
            onSelect={setSelectedId}
          />
        </aside>
      </div>
    </div>
  );
}

function SidebarHeader({
  totals,
  filter,
  setFilter,
  transportFilter,
  setTransportFilter,
  transportCounts,
}: {
  totals: { routes: number; approved: number; needs_review: number; rejected: number };
  filter: FilterStatus;
  setFilter: (f: FilterStatus) => void;
  transportFilter: TransportFilter;
  setTransportFilter: (f: TransportFilter) => void;
  transportCounts: { all: number; combi: number; autobus: number };
}) {
  return (
    <>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-[#e5e7eb] p-4">
        <StatCard label="Total" value={totals.routes} />
        <StatCard label="Aprobadas" value={totals.approved} tone="ok" />
        <StatCard label="Revisión" value={totals.needs_review} tone="warn" />
        <StatCard label="Rechazadas" value={totals.rejected} tone="bad" />
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-b border-[#e5e7eb] p-3">
        <div className="flex flex-wrap gap-1">
          {(['all', 'approved', 'needs_review', 'rejected'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                filter === s ? 'bg-[#111] text-white' : 'bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb]'
              }`}
            >
              {s === 'all' ? 'Todas' : statusLabel(s as QaStatus)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af] mr-1">
            Tipo
          </span>
          {([
            { id: 'all' as const, label: `Todos (${transportCounts.all})` },
            { id: 'combi' as const, label: `Combis (${transportCounts.combi})` },
            { id: 'autobus' as const, label: `Autobuses (${transportCounts.autobus})` },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTransportFilter(t.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                transportFilter === t.id
                  ? t.id === 'combi'
                    ? 'bg-violet-700 text-white'
                    : t.id === 'autobus'
                      ? 'bg-sky-700 text-white'
                      : 'bg-[#111] text-white'
                  : 'bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function RouteList({
  filtered,
  selectedId,
  reviewNotes,
  onSelect,
}: {
  filtered: QaFinalReport[];
  selectedId: string | null;
  reviewNotes: ReviewNote[];
  onSelect: (id: string) => void;
}) {
  const noteByRoute = new Map(reviewNotes.map((n) => [n.route_id, n]));

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
      {filtered.length === 0 && (
        <li className="p-4 text-sm text-[#6b7280]">Sin reportes para este filtro.</li>
      )}
      {filtered.map((r) => {
        const note = noteByRoute.get(r.route_id);
        const kind = normalizeTransportType(r.transport_type, r.route_id, r.route_name);
        return (
          <motion.li
            key={r.route_id}
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              onClick={() => onSelect(r.route_id)}
              className={`mb-1 w-full rounded-lg border p-3 text-left transition ${
                selectedId === r.route_id
                  ? 'border-[#111] bg-[#f9fafb]'
                  : 'border-transparent hover:border-[#e5e7eb] hover:bg-[#fafafa]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.route_name}</span>
                <div className="flex items-center gap-1.5">
                  {note && (
                    <span
                      className={`rounded-full p-1 ${
                        note.status === 'needs_review'
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      title={note.note}
                    >
                      <StickyNote className="h-3 w-3" aria-hidden />
                    </span>
                  )}
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColorClass(r.status)}`}
                  >
                    {statusLabel(r.status)}
                  </span>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${transportBadgeClass(kind)}`}
                >
                  {kind === 'combi' ? 'Combi' : 'Autobús'}
                </span>
                <span className="text-xs text-[#6b7280]">
                  {r.issues.length} incidencias · {r.publishable ? 'publicable' : 'no publicable'}
                </span>
              </div>
              {note && (
                <p className="mt-1 line-clamp-2 text-[11px] text-amber-800/90">{note.note}</p>
              )}
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

function ReviewNoteForm({
  selected,
  reviewNote,
  onSaveReviewNote,
  onSendToReview,
  onDeleteReviewNote,
}: {
  selected: QaFinalReport | null;
  reviewNote: ReviewNote | null;
  onSaveReviewNote: (note: string) => Promise<void>;
  onSendToReview: (note: string) => Promise<void>;
  onDeleteReviewNote: () => Promise<void>;
}) {
  const [draftNote, setDraftNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setDraftNote(reviewNote?.note ?? '');
  }, [reviewNote, selected?.route_id]);

  const requireNote = () => {
    const trimmed = draftNote.trim();
    if (!trimmed) {
      toast('Escribe qué debes revisar en esta ruta', 'warning');
      return null;
    }
    return trimmed;
  };

  const handleSave = async () => {
    if (!selected) return;
    const trimmed = requireNote();
    if (!trimmed) return;
    setSaving(true);
    await onSaveReviewNote(trimmed);
    setSaving(false);
  };

  const handleSend = async () => {
    if (!selected) return;
    const trimmed = requireNote();
    if (!trimmed) return;
    setSending(true);
    await onSendToReview(trimmed);
    setSending(false);
  };

  const isInReview =
    selected?.status === 'needs_review' || reviewNote?.status === 'needs_review';

  return (
    <section className="shrink-0 border-b border-[#e5e7eb] bg-[#fffdf5] p-3">
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[#1a1a1a]">
        <MessageSquareText className="h-4 w-4 text-amber-700" aria-hidden />
        Nota y envío a revisión
      </div>
      <p className="mb-2 text-[11px] leading-snug text-[#6b7280]">
        <strong>Guardar nota</strong> solo archiva tu comentario.{' '}
        <strong>Enviar a revisión</strong> cambia el estado QA de la ruta y la saca de publicación.
      </p>
      {selected ? (
        <p className="mb-2 truncate text-xs font-medium text-[#374151]">
          Ruta: <span className="text-[#111]">{selected.route_name}</span>
          <span
            className={`ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${statusColorClass(selected.status)}`}
          >
            {statusLabel(selected.status)}
          </span>
        </p>
      ) : (
        <p className="mb-2 text-xs text-[#9ca3af]">Selecciona una ruta de la lista inferior.</p>
      )}
      {isInReview && selected && (
        <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
          Esta ruta está en cola de revisión manual.
        </p>
      )}
      {reviewNote?.status === 'note' && selected && (
        <p className="mb-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
          Tienes una nota guardada; aún no se envió a revisión.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <textarea
          value={draftNote}
          onChange={(e) => setDraftNote(e.target.value)}
          rows={3}
          disabled={!selected}
          placeholder={
            selected
              ? 'Ej: Ruta incompleta — revisar KML y PDF...'
              : 'Primero elige una ruta...'
          }
          className="w-full resize-y rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1a1a1a] placeholder:text-[#9ca3af] focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:cursor-not-allowed disabled:bg-[#f9fafb] disabled:text-[#9ca3af]"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!selected || saving || sending}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] transition hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            {saving ? 'Guardando…' : 'Guardar nota'}
          </button>
          <button
            type="button"
            disabled={!selected || saving || sending}
            onClick={handleSend}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SendHorizontal className="h-3.5 w-3.5" aria-hidden />
            {sending ? 'Enviando…' : 'Enviar a revisión'}
          </button>
          {reviewNote && selected && (
            <button
              type="button"
              onClick={onDeleteReviewNote}
              className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
            >
              Quitar nota
            </button>
          )}
        </div>
      </div>
      {reviewNote && selected && (
        <p className="mt-2 text-[10px] text-[#9ca3af]">
          Actualizada: {new Date(reviewNote.updated_at).toLocaleString('es-MX')}
          {reviewNote.status === 'note' ? ' · borrador' : ' · enviada a revisión'}
        </p>
      )}
    </section>
  );
}

function RouteDetailPanel({
  selected,
  className = '',
  onEditClick,
  onApproveClick,
  onDeleteClick,
  isApproving,
  isDeleting,
  viewMode = 'both',
  isEditing = false,
  editDirection = 'ida',
  onViewModeChange,
  directionMode,
}: {
  selected: QaFinalReport | null;
  className?: string;
  onEditClick?: () => void;
  onApproveClick?: () => void;
  onDeleteClick?: () => void;
  isApproving?: boolean;
  isDeleting?: boolean;
  /** Vista del mapa: ida | vuelta | juntas */
  viewMode?: ViewMode;
  isEditing?: boolean;
  editDirection?: 'ida' | 'vuelta';
  onViewModeChange?: (mode: ViewMode) => void;
  directionMode?: string | null;
}) {
  if (!selected) {
    return (
      <div
        className={`shrink-0 overflow-y-auto border-t border-[#e5e7eb] bg-white p-4 text-sm text-[#6b7280] ${className}`}
      >
        Selecciona una ruta para ver incidencias y métricas en el mapa.
      </div>
    );
  }

  const isApproved = selected.status === 'approved' && selected.publishable;
  const transportKind = normalizeTransportType(
    selected.transport_type,
    selected.route_id,
    selected.route_name
  );
  // En edición el filtro activo es el sentido de edición; fuera, viewMode
  const activeView: ViewMode = isEditing ? editDirection : viewMode;

  return (
    <div
      className={`shrink-0 overflow-y-auto overscroll-contain border-t border-[#e5e7eb] bg-white p-4 ${className}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{selected.route_name}</h2>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${transportBadgeClass(transportKind)}`}
          >
            {transportKind === 'combi' ? 'Combi' : 'Autobús'}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusColorClass(selected.status)}`}
          >
            {statusLabel(selected.status)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div
            className="flex rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] p-0.5 text-[10px] font-bold"
            title="Vista del mapa: un sentido o ambos juntos"
          >
            {(
              [
                { id: 'ida' as const, label: 'Ida' },
                { id: 'vuelta' as const, label: 'Vuelta' },
                { id: 'both' as const, label: 'Juntas' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onViewModeChange?.(opt.id)}
                disabled={isEditing && opt.id === 'both'}
                className={`rounded-md px-2 py-1 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                  activeView === opt.id ? 'bg-white shadow text-[#111]' : 'text-[#6b7280] hover:text-[#111]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {directionMode && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                directionMode === 'mirrored'
                  ? 'border-sky-200 bg-sky-50 text-sky-800'
                  : directionMode === 'dual_ring'
                    ? 'border-violet-200 bg-violet-50 text-violet-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
              title={
                directionMode === 'mirrored'
                  ? 'Corredor único: vuelta ≈ reverse(ida)'
                  : directionMode === 'dual_ring'
                    ? 'Anillo dual: ida y vuelta son trazos reales distintos'
                    : 'Ida y vuelta independientes'
              }
            >
              {directionMode}
            </span>
          )}
          <button
            type="button"
            onClick={onEditClick}
            className="shrink-0 rounded-lg bg-orange-600 hover:bg-orange-700 px-3 py-1.5 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow cursor-pointer"
          >
            ✏️ Editar Trazo
          </button>
          <button
            type="button"
            onClick={onApproveClick}
            disabled={isApproving || isApproved || isDeleting}
            title={
              isApproved
                ? 'Ya está aprobada y publicada'
                : 'Aprobar y publicar para usuarios'
            }
            className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-100 disabled:text-emerald-700/70 px-3 py-1.5 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow cursor-pointer disabled:cursor-default"
          >
            {isApproving ? 'Publicando…' : isApproved ? '✓ Publicada' : '✓ Aprobar ruta'}
          </button>
          <button
            type="button"
            onClick={onDeleteClick}
            disabled={isDeleting || isApproving}
            title="Eliminar permanentemente esta ruta (GeoJSON, reportes e índice)"
            className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? 'Eliminando…' : 'Eliminar ruta'}
          </button>
        </div>
      </div>

      {isApproved ? (
        <p className="mb-3 text-xs text-emerald-700 font-medium">
          Publicada en /public/routes — visible para usuarios en el mapa.
        </p>
      ) : (
        <p className="mb-3 text-xs text-rose-700 font-medium">
          Aún no publicada. Usa <strong>Aprobar ruta</strong> cuando el trazo esté bien (ida y
          vuelta).
        </p>
      )}

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {selected.directions.map((d) => (
          <div
            key={d.direction}
            className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 text-sm"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium capitalize">{d.direction}</span>
              <span className="text-xs text-[#6b7280]">{d.qa_status ?? '—'}</span>
            </div>
            <p className="text-xs text-[#4b5563]">
              Snap avg {formatSnapDistance(d.avg_snap_m)} · max{' '}
              {formatSnapDistance(d.max_snap_m)} · conf{' '}
              {d.confidence != null ? d.confidence.toFixed(3) : '—'}
            </p>
            <p className="mt-1 text-xs">
              {isValhallaValidated(d.validator) ? (
                <span className="text-emerald-700">Validado con Valhalla</span>
              ) : (
                <span className="text-amber-700">{d.validator ?? 'Sin validador'}</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {selected.issues.length > 0 ? (
        <ul className="mb-4 space-y-2 text-sm">
          {selected.issues.map((issue, idx) => (
            <li
              key={`${issue.issue}-${idx}`}
              className={`rounded-md border px-3 py-2 ${
                issue.severity === 'critical'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <span className="text-[10px] font-medium uppercase">
                {issue.severity}
                {issue.direction ? ` · ${issue.direction}` : ''}
              </span>
              <p>{issue.issue}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-emerald-700">Sin incidencias. Ruta lista para publicación.</p>
      )}

      <p className="mt-2 text-xs text-[#6b7280]">
        Pipeline:{' '}
        <code className="rounded bg-[#f3f4f6] px-1">bash scripts/run_pipeline_wsl.sh</code>
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'ok'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'bad'
          ? 'text-rose-700'
          : 'text-[#111]';
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3">
      <p className="text-xs text-[#6b7280]">{label}</p>
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}