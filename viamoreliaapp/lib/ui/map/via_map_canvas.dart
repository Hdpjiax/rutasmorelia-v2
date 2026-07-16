import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:maplibre/maplibre.dart';
import '../../core/constants/geo_constants.dart';
import '../../core/theme/via_theme.dart';
import '../../gis/direction_mode.dart';
import '../../models/place_model.dart';
import '../../models/route_model.dart';
import '../../models/segment_model.dart';
import '../../models/trip_plan_model.dart';
import '../micro/via_orb.dart';
import 'basemap_enhance.dart';
import '../../state/app_controller.dart';

/// Mapa MapLibre + Positron GL + enhance web + etiquetas sin solaparse.
class ViaMapCanvas extends ConsumerStatefulWidget {
  final PlaceModel? origin;
  final PlaceModel? destination;
  final LatLng? userPosition;
  final TripPlanModel? activePlan;
  final RouteMetaModel? selectedRoute;
  final List<RouteShapeModel> shapes;
  final bool tracking;
  final bool pinDropActive;
  final String routeDirectionFilter;
  final LatLng? projectedOnRoute;
  final void Function(MapController controller)? onMapCreated;
  final void Function(LatLng point)? onTap;
  final void Function(LatLng point)? onLongPress;

  const ViaMapCanvas({
    super.key,
    required this.origin,
    required this.destination,
    required this.userPosition,
    required this.activePlan,
    required this.selectedRoute,
    required this.shapes,
    this.tracking = false,
    this.pinDropActive = false,
    this.routeDirectionFilter = 'both',
    this.projectedOnRoute,
    this.onMapCreated,
    this.onTap,
    this.onLongPress,
  });

  @override
  ConsumerState<ViaMapCanvas> createState() => _ViaMapCanvasState();
}

class _ViaMapCanvasState extends ConsumerState<ViaMapCanvas> with SingleTickerProviderStateMixin {
  MapController? _controller;
  bool _basemapEnhanced = false;
  late final AnimationController _arrowCtrl;
  double _arrowT = 0;
  DateTime _lastArrowUi = DateTime.fromMillisecondsSinceEpoch(0);

  // Cache solo de polylines (baratas de invalidar). Marcadores se redibujan
  // con flechas a ~4–5 fps (impacto visual sin 60 rebuilds/s).
  Object? _layersKey;
  List<Layer> _cachedLayers = const [];

  static const _positronStyle =
      'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  /// Máx. puntos por polyline en pantalla (MapLibre se ahoga con miles de vértices).
  static const int _maxLinePoints = 160;

  @override
  void initState() {
    super.initState();
    _arrowCtrl = AnimationController(vsync: this, duration: ViaMotion.arrowLoop)
      ..addListener(_onArrowTick)
      ..repeat();
  }

  void _onArrowTick() {
    final now = DateTime.now();
    // ~4.5 fps: se ve el movimiento, no satura el UI thread
    if (now.difference(_lastArrowUi).inMilliseconds < 220) return;
    _lastArrowUi = now;
    if (!mounted) return;
    setState(() => _arrowT = _arrowCtrl.value);
  }

  @override
  void dispose() {
    _arrowCtrl
      ..removeListener(_onArrowTick)
      ..dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant ViaMapCanvas oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.userPosition != null &&
        widget.tracking &&
        oldWidget.userPosition != widget.userPosition) {
      final p = widget.userPosition!;
      _controller?.moveCamera(
        center: Geographic(lon: p.longitude, lat: p.latitude),
      );
    }
    if (oldWidget.selectedRoute != widget.selectedRoute ||
        oldWidget.activePlan != widget.activePlan ||
        oldWidget.routeDirectionFilter != widget.routeDirectionFilter ||
        oldWidget.shapes != widget.shapes) {
      _updateNativeLayers();
    }
  }

  Geographic _g(LatLng p) => Geographic(lon: p.longitude, lat: p.latitude);

  /// Reduce vértices manteniendo extremos (mucho más barato al pintar).
  List<LatLng> _decimate(List<LatLng> coords, {int maxPoints = _maxLinePoints}) {
    if (coords.length <= maxPoints) return coords;
    final step = (coords.length / maxPoints).ceil().clamp(2, 200);
    final out = <LatLng>[coords.first];
    for (var i = step; i < coords.length - 1; i += step) {
      out.add(coords[i]);
    }
    out.add(coords.last);
    return out;
  }

  Feature<LineString> _lineFeature(List<LatLng> coords, {String? id}) {
    final slim = _decimate(coords);
    final flat = <double>[];
    for (final c in slim) {
      flat.add(c.longitude);
      flat.add(c.latitude);
    }
    return Feature(
      id: id,
      geometry: LineString(flat.positions(Coords.xy)),
    );
  }

  Object? _planKey(TripPlanModel? p) {
    if (p == null) return null;
    return (
      p.type,
      p.segments.length,
      p.totalDuration.round(),
      p.boardingPoint.latitude.toStringAsFixed(5),
      p.alightingPoint.longitude.toStringAsFixed(5),
    );
  }

  int _shapesFingerprint() {
    if (widget.shapes.isEmpty) return 0;
    var h = widget.shapes.length;
    for (final s in widget.shapes) {
      h = Object.hash(h, s.id, s.coordinates.length, s.direction);
    }
    return h;
  }

  Object _computeLayersKey() => (
        _planKey(widget.activePlan),
        _shapesFingerprint(),
        widget.routeDirectionFilter,
      );



  void _updateNativeLayers() {
    final style = _controller?.style;
    if (style == null) return;

    scheduleMicrotask(() async {
      try {
        try {
          await style.removeLayer('rm-pmtiles-casing');
        } catch (_) {}
        try {
          await style.removeLayer('rm-pmtiles-fill');
        } catch (_) {}

        if (widget.activePlan != null) {
          final usedIds = widget.activePlan!.segments
              .where((s) => s.routeId != null)
              .map((s) => s.routeId!)
              .toList();

          if (usedIds.isNotEmpty) {
            final filter = ['in', ['get', 'routeId'], ['literal', usedIds]];

            await style.addLayer(
              LineStyleLayer(
                id: 'rm-pmtiles-casing',
                sourceId: 'rutas-pmtiles-source',
                sourceLayerId: 'rutas',
                filter: filter,
                paint: {
                  'line-color': ['get', 'casingColor'],
                  'line-width': 3.0,
                  'line-opacity': 0.14,
                },
                layout: {
                  'line-cap': 'round',
                  'line-join': 'round',
                },
              ),
            );

            await style.addLayer(
              LineStyleLayer(
                id: 'rm-pmtiles-fill',
                sourceId: 'rutas-pmtiles-source',
                sourceLayerId: 'rutas',
                filter: filter,
                paint: {
                  'line-color': ['get', 'color'],
                  'line-width': 2.0,
                  'line-opacity': 0.20,
                },
                layout: {
                  'line-cap': 'round',
                  'line-join': 'round',
                },
              ),
            );
          }
        } else if (widget.selectedRoute != null) {
          final routeId = widget.selectedRoute!.id;
          final List<Object> filter;

          if (widget.routeDirectionFilter == 'ida') {
            filter = [
              'all',
              ['==', ['get', 'routeId'], routeId],
              ['==', ['get', 'direction'], 'ida']
            ];
          } else if (widget.routeDirectionFilter == 'vuelta') {
            filter = [
              'all',
              ['==', ['get', 'routeId'], routeId],
              ['==', ['get', 'direction'], 'vuelta']
            ];
          } else {
            filter = ['==', ['get', 'routeId'], routeId];
          }

          await style.addLayer(
            LineStyleLayer(
              id: 'rm-pmtiles-casing',
              sourceId: 'rutas-pmtiles-source',
              sourceLayerId: 'rutas',
              filter: filter,
              paint: {
                'line-color': ['get', 'casingColor'],
                'line-width': 4.0,
                'line-opacity': 1.0,
              },
              layout: {
                'line-cap': 'round',
                'line-join': 'round',
              },
            ),
          );

          await style.addLayer(
            LineStyleLayer(
              id: 'rm-pmtiles-fill',
              sourceId: 'rutas-pmtiles-source',
              sourceLayerId: 'rutas',
              filter: filter,
              paint: {
                'line-color': ['get', 'color'],
                'line-width': 3.0,
                'line-opacity': 1.0,
              },
              layout: {
                'line-cap': 'round',
                'line-join': 'round',
              },
            ),
          );
        }
      } catch (e) {
        debugPrint('Error updating native PMTiles layers: $e');
      }
    });
  }

  List<Layer> _buildLayers() {
    final layers = <Layer>[];

    if (widget.activePlan != null) {
      _layersForPlan(widget.activePlan!, layers);
    }

    return layers;
  }

  void _layersForPlan(TripPlanModel plan, List<Layer> layers) {
    final usedIds = plan.segments
        .where((s) => s.routeId != null)
        .map((s) => s.routeId!)
        .toSet();

    // Tramo activo del plan: delgado (antes casing 10 / fill 6)
    for (final segment in plan.segments) {
      if (segment.type == SegmentType.ride &&
          segment.boardingPoint != null &&
          segment.alightingPoint != null) {
        final shape = widget.shapes.cast<RouteShapeModel?>().firstWhere(
              (s) =>
                  s != null &&
                  s.routeId == segment.routeId &&
                  s.direction == segment.direction,
              orElse: () => null,
            );
        final coords = shape != null
            ? _slice(shape.coordinates, segment.boardingPoint!, segment.alightingPoint!)
            : [segment.boardingPoint!, segment.alightingPoint!];
        if (coords.length < 2) continue;
        final color = segment.color ?? ViaColors.mint;
        layers.add(PolylineLayer(
          polylines: [_lineFeature(coords, id: 'seg-cas-${segment.routeId}')],
          color: const Color(0xFF0F172A),
          width: 4,
        ));
        layers.add(PolylineLayer(
          polylines: [_lineFeature(coords, id: 'seg-${segment.routeId}')],
          color: color,
          width: 3,
        ));
      } else if (segment.type == SegmentType.walk &&
          segment.walkFrom != null &&
          segment.walkTo != null) {
        final path = segment.walkPath ?? [segment.walkFrom!, segment.walkTo!];
        if (path.length < 2) continue;
        final color = switch (segment.walkKind) {
          WalkKind.toBoard => ViaColors.walkToBoard,
          WalkKind.fromAlight => ViaColors.walkFromAlight,
          WalkKind.transfer => const Color(0xFF6AA9D8), // azul bajito
          null => ViaColors.textSecondary,
        };
        layers.add(PolylineLayer(
          polylines: [_lineFeature(path, id: 'walk-cas-${segment.walkKind}')],
          color: Colors.white.withValues(alpha: 0.85),
          width: 3,
        ));
        layers.add(PolylineLayer(
          polylines: [_lineFeature(path, id: 'walk-${segment.walkKind}')],
          color: color,
          width: 2,
          dashArray: const [2, 2],
        ));
      }
    }
  }

  /// Etiquetas, orbes y flechas con animación suave (throttle en setState).
  List<Marker> _buildMarkers(double t) {
    final markers = <Marker>[];

    if (widget.userPosition != null) {
      markers.add(Marker(
        point: _g(widget.userPosition!),
        size: const Size(32, 32),
        child: ViaUserDot(size: 28, pulse: widget.tracking),
      ));
    }
    if (widget.tracking && widget.projectedOnRoute != null) {
      markers.add(Marker(
        point: _g(widget.projectedOnRoute!),
        size: const Size(22, 22),
        child: Container(
          decoration: BoxDecoration(
            color: ViaColors.coral,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(color: ViaColors.coral.withValues(alpha: 0.45), blurRadius: 8),
            ],
          ),
        ),
      ));
    }
    if (widget.origin != null) {
      markers.add(Marker(
        point: _g(widget.origin!.coordinates),
        size: const Size(52, 52),
        alignment: Alignment.bottomCenter,
        child: const ViaOrb(
          color: ViaColors.origin,
          icon: Icons.trip_origin_rounded,
          size: 48,
          pulse: true,
        ),
      ));
    }
    if (widget.destination != null) {
      markers.add(Marker(
        point: _g(widget.destination!.coordinates),
        size: const Size(52, 52),
        alignment: Alignment.bottomCenter,
        child: const ViaOrb(
          color: ViaColors.destination,
          icon: Icons.flag_rounded,
          size: 48,
          pulse: true,
        ),
      ));
    }

    if (widget.activePlan != null) {
      _markersForPlan(widget.activePlan!, markers, t);
    } else {
      final display = DirectionModeService.toCorridorDisplay(
        widget.shapes,
        preferDirection: widget.routeDirectionFilter,
      );
      for (final shape in display) {
        if (shape.coordinates.length < 10) continue;
        final label = shape.direction == 'vuelta' ? 'Vuelta' : 'Ida';
        // Ida ~35%, Vuelta ~65% — no el mismo punto
        final frac = shape.direction == 'vuelta' ? 0.65 : 0.35;
        final pt = _pointAtFraction(shape.coordinates, frac);
        markers.add(Marker(
          point: _g(pt),
          size: const Size(48, 28),
          alignment: shape.direction == 'vuelta'
              ? Alignment.topCenter
              : Alignment.bottomCenter,
          child: _senseChip(label),
        ));
        _addArrows(
          markers,
          shape.coordinates,
          shape.color,
          t,
          count: 4,
          skipEnds: 0.14,
        );
      }
    }

    return markers;
  }

  void _markersForPlan(TripPlanModel plan, List<Marker> markers, double t) {
    final segs = plan.segments;

    bool isTransferWalk(int i) {
      if (i < 0 || i >= segs.length) return false;
      final s = segs[i];
      return s.type == SegmentType.walk && s.walkKind == WalkKind.transfer;
    }

    // 1) Solo «Transbordo» en el tramo a pie de cambio (azul bajito, sin Sube/Baja)
    for (final segment in segs) {
      if (segment.type != SegmentType.walk || segment.walkKind != WalkKind.transfer) {
        continue;
      }
      final path = segment.walkPath ??
          (segment.walkFrom != null && segment.walkTo != null
              ? [segment.walkFrom!, segment.walkTo!]
              : <LatLng>[]);
      if (path.length < 2) continue;
      final mid = _pointAtFraction(path, 0.5);
      final short = path.length < 4 || _approxMeters(path.first, path.last) < 55;
      final labelPoint = short
          ? LatLng(mid.latitude + 0.00018, mid.longitude - 0.00012)
          : mid;
      markers.add(Marker(
        point: _g(labelPoint),
        size: const Size(92, 32),
        alignment: Alignment.center,
        child: _transferChip(),
      ));
    }

    // 2) Tramos en combi: flechas + Ida/Vuelta + Sube/Baja solo en extremos (no en transbordo)
    for (var i = 0; i < segs.length; i++) {
      final segment = segs[i];
      if (segment.type == SegmentType.ride &&
          segment.boardingPoint != null &&
          segment.alightingPoint != null) {
        final shape = widget.shapes.cast<RouteShapeModel?>().firstWhere(
              (s) =>
                  s != null &&
                  s.routeId == segment.routeId &&
                  s.direction == segment.direction,
              orElse: () => null,
            );
        final coords = shape != null
            ? _slice(shape.coordinates, segment.boardingPoint!, segment.alightingPoint!)
            : [segment.boardingPoint!, segment.alightingPoint!];
        final color = segment.color ?? ViaColors.mint;

        if (coords.length >= 4) {
          _addArrows(markers, coords, color, t, count: 4, skipEnds: 0.18);
          final sensePt = _pointAtFraction(coords, 0.45);
          markers.add(Marker(
            point: _g(sensePt),
            size: const Size(48, 26),
            alignment: Alignment.bottomCenter,
            child: _senseChip(segment.direction == 'vuelta' ? 'Vuelta' : 'Ida'),
          ));
        }

        // Si el tramo anterior/siguiente es caminata de transbordo → no Sube/Baja ahí
        final boardIsTransfer = isTransferWalk(i - 1);
        final alightIsTransfer = isTransferWalk(i + 1);

        if (!boardIsTransfer) {
          markers.add(Marker(
            point: _g(segment.boardingPoint!),
            size: const Size(52, 30),
            alignment: Alignment.bottomCenter,
            child: _stopChip('Sube', ViaColors.amber),
          ));
        }
        if (!alightIsTransfer) {
          markers.add(Marker(
            point: _g(segment.alightingPoint!),
            size: const Size(52, 30),
            alignment: Alignment.topCenter,
            child: _stopChip('Baja', ViaColors.violet),
          ));
        }
      } else if (segment.type == SegmentType.walk) {
        final path = segment.walkPath ??
            (segment.walkFrom != null && segment.walkTo != null
                ? [segment.walkFrom!, segment.walkTo!]
                : <LatLng>[]);
        if (path.length > 4) {
          final color = switch (segment.walkKind) {
            WalkKind.toBoard => ViaColors.walkToBoard,
            WalkKind.fromAlight => ViaColors.walkFromAlight,
            WalkKind.transfer => const Color(0xFF6AA9D8),
            null => ViaColors.textSecondary,
          };
          _addArrows(markers, path, color, t, count: 2, size: 12, skipEnds: 0.22);
        }
      }
    }
  }

  /// Aprox. metros (plano local Morelia; suficiente para decidir offset de labels).
  double _approxMeters(LatLng a, LatLng b) {
    const mPerDegLat = 111320.0;
    final mPerDegLon = 111320.0 * math.cos(a.latitude * math.pi / 180);
    final dy = (a.latitude - b.latitude) * mPerDegLat;
    final dx = (a.longitude - b.longitude) * mPerDegLon;
    return math.sqrt(dx * dx + dy * dy);
  }

  LatLng _pointAtFraction(List<LatLng> coords, double fraction) {
    if (coords.isEmpty) return GeoConstants.moreliaCenter;
    if (coords.length == 1) return coords.first;
    final f = fraction.clamp(0.0, 1.0);
    final exact = f * (coords.length - 1);
    final i = exact.floor().clamp(0, coords.length - 2);
    final t = exact - i;
    final a = coords[i];
    final b = coords[i + 1];
    return LatLng(
      a.latitude + (b.latitude - a.latitude) * t,
      a.longitude + (b.longitude - a.longitude) * t,
    );
  }

  /// Flechas de sentido con loop suave (el setState ya va throttled).
  void _addArrows(
    List<Marker> markers,
    List<LatLng> coords,
    Color color,
    double animationValue, {
    int count = 4,
    double size = 13,
    double skipEnds = 0.1,
  }) {
    if (coords.length < 4) return;
    final slim = _decimate(coords, maxPoints: 80);
    if (slim.length < 4) return;
    final span = 1.0 - 2 * skipEnds;
    for (var k = 0; k < count; k++) {
      final base = skipEnds + span * (k / count);
      final frac = skipEnds + ((base - skipEnds + animationValue * span) % span);
      final exact = frac * (slim.length - 2);
      final index = exact.floor().clamp(0, slim.length - 2);
      final rem = exact - index;
      final p1 = slim[index];
      final p2 = slim[index + 1];
      final lat = p1.latitude + (p2.latitude - p1.latitude) * rem;
      final lng = p1.longitude + (p2.longitude - p1.longitude) * rem;
      final angle = math.atan2(p2.latitude - p1.latitude, p2.longitude - p1.longitude);
      markers.add(Marker(
        point: Geographic(lon: lng, lat: lat),
        size: Size(size + 2, size + 2),
        child: Transform.rotate(
          angle: -angle + (math.pi / 2),
          child: Icon(
            Icons.navigation_rounded,
            size: size,
            color: Colors.white,
            shadows: [
              Shadow(color: color.withValues(alpha: 0.9), blurRadius: 2),
              const Shadow(color: Colors.black54, blurRadius: 2),
            ],
          ),
        ),
      ));
    }
  }

  Widget _senseChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF1E293B), width: 1.2),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 1)),
        ],
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w900,
          color: Color(0xFF0F172A),
          height: 1.1,
        ),
      ),
    );
  }

  Widget _stopChip(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color, width: 2.2),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 5, offset: Offset(0, 2)),
        ],
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w900,
          color: color,
          height: 1.1,
        ),
      ),
    );
  }

  /// Azul bajito sólido (sin gradiente).
  static const Color _transferBlue = Color(0xFF6AA9D8);

  Widget _transferChip() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: _transferBlue,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF3D7EAE), width: 1.2),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 1)),
        ],
      ),
      child: const Text(
        'Transbordo',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w900,
          color: Colors.white,
          height: 1.1,
        ),
      ),
    );
  }

  List<LatLng> _slice(List<LatLng> coords, LatLng start, LatLng end) {
    if (coords.length < 2) return [start, end];
    var startIdx = 0, endIdx = coords.length - 1;
    var minS = double.infinity, minE = double.infinity;
    for (var i = 0; i < coords.length; i++) {
      final ds = _d2(coords[i], start);
      final de = _d2(coords[i], end);
      if (ds < minS) {
        minS = ds;
        startIdx = i;
      }
      if (de < minE) {
        minE = de;
        endIdx = i;
      }
    }
    if (startIdx > endIdx) {
      final tmp = startIdx;
      startIdx = endIdx;
      endIdx = tmp;
    }
    final sliced = coords.sublist(startIdx, endIdx + 1);
    if (sliced.isEmpty) return [start, end];
    sliced[0] = start;
    sliced[sliced.length - 1] = end;
    return sliced;
  }

  double _d2(LatLng a, LatLng b) {
    final dy = a.latitude - b.latitude;
    final dx = a.longitude - b.longitude;
    return dx * dx + dy * dy;
  }

  Future<void> _onStyleLoaded(StyleController style) async {
    if (_basemapEnhanced) return;
    _basemapEnhanced = true;
    await enhanceBasemapLikeWeb(style);

    // Add PMTiles source if port is available
    final port = ref.read(appControllerProvider).tileServerPort;
    if (port > 0) {
      try {
        await style.addSource(
          VectorSource(
            id: 'rutas-pmtiles-source',
            tiles: ['http://localhost:$port/tiles/{z}/{x}/{y}.pbf'],
            minZoom: 10,
            maxZoom: 18,
          ),
        );
      } catch (e) {
        debugPrint('Error adding vector source: $e');
      }
    }
    _updateNativeLayers();
  }

  @override
  Widget build(BuildContext context) {
    final lk = _computeLayersKey();
    if (lk != _layersKey) {
      _layersKey = lk;
      _cachedLayers = _buildLayers();
    }
    final markers = _buildMarkers(_arrowT);

    // RepaintBoundary: el mapa no invalida el chrome UI y viceversa.
    return RepaintBoundary(
      child: MapLibreMap(
        options: MapOptions(
          initStyle: _positronStyle,
          initCenter: Geographic(
            lon: GeoConstants.moreliaCenter.longitude,
            lat: GeoConstants.moreliaCenter.latitude,
          ),
          initZoom: GeoConstants.defaultZoom,
          minZoom: GeoConstants.minZoom,
          maxZoom: GeoConstants.maxZoom,
          androidTextureMode: true,
        ),
        onMapCreated: (c) {
          _controller = c;
          widget.onMapCreated?.call(c);
        },
        onStyleLoaded: (style) {
          unawaited(_onStyleLoaded(style));
        },
        onEvent: (event) {
          if (event is MapEventClick) {
            final g = event.point;
            widget.onTap?.call(LatLng(g.lat, g.lon));
          } else if (event is MapEventLongClick) {
            final g = event.point;
            widget.onLongPress?.call(LatLng(g.lat, g.lon));
          }
        },
        layers: _cachedLayers,
        children: [
          WidgetLayer(markers: markers, allowInteraction: false),
          const SourceAttribution(),
        ],
      ),
    );
  }
}
