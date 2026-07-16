import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
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

/// Mapa MapLibre + Positron GL + enhance web + etiquetas sin solaparse.
class ViaMapCanvas extends StatefulWidget {
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
  State<ViaMapCanvas> createState() => _ViaMapCanvasState();
}

class _ViaMapCanvasState extends State<ViaMapCanvas> with SingleTickerProviderStateMixin {
  MapController? _controller;
  late final AnimationController _arrowCtrl;
  bool _basemapEnhanced = false;

  static const _positronStyle =
      'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  @override
  void initState() {
    super.initState();
    _arrowCtrl = AnimationController(vsync: this, duration: ViaMotion.arrowLoop)..repeat();
  }

  @override
  void dispose() {
    _arrowCtrl.dispose();
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
  }

  Geographic _g(LatLng p) => Geographic(lon: p.longitude, lat: p.latitude);

  Feature<LineString> _lineFeature(List<LatLng> coords, {String? id}) {
    final flat = <double>[];
    for (final c in coords) {
      flat.add(c.longitude);
      flat.add(c.latitude);
    }
    return Feature(
      id: id,
      geometry: LineString(flat.positions(Coords.xy)),
    );
  }

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
          polylines: [_lineFeature(shape.coordinates, id: '${shape.id}-cas')],
          color: shape.casingColor ?? const Color(0xFF0F172A),
          width: isSense ? 6 : 8,
        ));
        layers.add(PolylineLayer(
          polylines: [_lineFeature(shape.coordinates, id: shape.id)],
          color: shape.color.withValues(alpha: isSense ? 0.55 : 1),
          width: isSense ? 3 : 5,
        ));
      }
    }

    return layers;
  }

  void _layersForPlan(TripPlanModel plan, List<Layer> layers) {
    final usedIds = plan.segments
        .where((s) => s.routeId != null)
        .map((s) => s.routeId!)
        .toSet();

    for (final id in usedIds) {
      for (final shape in widget.shapes.where((s) => s.routeId == id)) {
        if (shape.coordinates.length < 2) continue;
        layers.add(PolylineLayer(
          polylines: [_lineFeature(shape.coordinates, id: '${shape.id}-bg-cas')],
          color: const Color(0xFF1E293B).withValues(alpha: 0.2),
          width: 6,
        ));
        layers.add(PolylineLayer(
          polylines: [_lineFeature(shape.coordinates, id: '${shape.id}-bg')],
          color: shape.color.withValues(alpha: 0.28),
          width: 3,
        ));
      }
    }

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
          width: 10,
        ));
        layers.add(PolylineLayer(
          polylines: [_lineFeature(coords, id: 'seg-${segment.routeId}')],
          color: color,
          width: 6,
        ));
      } else if (segment.type == SegmentType.walk &&
          segment.walkFrom != null &&
          segment.walkTo != null) {
        final path = segment.walkPath ?? [segment.walkFrom!, segment.walkTo!];
        if (path.length < 2) continue;
        final color = switch (segment.walkKind) {
          WalkKind.toBoard => ViaColors.walkToBoard,
          WalkKind.fromAlight => ViaColors.walkFromAlight,
          WalkKind.transfer => ViaColors.walkTransfer,
          null => ViaColors.textSecondary,
        };
        layers.add(PolylineLayer(
          polylines: [_lineFeature(path, id: 'walk-cas-${segment.walkKind}')],
          color: Colors.white.withValues(alpha: 0.9),
          width: 5,
        ));
        layers.add(PolylineLayer(
          polylines: [_lineFeature(path, id: 'walk-${segment.walkKind}')],
          color: color,
          width: 3,
          dashArray: const [2, 2],
        ));
      }
    }
  }

  /// Etiquetas y orbes sin solaparse: offsets de alignment + fracciones distintas.
  List<Marker> _buildMarkers(double t) {
    final markers = <Marker>[];

    if (widget.userPosition != null) {
      markers.add(Marker(
        point: _g(widget.userPosition!),
        size: const Size(34, 34),
        child: const ViaUserDot(size: 30),
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
          count: 5,
          skipEnds: 0.12,
        );
      }
    }

    return markers;
  }

  void _markersForPlan(TripPlanModel plan, List<Marker> markers, double t) {
    LatLng? lastAlight;
    for (final segment in plan.segments) {
      if (segment.type == SegmentType.ride &&
          segment.boardingPoint != null &&
          segment.alightingPoint != null) {
        if (lastAlight != null) {
          final mid = LatLng(
            (lastAlight.latitude + segment.boardingPoint!.latitude) / 2,
            (lastAlight.longitude + segment.boardingPoint!.longitude) / 2,
          );
          markers.add(Marker(
            point: _g(mid),
            size: const Size(72, 30),
            alignment: Alignment.bottomCenter,
            child: _transferChip(),
          ));
        }
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
          // Flechas solo en el tramo central (evita chocar con Sube/Baja)
          _addArrows(markers, coords, color, t, count: 4, skipEnds: 0.18);
          // Ida/Vuelta a 45% del tramo, por encima de la línea
          final sensePt = _pointAtFraction(coords, 0.45);
          markers.add(Marker(
            point: _g(sensePt),
            size: const Size(48, 26),
            alignment: Alignment.bottomCenter,
            child: _senseChip(segment.direction == 'vuelta' ? 'Vuelta' : 'Ida'),
          ));
        }

        // Sube: encima del punto · Baja: debajo del punto
        markers.add(Marker(
          point: _g(segment.boardingPoint!),
          size: const Size(48, 28),
          alignment: Alignment.bottomCenter,
          child: _stopChip('Sube', ViaColors.amber),
        ));
        markers.add(Marker(
          point: _g(segment.alightingPoint!),
          size: const Size(48, 28),
          alignment: Alignment.topCenter,
          child: _stopChip('Baja', ViaColors.violet),
        ));
        lastAlight = segment.alightingPoint;
      } else if (segment.type == SegmentType.walk) {
        final path = segment.walkPath ??
            (segment.walkFrom != null && segment.walkTo != null
                ? [segment.walkFrom!, segment.walkTo!]
                : <LatLng>[]);
        if (path.length > 4) {
          final color = switch (segment.walkKind) {
            WalkKind.toBoard => ViaColors.walkToBoard,
            WalkKind.fromAlight => ViaColors.walkFromAlight,
            WalkKind.transfer => ViaColors.walkTransfer,
            null => ViaColors.textSecondary,
          };
          _addArrows(markers, path, color, t, count: 2, size: 11, skipEnds: 0.2);
        }
      }
    }
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

  void _addArrows(
    List<Marker> markers,
    List<LatLng> coords,
    Color color,
    double animationValue, {
    int count = 5,
    double size = 13,
    double skipEnds = 0.1,
  }) {
    if (coords.length < 4) return;
    final span = 1.0 - 2 * skipEnds;
    for (var k = 0; k < count; k++) {
      // Fracción animada solo en el tramo central
      final base = skipEnds + span * (k / count);
      final frac = skipEnds + ((base - skipEnds + animationValue * span) % span);
      final exact = frac * (coords.length - 2);
      final index = exact.floor().clamp(0, coords.length - 2);
      final rem = exact - index;
      final p1 = coords[index];
      final p2 = coords[index + 1];
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

  Widget _transferChip() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        gradient: const LinearGradient(colors: [ViaColors.mint, ViaColors.coral]),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 4)],
      ),
      child: const Text(
        'Transbordo',
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white),
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
    return AnimatedBuilder(
      animation: _arrowCtrl,
      builder: (context, _) {
        final layers = _buildLayers();
        final markers = _buildMarkers(_arrowCtrl.value);

        return MapLibreMap(
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
          layers: layers,
          children: [
            WidgetLayer(markers: markers, allowInteraction: false),
            const SourceAttribution(),
          ],
        );
      },
    );
  }
}
