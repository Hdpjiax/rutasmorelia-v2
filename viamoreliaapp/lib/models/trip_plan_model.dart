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
  final double? totalFare; // Estimated total cost in MXN

  TripPlanModel({
    required this.type,
    required this.segments,
    required this.boardingPoint,
    required this.alightingPoint,
    required this.totalDistance,
    required this.totalDuration,
    required this.walkDistanceTotal,
    this.totalFare,
  });

  // Derived properties
  int get totalDurationMinutes => (totalDuration / 60).round();
  int get walkDurationMinutes => (walkDistanceTotal / 1.2 / 60).round(); // Assuming 1.2 m/s walk speed

  String? get totalFareFormatted {
    if (totalFare == null) return null;
    return '\$${totalFare!.toStringAsFixed(0)}';
  }

  String get fareDetail {
    final fare = totalFare ?? 10.0;
    final rides = segments.where((s) => s.type == SegmentType.ride).length;
    if (rides <= 1) {
      return 'Costo: \$${fare.toStringAsFixed(2)} MXN sin transbordo';
    } else {
      final trans = rides - 1;
      final transText = trans == 1 ? '1 transbordo' : '$trans transbordos';
      return 'Costo total: \$${fare.toStringAsFixed(2)} MXN con $transText';
    }
  }
}
