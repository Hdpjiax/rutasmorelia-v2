import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../models/route_model.dart';
import '../models/segment_model.dart';
import '../models/trip_plan_model.dart';
import 'routing_engine.dart';

/// Planificación en isolate (equivalente al Web Worker de la web).
class PlannerIsolate {
  static Future<List<TripPlanModel>> plan({
    required LatLng origin,
    required LatLng destination,
    required List<RouteShapeModel> shapes,
  }) async {
    final payload = <String, dynamic>{
      'origin': [origin.latitude, origin.longitude],
      'destination': [destination.latitude, destination.longitude],
      'shapes': shapes
          .map((s) => {
                'id': s.id,
                'routeId': s.routeId,
                'routeName': s.routeName,
                // ignore: deprecated_member_use
                'color': s.color.value,
                'direction': s.direction,
                'coords': s.coordinates.map((c) => [c.latitude, c.longitude]).toList(),
              })
          .toList(),
    };

    final raw = await compute(_planWorker, payload);
    return raw.map(_planFromMap).toList();
  }

  static List<Map<String, dynamic>> _planWorker(Map<String, dynamic> payload) {
    final o = payload['origin'] as List<dynamic>;
    final d = payload['destination'] as List<dynamic>;
    final origin = LatLng((o[0] as num).toDouble(), (o[1] as num).toDouble());
    final dest = LatLng((d[0] as num).toDouble(), (d[1] as num).toDouble());

    final shapes = <RouteShapeModel>[];
    for (final s in payload['shapes'] as List<dynamic>) {
      final m = s as Map<String, dynamic>;
      final coords = (m['coords'] as List<dynamic>)
          .map((c) => LatLng((c[0] as num).toDouble(), (c[1] as num).toDouble()))
          .toList();
      shapes.add(RouteShapeModel(
        id: m['id'] as String,
        routeId: m['routeId'] as String,
        routeName: m['routeName'] as String,
        color: Color(m['color'] as int),
        direction: m['direction'] as String,
        coordinates: coords,
      ));
    }

    final engine = RoutingEngine();
    final plans = engine.planTrip(
      origin: origin,
      destination: dest,
      shapes: shapes,
    );

    // Más directos visibles (el motor ya dedupea y ordena)
    final directs = plans.where((p) => p.type == TripPlanType.direct).take(12);
    final transfers = plans.where((p) => p.type == TripPlanType.transfer).take(8);
    return [...directs, ...transfers].map(_planToMap).toList();
  }

  static Map<String, dynamic> _planToMap(TripPlanModel p) {
    return {
      'type': p.type.name,
      'boarding': [p.boardingPoint.latitude, p.boardingPoint.longitude],
      'alighting': [p.alightingPoint.latitude, p.alightingPoint.longitude],
      'totalDistance': p.totalDistance,
      'totalDuration': p.totalDuration,
      'walkDistanceTotal': p.walkDistanceTotal,
      'segments': p.segments.map((s) {
        return {
          'type': s.type.name,
          'instruction': s.instruction,
          'distance': s.distance,
          'duration': s.duration,
          'routeId': s.routeId,
          'routeName': s.routeName,
          // ignore: deprecated_member_use
          'color': s.color?.value,
          'direction': s.direction,
          'boarding': s.boardingPoint == null
              ? null
              : [s.boardingPoint!.latitude, s.boardingPoint!.longitude],
          'alighting': s.alightingPoint == null
              ? null
              : [s.alightingPoint!.latitude, s.alightingPoint!.longitude],
          'walkFrom': s.walkFrom == null
              ? null
              : [s.walkFrom!.latitude, s.walkFrom!.longitude],
          'walkTo': s.walkTo == null ? null : [s.walkTo!.latitude, s.walkTo!.longitude],
          'walkKind': s.walkKind?.name,
        };
      }).toList(),
    };
  }

  static TripPlanModel _planFromMap(Map<String, dynamic> m) {
    LatLng? ll(dynamic v) {
      if (v == null) return null;
      final a = v as List<dynamic>;
      return LatLng((a[0] as num).toDouble(), (a[1] as num).toDouble());
    }

    final segs = (m['segments'] as List<dynamic>).map((raw) {
      final s = raw as Map<String, dynamic>;
      WalkKind? wk;
      final wkn = s['walkKind'] as String?;
      if (wkn == 'toBoard') wk = WalkKind.toBoard;
      if (wkn == 'fromAlight') wk = WalkKind.fromAlight;
      if (wkn == 'transfer') wk = WalkKind.transfer;

      return TravelSegmentModel(
        type: s['type'] == 'ride' ? SegmentType.ride : SegmentType.walk,
        instruction: s['instruction'] as String,
        distance: (s['distance'] as num).toDouble(),
        duration: (s['duration'] as num).toDouble(),
        routeId: s['routeId'] as String?,
        routeName: s['routeName'] as String?,
        color: s['color'] == null ? null : Color(s['color'] as int),
        direction: s['direction'] as String?,
        boardingPoint: ll(s['boarding']),
        alightingPoint: ll(s['alighting']),
        walkFrom: ll(s['walkFrom']),
        walkTo: ll(s['walkTo']),
        walkKind: wk,
      );
    }).toList();

    return TripPlanModel(
      type: m['type'] == 'transfer' ? TripPlanType.transfer : TripPlanType.direct,
      segments: segs,
      boardingPoint: ll(m['boarding'])!,
      alightingPoint: ll(m['alighting'])!,
      totalDistance: (m['totalDistance'] as num).toDouble(),
      totalDuration: (m['totalDuration'] as num).toDouble(),
      walkDistanceTotal: (m['walkDistanceTotal'] as num).toDouble(),
    );
  }
}
