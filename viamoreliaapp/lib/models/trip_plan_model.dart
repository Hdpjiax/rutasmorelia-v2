import 'package:latlong2/latlong.dart';
import 'segment_model.dart';

enum TripPlanType { direct, transfer }

class TripPlanModel {
  final TripPlanType type;
  final List<TravelSegmentModel> segments;
  final LatLng boardingPoint;
  final LatLng alightingPoint;
  final double totalDistance; // meters
  final double totalDuration; // seconds
  final double walkDistanceTotal; // meters

  TripPlanModel({
    required this.type,
    required this.segments,
    required this.boardingPoint,
    required this.alightingPoint,
    required this.totalDistance,
    required this.totalDuration,
    required this.walkDistanceTotal,
  });

  // Derived properties
  int get totalDurationMinutes => (totalDuration / 60).round();
  int get walkDurationMinutes => (walkDistanceTotal / 1.2 / 60).round(); // Assuming 1.2 m/s walk speed
}
