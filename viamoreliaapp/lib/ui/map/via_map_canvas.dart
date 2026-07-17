import 'dart:async';
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
  bool _basemapEnhanced = false;

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

  static const _positronStyle =
      'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  /// Máx. puntos por polyline en pantalla (MapLibre se ahoga con miles de vértices).
  static const int _maxLinePoints = 160;

  @override
  void initState() {
    super.initState();
    _revealCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _revealCtrl.addListener(() {
      setState(() => _revealProgress = _revealCtrl.value);
    });
    _revealCtrl.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _pulseCtrl.forward(from: 0.0);
      }
    });

    _planRevealCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _planRevealCtrl.addListener(() {
      setState(() => _planRevealProgress = _planRevealCtrl.value);
    });

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

  Feature<LineString> _lineFeature(List<LatLng> coords,
      {String? id, double reveal = 1.0}) {
    final count =
        (coords.length * reveal.clamp(0.0, 1.0)).ceil().clamp(2, coords.length);
    final visible = coords.take(count).toList();
    final flat = <double>[];
    for (final c in visible) {
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



  void _updateNativeLayers() {}

  List<Layer> _buildLayers() {
    final layers = <Layer>[];

    if (widget.activePlan != null) {
      _layersForPlan(widget.activePlan!, layers);
    } else if (widget.shapes.isNotEmpty) {
      final display = DirectionModeService.toCorridorDisplay(
        widget.shapes,
        preferDirection: widget.routeDirectionFilter,
      );
      for (final shape in display) {
        if (shape.coordinates.length < 2) continue;
        final isSense = shape.role == 'sense-label';
        layers.add(PolylineLayer(
          polylines: [
            _lineFeature(shape.coordinates,
                id: '${shape.id}-cas', reveal: _revealProgress)
          ],
          color: shape.casingColor ?? const Color(0xFF0F172A),
          width: isSense ? 3 : 4,
        ));
        layers.add(PolylineLayer(
          polylines: [
            _lineFeature(shape.coordinates,
                id: shape.id, reveal: _revealProgress)
          ],
          color: shape.color.withValues(alpha: isSense ? 0.55 : 1),
          width: isSense ? 2 : 3,
        ));
      }

      // Pulse glow on top of route lines after reveal completes
      if (_pulseGlow > 0.01) {
        for (final shape in display) {
          if (shape.coordinates.length < 2) continue;
          layers.add(PolylineLayer(
            polylines: [
              _lineFeature(shape.coordinates,
                  id: 'pulse-${shape.id}', reveal: 1.0)
            ],
            color: const Color(0xFFF5B719).withValues(alpha: _pulseGlow),
            width: 8,
          ));
        }
      }
    }

    return layers;
  }

  void _layersForPlan(TripPlanModel plan, List<Layer> layers) {
    final usedIds = plan.segments
        .where((s) => s.routeId != null)
        .map((s) => s.routeId!)
        .toSet();

    // Corredor completo de fondo (muy tenue y delgado)
    for (final id in usedIds) {
      for (final shape in widget.shapes.where((s) => s.routeId == id)) {
        if (shape.coordinates.length < 2) continue;
        layers.add(PolylineLayer(
          polylines: [
            _lineFeature(shape.coordinates,
                id: '${shape.id}-bg-cas', reveal: _planRevealProgress)
          ],
          color: const Color(0xFF1E293B).withValues(alpha: 0.14),
          width: 3,
        ));
        layers.add(PolylineLayer(
          polylines: [
            _lineFeature(shape.coordinates,
                id: '${shape.id}-bg', reveal: _planRevealProgress)
          ],
          color: shape.color.withValues(alpha: 0.2),
          width: 2,
        ));
      }
    }

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
          polylines: [
            _lineFeature(coords,
                id: 'seg-cas-${segment.routeId}', reveal: _planRevealProgress)
          ],
          color: const Color(0xFF0F172A),
          width: 4,
        ));
        layers.add(PolylineLayer(
          polylines: [
            _lineFeature(coords,
                id: 'seg-${segment.routeId}', reveal: _planRevealProgress)
          ],
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
          polylines: [
            _lineFeature(path,
                id: 'walk-cas-${segment.walkKind}', reveal: 1.0)
          ],
          color: Colors.white.withValues(alpha: 0.85),
          width: 3,
        ));
        layers.add(PolylineLayer(
          polylines: [
            _lineFeature(path,
                id: 'walk-${segment.walkKind}', reveal: 1.0)
          ],
          color: color,
          width: 2,
          dashArray: const [2, 2],
        ));
      }
    }
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

      // Direction arrow during walk navigation
      if (widget.tracking) {
        final navState = ref.read(appControllerProvider);
        if (navState.walkNavSteps != null && navState.currentNavStep != null) {
          List<LatLng>? wp;
          if (widget.activePlan != null) {
            for (final seg in widget.activePlan!.segments) {
              if (seg.type == SegmentType.walk && seg.walkPath != null && seg.walkPath!.length >= 2) {
                if (navState.currentNavStep!.startIndex < seg.walkPath!.length) {
                  wp = seg.walkPath!;
                  break;
                }
              }
            }
          }
          if (wp != null && widget.userPosition != null) {
            final idx = navState.currentNavStep!.startIndex;
            final nextIdx = idx < wp.length - 1 ? idx + 1 : idx;
            final dy = wp[nextIdx].latitude - wp[idx].latitude;
            final dx = wp[nextIdx].longitude - wp[idx].longitude;
            if (dx != 0 || dy != 0) {
              final angle = math.atan2(dy, dx);
              markers.add(Marker(
                point: _g(widget.userPosition!),
                size: const Size(48, 48),
                alignment: Alignment.center,
                child: Transform.rotate(
                  angle: -angle + (math.pi / 2),
                  child: Icon(
                    navState.currentNavStep!.instruction.contains('derecha')
                        ? Icons.turn_right_rounded
                        : navState.currentNavStep!.instruction.contains('izquierda')
                            ? Icons.turn_left_rounded
                            : Icons.navigation_rounded,
                    size: 36,
                    color: ViaColors.walkToBoard.withValues(alpha: 0.85),
                    shadows: const [
                      Shadow(color: Colors.black45, blurRadius: 6),
                    ],
                  ),
                ),
              ));
            }
          }
        }
      }
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
        final label = shape.direction == 'vuelta' ? 'Vuelta' : 'Ida';
        // Ida al inicio, Vuelta al inicio (extremos opuestos de la ciudad)
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

        // Densidad de flechas dinámica según el nivel de zoom
        int arrowCount = 8;
        if (_lastZoom > 15.0) {
          arrowCount = 28;
        } else if (_lastZoom > 13.5) {
          arrowCount = 16;
        } else if (_lastZoom > 11.5) {
          arrowCount = 10;
        }

        _addArrows(
          markers,
          shape.coordinates,
          shape.color,
          count: arrowCount,
          size: 16,
          skipEnds: 0.08,
        );
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
        final color = segment.color ?? ViaColors.mint;

        if (coords.length >= 4) {
          // Densidad de flechas para plan según zoom
          int planArrowCount = 6;
          if (_lastZoom > 15.0) {
            planArrowCount = 20;
          } else if (_lastZoom > 13.5) {
            planArrowCount = 12;
          } else if (_lastZoom > 11.5) {
            planArrowCount = 8;
          }

          _addArrows(markers, coords, color, count: planArrowCount, size: 14, skipEnds: 0.12);
          final sensePt = _pointAtFraction(coords, 0.45);
          markers.add(Marker(
            point: _g(sensePt),
            size: const Size(68, 28),
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
          _addArrows(markers, path, color, count: 4, size: 12, skipEnds: 0.18);
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
    Color color, {
    int count = 4,
    double size = 13,
    double skipEnds = 0.1,
  }) {
    if (coords.length < 4) return;
    // IMPORTANTE: Usar coordenadas reales sin decimar para que las flechas
    // se ubiquen 100% sobre la línea dibujada y no floten fuera.
    final slim = coords;
    final span = 1.0 - 2 * skipEnds;
    for (var k = 0; k < count; k++) {
      final frac = skipEnds + span * (k / (count - 1).clamp(1, 25));
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

  Future<void> _onStyleLoaded(StyleController style) async {
    if (_basemapEnhanced) return;
    _basemapEnhanced = true;
    await enhanceBasemapLikeWeb(style);
  }

  @override
  Widget build(BuildContext context) {
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
