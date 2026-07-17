import 'dart:math' as math;
import 'package:latlong2/latlong.dart';

class WalkNavStep {
  final String instruction;
  final String? streetName;
  final double distance;
  final double turnAngle;
  final int startIndex;

  WalkNavStep({
    required this.instruction,
    this.streetName,
    required this.distance,
    required this.turnAngle,
    required this.startIndex,
  });
}

List<WalkNavStep> computeWalkNavSteps(List<LatLng> path) {
  if (path.length < 2) return [];

  final steps = <WalkNavStep>[];
  var stepStart = 0;

  for (var i = 2; i < path.length; i++) {
    final prevBearing = _bearing(path[i - 2], path[i - 1]);
    final currBearing = _bearing(path[i - 1], path[i]);
    final angleDiff = _angleDifference(currBearing, prevBearing);

    if (angleDiff.abs() > 25.0) {
      final stepDist = _pathDistance(path, stepStart, i - 1);
      steps.add(WalkNavStep(
        instruction: _turnInstruction(angleDiff),
        distance: stepDist,
        turnAngle: angleDiff,
        startIndex: stepStart,
      ));
      stepStart = i - 1;
    }
  }

  if (stepStart < path.length - 1) {
    final stepDist = _pathDistance(path, stepStart, path.length - 1);
    steps.add(WalkNavStep(
      instruction: stepDist > 20 ? 'Continúa recto' : 'Has llegado',
      distance: stepDist,
      turnAngle: 0,
      startIndex: stepStart,
    ));
  }

  return steps;
}

double _bearing(LatLng from, LatLng to) {
  final dLon = (to.longitude - from.longitude) * (math.pi / 180);
  final lat1 = from.latitude * (math.pi / 180);
  final lat2 = to.latitude * (math.pi / 180);
  final y = math.sin(dLon) * math.cos(lat2);
  final x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dLon);
  return (math.atan2(y, x) * 180 / math.pi + 360) % 360;
}

double _angleDifference(double a, double b) {
  var diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  return diff;
}

double _pathDistance(List<LatLng> path, int from, int to) {
  var dist = 0.0;
  for (var i = from; i < to && i < path.length - 1; i++) {
    dist += _haversine(path[i], path[i + 1]);
  }
  return dist;
}

double _haversine(LatLng a, LatLng b) {
  const r = 6371000;
  final dLat = (b.latitude - a.latitude) * (math.pi / 180);
  final dLon = (b.longitude - a.longitude) * (math.pi / 180);
  final lat1 = a.latitude * (math.pi / 180);
  final lat2 = b.latitude * (math.pi / 180);
  final aa = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.sin(dLon / 2) * math.sin(dLon / 2) * math.cos(lat1) * math.cos(lat2);
  return r * 2 * math.atan2(math.sqrt(aa), math.sqrt(1 - aa));
}

String _turnInstruction(double angle) {
  if (angle.abs() < 25) return 'Continúa recto';
  if (angle > 0) return 'Gira a la derecha';
  return 'Gira a la izquierda';
}
