import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:viamoreliaapp/services/routing_engine.dart';
import 'package:viamoreliaapp/models/route_model.dart';
import 'package:viamoreliaapp/models/trip_plan_model.dart';

void main() {
  group('RoutingEngine Tests', () {
    late RoutingEngine engine;

    setUp(() {
      engine = RoutingEngine();
    });

    test('Haversine distance calculation is accurate', () {
      final p1 = LatLng(19.7026, -101.1944); // Catedral
      final p2 = LatLng(19.7012, -101.1805); // Acueducto
      final dist = engine.getHaversineDistance(p1, p2);
      
      // Real distance is ~1460 meters. Let's verify it falls in 1400-1500 range.
      expect(dist, greaterThan(1400));
      expect(dist, lessThan(1500));
    });

    test('Project point onto simple LineString segment', () {
      final line = [
        LatLng(10.0, 10.0),
        LatLng(10.0, 20.0),
      ];
      final target = LatLng(11.0, 15.0); // Directly north of center

      final result = engine.projectPointOntoLineString(line, target);
      expect(result.closest.latitude, closeTo(10.0, 0.001));
      expect(result.closest.longitude, closeTo(15.0, 0.001));
      expect(result.fraction, closeTo(0.5, 0.01));
    });

    test('Plan trip returns direct connection option', () {
      final origin = LatLng(19.700, -101.195);
      final destination = LatLng(19.705, -101.190);
      
      // Simple direct route matching the trajectory
      final shape = RouteShapeModel(
        id: 'test-route-1-ida',
        routeId: 'test-route-1',
        routeName: 'Test Route 1',
        color: const Color(0xFFFFD000),
        direction: 'ida',
        coordinates: [
          LatLng(19.699, -101.196),
          LatLng(19.701, -101.194),
          LatLng(19.703, -101.192),
          LatLng(19.706, -101.189),
        ],
      );

      final plans = engine.planTrip(
        origin: origin,
        destination: destination,
        shapes: [shape],
        maxWalkDistanceMeters: 600,
      );

      expect(plans.length, equals(1));
      expect(plans.first.type, equals(TripPlanType.direct));
      expect(plans.first.segments.length, equals(3));
    });
  });
}
