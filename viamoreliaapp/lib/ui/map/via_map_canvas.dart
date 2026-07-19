import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
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

class _ViaMapCanvasState extends ConsumerState<ViaMapCanvas>
    with TickerProviderStateMixin {
  MapController? _controller;
  StyleController? _styleController;
  final List<String> _addedSourceIds = [];
  final List<String> _addedLayerIds = [];

  // Cache solo de polylines (baratas de invalidar).
  Object? _layersKey;
  List<Layer> _cachedLayers = const [];
  double _lastZoom = 13.0;

  // Route reveal animation
  late final AnimationController _revealCtrl;
  double _revealProgress = 1.0;

  // Plan reveal animation
  late final AnimationController _planRevealCtrl;
  double _planRevealProgress = 1.0;

  // Pulse glow after reveal
  late final AnimationController _pulseCtrl;
  double _pulseGlow = 0.0;





  @override
  void initState() {
    super.initState();
    _revealProgress = 1.0;
    _planRevealProgress = 1.0;

    _revealCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _revealCtrl.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _pulseCtrl.forward(from: 0.0);
      }
    });

    _planRevealCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _pulseCtrl.addListener(() {
      if (_pulseCtrl.value < 0.4) {
        _pulseGlow = _pulseCtrl.value / 0.4 * 0.35;
      } else {
        _pulseGlow = 0.35 * (1 - (_pulseCtrl.value - 0.4) / 0.6);
      }
      setState(() {});
    });
  }

  @override
  void dispose() {
    _revealCtrl.dispose();
    _planRevealCtrl.dispose();
    _pulseCtrl.dispose();
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

    // Route reveal: animate when a route is first selected or changes
    if (oldWidget.selectedRoute?.id != widget.selectedRoute?.id &&
        widget.selectedRoute != null) {
      _revealProgress = 0.0;
      _revealCtrl
        ..value = 0.0
        ..forward();
    }

    // Plan reveal: animate when a new plan is selected
    if (oldWidget.activePlan != widget.activePlan &&
        widget.activePlan != null) {
      _planRevealProgress = 0.0;
      _planRevealCtrl
        ..value = 0.0
        ..forward();
    }
  }

  Geographic _g(LatLng p) => Geographic(lon: p.longitude, lat: p.latitude);

  /// Reduce vértices manteniendo extremos (mucho más barato al pintar).




  Object? _planKey(TripPlanModel? p) {
    if (p == null) return null;
    var walkPointsCount = 0;
    for (final s in p.segments) {
      if (s.type == SegmentType.walk && s.walkPath != null) {
        walkPointsCount += s.walkPath!.length;
      }
    }
    return (
      p.type,
      p.segments.length,
      p.totalDuration.round(),
      p.boardingPoint.latitude.toStringAsFixed(5),
      p.alightingPoint.longitude.toStringAsFixed(5),
      walkPointsCount,
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
        (_revealProgress * 50).round(),
        (_planRevealProgress * 50).round(),
        (_pulseGlow * 10).round(),
      );



  void _updateNativeLayers() {
    unawaited(_updateNativeLayersAsync());
  }

  Future<void> _clearNativeLayers() async {
    final style = _styleController;
    if (style == null) return;

    if (_addedLayerIds.isNotEmpty) {
      final layers = List<String>.from(_addedLayerIds.reversed);
      _addedLayerIds.clear();
      try {
        await Future.wait(layers.map((id) => style.removeLayer(id).catchError((_) {})));
      } catch (_) {}
    }

    if (_addedSourceIds.isNotEmpty) {
      final sources = List<String>.from(_addedSourceIds);
      _addedSourceIds.clear();
      try {
        await Future.wait(sources.map((id) => style.removeSource(id).catchError((_) {})));
      } catch (_) {}
    }
  }

  Future<void> _updateNativeLayersAsync() async {
    final style = _styleController;
    if (style == null) return;

    await _clearNativeLayers();

    final lines = <_MapRouteLine>[];

    if (widget.activePlan != null) {
      final plan = widget.activePlan!;
      final usedIds = plan.segments
          .where((s) => s.routeId != null)
          .map((s) => s.routeId!)
          .toSet();

      // Corredor completo de fondo (visible y claro)
      for (final id in usedIds) {
        for (final shape in widget.shapes.where((s) => s.routeId == id)) {
          if (shape.coordinates.length < 2) continue;
          lines.add(_MapRouteLine(
            id: 'bg-${shape.id}',
            coordinates: shape.coordinates,
            color: shape.color.withValues(alpha: 0.32),
            casingColor: const Color(0xFF0F172A).withValues(alpha: 0.15),
            width: 3.5,
            direction: shape.direction,
          ));
        }
      }

      // Tramo activo del plan
      for (var i = 0; i < plan.segments.length; i++) {
        final segment = plan.segments[i];
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
          lines.add(_MapRouteLine(
            id: 'seg-${segment.routeId}-$i',
            coordinates: coords,
            color: segment.color ?? ViaColors.mint,
            casingColor: const Color(0xFF0F172A),
            width: 4.5,
            direction: segment.direction,
          ));
        } else if (segment.type == SegmentType.walk &&
            segment.walkFrom != null &&
            segment.walkTo != null) {
          final path = segment.walkPath ?? [segment.walkFrom!, segment.walkTo!];
          if (path.length < 2) continue;
          final color = switch (segment.walkKind) {
            WalkKind.toBoard => ViaColors.walkToBoard,
            WalkKind.fromAlight => ViaColors.walkFromAlight,
            WalkKind.transfer => const Color(0xFF6AA9D8),
            null => ViaColors.textSecondary,
          };
          lines.add(_MapRouteLine(
            id: 'walk-${segment.walkKind}-$i',
            coordinates: path,
            color: color,
            casingColor: Colors.white.withValues(alpha: 0.8),
            width: 2.5,
            isWalk: true,
          ));
        }
      }
    } else if (widget.shapes.isNotEmpty) {
      final display = DirectionModeService.toCorridorDisplay(
        widget.shapes,
        preferDirection: widget.routeDirectionFilter,
      );
      for (final shape in display) {
        if (shape.coordinates.length < 2) continue;
        final isSense = shape.role == 'sense-label';
        lines.add(_MapRouteLine(
          id: shape.id,
          coordinates: shape.coordinates,
          color: shape.color.withValues(alpha: isSense ? 0.55 : 1),
          casingColor: shape.casingColor ?? const Color(0xFF0F172A),
          width: isSense ? 2.5 : 3.5,
          direction: shape.direction,
        ));
      }
    }

    for (final line in lines) {
      final sourceId = 'src-${line.id}';
      final casingLayerId = 'lay-cas-${line.id}';
      final lineLayerId = 'lay-line-${line.id}';

      final geojson = jsonEncode({
        "type": "Feature",
        "geometry": {
          "type": "LineString",
          "coordinates": line.coordinates.map((c) => [c.longitude, c.latitude]).toList()
        },
        "properties": {}
      });

      try {
        await style.addSource(GeoJsonSource(id: sourceId, data: geojson, maxZoom: 18));
        _addedSourceIds.add(sourceId);

        // 1. Casing
        await style.addLayer(LineStyleLayer(
          id: casingLayerId,
          sourceId: sourceId,
          paint: {
            'line-color': '#${line.casingColor.value.toRadixString(16).substring(2)}',
            'line-width': line.width + 1.5,
            'line-opacity': line.casingColor.opacity,
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
        ));
        _addedLayerIds.add(casingLayerId);

        // 2. Linea Principal
        final linePaint = <String, Object>{
          'line-color': '#${line.color.value.toRadixString(16).substring(2)}',
          'line-width': line.width,
          'line-opacity': line.color.opacity,
        };
        final lineLayout = <String, Object>{
          'line-cap': 'round',
          'line-join': 'round',
        };
        if (line.isWalk) {
          linePaint['line-dasharray'] = [2, 2];
        }
        await style.addLayer(LineStyleLayer(
          id: lineLayerId,
          sourceId: sourceId,
          paint: linePaint,
          layout: lineLayout,
        ));
        _addedLayerIds.add(lineLayerId);

        // 3. Texto nativo "Esta es tu ruta" incrustado en el trazo del viaje destacado
        if (line.id.startsWith('seg-')) {
          final textLayerId = 'lay-txt-${line.id}';
          await style.addLayer(SymbolStyleLayer(
            id: textLayerId,
            sourceId: sourceId,
            minZoom: 12.0,
            layout: {
              'symbol-placement': 'line',
              'symbol-spacing': 280.0,
              'text-field': 'Esta es tu ruta',
              'text-size': 10.5,
              'text-keep-upright': true,
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': '#FFFFFF',
              'text-halo-color': '#005B57', // Petróleo de marca
              'text-halo-width': 1.8,
            },
          ));
          _addedLayerIds.add(textLayerId);
        }
      } catch (_) {}
    }
  }

  List<Layer> _buildLayers() {
    return const [];
  }

  /// Etiquetas, orbes y flechas con animación suave (throttle en setState).
  List<Marker> _buildMarkers() {
    final markers = <Marker>[];

    if (widget.userPosition != null) {
      markers.add(Marker(
        point: _g(widget.userPosition!),
        size: const Size(32, 32),
        child: ViaUserDot(size: 28, pulse: widget.tracking),
      ));
    }
    if (widget.tracking && widget.projectedOnRoute != null) {
      // Pulse ring behind bus marker
      markers.add(Marker(
        point: _g(widget.projectedOnRoute!),
        size: const Size(48, 48),
        child: Container(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: ViaColors.primary.withValues(alpha: 0.08),
          ),
        ).animate(onPlay: (c) => c.repeat(reverse: true))
          .scale(
            begin: const Offset(0.8, 0.8),
            end: const Offset(1.3, 1.3),
            duration: 1200.ms,
            curve: Curves.easeInOut,
          ),
      ));

      // Bus marker with smooth entrance animation
      markers.add(Marker(
        point: _g(widget.projectedOnRoute!),
        size: const Size(36, 36),
        alignment: Alignment.center,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0.0, end: 1.0),
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeOutCubic,
          builder: (context, value, child) {
            return Transform.scale(
              scale: 0.8 + 0.2 * value,
              child: child,
            );
          },
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: ViaColors.primary,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2.5),
              boxShadow: [
                BoxShadow(color: ViaColors.primary.withValues(alpha: 0.45), blurRadius: 8),
              ],
            ),
            child: const Center(
              child: Icon(Icons.directions_bus_rounded, size: 16, color: Colors.white),
            ),
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
      _markersForPlan(widget.activePlan!, markers);
    } else {
      final display = DirectionModeService.toCorridorDisplay(
        widget.shapes,
        preferDirection: widget.routeDirectionFilter,
      );
      for (final shape in display) {
        if (shape.coordinates.length < 10) continue;
        // Inyectar flechas a lo largo de las rutas en el catálogo
        markers.addAll(_generateArrowsForPath(shape.coordinates, shape.color));

        final label = shape.direction == 'vuelta' ? 'Vuelta' : 'Ida';
        final frac = 0.08;
        final pt = _pointAtFraction(shape.coordinates, frac);
        markers.add(Marker(
          point: _g(pt),
          size: const Size(68, 28),
          alignment: shape.direction == 'vuelta'
              ? Alignment.topCenter
              : Alignment.bottomCenter,
          child: _senseChip(label),
        ));
      }
    }

    return markers;
  }

  void _markersForPlan(TripPlanModel plan, List<Marker> markers) {
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

        if (coords.length >= 4) {
          // Inyectar flechas a lo largo del tramo del plan seleccionado
          final color = segment.color ?? ViaColors.primary;
          markers.addAll(_generateArrowsForPath(coords, color));
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
          // Las flechas de caminata ya no se dibujan por marcador
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


  Widget _senseChip(String label) {
    final isVuelta = label.toLowerCase().contains('vuelta');
    final activeColor = isVuelta ? ViaColors.walkFromAlight : ViaColors.walkToBoard;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: activeColor, width: 1.5),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 1)),
        ],
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w900,
          color: activeColor,
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

  List<Marker> _generateArrowsForPath(List<LatLng> coords, Color color) {
    if (coords.length < 5) return const [];
    final arrows = <Marker>[];
    
    final indexes = [
      (coords.length * 0.25).toInt(),
      (coords.length * 0.50).toInt(),
      (coords.length * 0.75).toInt(),
    ];

    for (final idx in indexes) {
      if (idx >= 0 && idx < coords.length - 1) {
        final current = coords[idx];
        final next = coords[idx + 1];
        final dy = next.latitude - current.latitude;
        final dx = next.longitude - current.longitude;
        if (dx != 0 || dy != 0) {
          final angle = math.atan2(dy, dx);
          arrows.add(Marker(
            point: _g(current),
            size: const Size(20, 20),
            alignment: Alignment.center,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.15),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(2),
              child: Transform.rotate(
                angle: -angle + (math.pi / 2),
                child: Icon(
                  Icons.navigation_rounded,
                  color: color,
                  size: 13,
                ),
              ),
            ),
          ));
        }
      }
    }
    return arrows;
  }



  Future<void> _onStyleLoaded(StyleController style) async {
    _styleController = style;
    await enhanceBasemapLikeWeb(style);
    _updateNativeLayers();
  }

  @override
  Widget build(BuildContext context) {
    final mapStyleUri = ref.watch(appControllerProvider.select((s) => s.mapStyleUri));
    
    ref.listen(appControllerProvider.select((s) => s.mapStyleUri), (previous, next) {
      if (next != previous && _controller != null) {
        _controller!.setStyle(next);
      }
    });

    final lk = _computeLayersKey();
    if (lk != _layersKey) {
      _layersKey = lk;
      _cachedLayers = _buildLayers();
    }
    final markers = _buildMarkers();

    // RepaintBoundary: el mapa no invalida el chrome UI y viceversa.
    return RepaintBoundary(
      child: MapLibreMap(
        options: MapOptions(
          initStyle: mapStyleUri,
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
          } else {
            // Escuchar cambios de zoom del mapa para re-calcular densidad de flechas
            final z = _controller?.camera?.zoom;
            if (z != null && (z - _lastZoom).abs() > 0.22) {
              setState(() {
                _lastZoom = z;
              });
            }
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

class _MapRouteLine {
  final String id;
  final List<LatLng> coordinates;
  final Color color;
  final Color casingColor;
  final double width;
  final bool isWalk;
  final String? direction;

  _MapRouteLine({
    required this.id,
    required this.coordinates,
    required this.color,
    required this.casingColor,
    required this.width,
    this.isWalk = false,
    this.direction,
  });
}
