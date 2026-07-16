import 'dart:math';
import 'package:latlong2/latlong.dart';
import '../models/route_model.dart';
import '../models/segment_model.dart';
import '../models/trip_plan_model.dart';

class ProjectionResult {
  final LatLng closest;
  final double distance;
  final double fraction;

  ProjectionResult({
    required this.closest,
    required this.distance,
    required this.fraction,
  });
}

class AccessPoint {
  final LatLng point;
  final double walkM;
  final double fraction;
  final int sampleIndex;

  AccessPoint({
    required this.point,
    required this.walkM,
    required this.fraction,
    required this.sampleIndex,
  });
}

class BoardAlightPair {
  final AccessPoint board;
  final AccessPoint alight;
  final double walkTotal;
  final double rideM;

  BoardAlightPair({
    required this.board,
    required this.alight,
    required this.walkTotal,
    required this.rideM,
  });
}

class TransferPointResult {
  final LatLng point;
  final int idx1;
  final int idx2;
  final double frac1;
  final double frac2;
  final double transferWalkDist;

  TransferPointResult({
    required this.point,
    required this.idx1,
    required this.idx2,
    required this.frac1,
    required this.frac2,
    required this.transferWalkDist,
  });
}

class RoutingEngine {
  // Constants
  static const double walkSpeed = 1.2; // m/s
  static const double transitSpeed = 6.1; // m/s

  double getHaversineDistance(LatLng p1, LatLng p2) {
    const double r = 6371000; // Earth radius in meters
    final dLat = (p2.latitude - p1.latitude) * pi / 180;
    final dLng = (p2.longitude - p1.longitude) * pi / 180;
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(p1.latitude * pi / 180) *
            cos(p2.latitude * pi / 180) *
            sin(dLng / 2) *
            sin(dLng / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return r * c;
  }

  double getShapeLength(List<LatLng> coords) {
    double length = 0;
    for (var i = 0; i < coords.length - 1; i++) {
      length += getHaversineDistance(coords[i], coords[i + 1]);
    }
    return length;
  }

  ProjectionResult projectPointOntoLineString(List<LatLng> line, LatLng point) {
    if (line.isEmpty) {
      throw ArgumentError("LineString must have at least one point");
    }
    if (line.length == 1) {
      return ProjectionResult(
        closest: line[0],
        distance: getHaversineDistance(point, line[0]),
        fraction: 0,
      );
    }

    double minDistance = double.infinity;
    LatLng closestPoint = line[0];
    double totalLength = 0;
    final lengths = <double>[];

    for (var i = 0; i < line.length - 1; i++) {
      final d = getHaversineDistance(line[i], line[i + 1]);
      lengths.add(d);
      totalLength += d;
    }

    double fraction = 0;
    double currentLength = 0;

    for (var i = 0; i < line.length - 1; i++) {
      final p1 = line[i];
      final p2 = line[i + 1];
      final segmentLength = lengths[i];

      final x = point.longitude;
      final y = point.latitude;
      final x1 = p1.longitude;
      final y1 = p1.latitude;
      final x2 = p2.longitude;
      final y2 = p2.latitude;

      final dx = x2 - x1;
      final dy = y2 - y1;
      final lenSq = dx * dx + dy * dy;

      double t = 0;
      if (lenSq > 0) {
        t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
        t = t.clamp(0.0, 1.0);
      }

      final projX = x1 + t * dx;
      final projY = y1 + t * dy;
      final proj = LatLng(projY, projX);

      final dist = getHaversineDistance(point, proj);
      if (dist < minDistance) {
        minDistance = dist;
        closestPoint = proj;
        final segmentDist = segmentLength * t;
        fraction = totalLength > 0 ? (currentLength + segmentDist) / totalLength : 0;
      }
      currentLength += segmentLength;
    }

    return ProjectionResult(
      closest: closestPoint,
      distance: minDistance,
      fraction: fraction.clamp(0.0, 1.0),
    );
  }

  BoardAlightPair? findShortestWalkBoardAlight(
    List<LatLng> coords,
    LatLng origin,
    LatLng destination,
    double maxWalkM,
  ) {
    if (coords.length < 2) return null;
    final totalLen = getShapeLength(coords);
    if (totalLen <= 0) return null;

    ProjectionResult boardNear;
    ProjectionResult alightNear;
    try {
      boardNear = projectPointOntoLineString(coords, origin);
      alightNear = projectPointOntoLineString(coords, destination);
    } catch (_) {
      return null;
    }

    // Ideal case: correct direction fraction progression
    if (boardNear.distance <= maxWalkM &&
        alightNear.distance <= maxWalkM &&
        alightNear.fraction > boardNear.fraction + 0.001) {
      final rideM = (alightNear.fraction - boardNear.fraction) * totalLen;
      if (rideM >= 80) {
        return BoardAlightPair(
          board: AccessPoint(
            point: boardNear.closest,
            walkM: boardNear.distance,
            fraction: boardNear.fraction,
            sampleIndex: -1,
          ),
          alight: AccessPoint(
            point: alightNear.closest,
            walkM: alightNear.distance,
            fraction: alightNear.fraction,
            sampleIndex: -1,
          ),
          walkTotal: boardNear.distance + alightNear.distance,
          rideM: rideM,
        );
      }
    }

    // Direction adjustments if fraction is reversed or overlapping
    final options = <BoardAlightPair>[];

    if (boardNear.distance <= maxWalkM) {
      final alightFixed = nearestAccessInFractionRange(
        coords,
        destination,
        boardNear.fraction + 0.002,
        1.0,
        maxWalkM,
      );
      if (alightFixed != null) {
        final rideM = (alightFixed.fraction - boardNear.fraction) * totalLen;
        if (rideM >= 80) {
          options.add(BoardAlightPair(
            board: AccessPoint(
              point: boardNear.closest,
              walkM: boardNear.distance,
              fraction: boardNear.fraction,
              sampleIndex: -1,
            ),
            alight: alightFixed,
            walkTotal: boardNear.distance + alightFixed.walkM,
            rideM: rideM,
          ));
        }
      }
    }

    if (alightNear.distance <= maxWalkM) {
      final boardFixed = nearestAccessInFractionRange(
        coords,
        origin,
        0.0,
        alightNear.fraction - 0.002,
        maxWalkM,
      );
      if (boardFixed != null) {
        final rideM = (alightNear.fraction - boardFixed.fraction) * totalLen;
        if (rideM >= 80) {
          options.add(BoardAlightPair(
            board: boardFixed,
            alight: AccessPoint(
              point: alightNear.closest,
              walkM: alightNear.distance,
              fraction: alightNear.fraction,
              sampleIndex: -1,
            ),
            walkTotal: boardFixed.walkM + alightNear.distance,
            rideM: rideM,
          ));
        }
      }
    }

    // Fallback: search ranges
    if (options.isEmpty) {
      final boardAny = nearestAccessInFractionRange(coords, origin, 0.0, 0.98, maxWalkM);
      if (boardAny != null) {
        final alightAny = nearestAccessInFractionRange(
          coords,
          destination,
          boardAny.fraction + 0.002,
          1.0,
          maxWalkM,
        );
        if (alightAny != null) {
          final rideM = (alightAny.fraction - boardAny.fraction) * totalLen;
          if (rideM >= 80) {
            options.add(BoardAlightPair(
              board: boardAny,
              alight: alightAny,
              walkTotal: boardAny.walkM + alightAny.walkM,
              rideM: rideM,
            ));
          }
        }
      }
    }

    if (options.isEmpty) return null;

    options.sort((a, b) {
      if ((a.walkTotal - b.walkTotal).abs() > 1.0) {
        return a.walkTotal.compareTo(b.walkTotal);
      }
      return a.rideM.compareTo(b.rideM);
    });

    return options.first;
  }

  AccessPoint? nearestAccessInFractionRange(
    List<LatLng> coords,
    LatLng anchor,
    double minFrac,
    double maxFrac,
    double maxWalkM,
  ) {
    if (coords.length < 2 || maxFrac <= minFrac) return null;

    final totalLen = getShapeLength(coords);
    if (totalLen <= 0) return null;

    AccessPoint? best;
    double distAcc = 0;

    for (var i = 0; i < coords.length - 1; i++) {
      final p1 = coords[i];
      final p2 = coords[i + 1];
      final segLen = getHaversineDistance(p1, p2);
      final fracStart = distAcc / totalLen;
      final fracEnd = (distAcc + segLen) / totalLen;

      if (fracEnd < minFrac || fracStart > maxFrac) {
        distAcc += segLen;
        continue;
      }

      final dx = p2.longitude - p1.longitude;
      final dy = p2.latitude - p1.latitude;
      final lenSq = dx * dx + dy * dy;
      double t = 0;
      if (lenSq > 0) {
        t = ((anchor.longitude - p1.longitude) * dx +
                (anchor.latitude - p1.latitude) * dy) /
            lenSq;
        t = t.clamp(0.0, 1.0);
      }

      if (segLen > 0) {
        final diff = fracEnd - fracStart;
        final divisor = diff == 0 ? 1e-12 : diff;
        final tMin = (minFrac - fracStart) / divisor;
        final tMax = (maxFrac - fracStart) / divisor;
        final clampedTMin = tMin.clamp(0.0, 1.0);
        final clampedTMax = tMax.clamp(0.0, 1.0);
        if (clampedTMin <= clampedTMax) {
          t = t.clamp(clampedTMin, clampedTMax);
        } else {
          distAcc += segLen;
          continue;
        }
      }

      final projLng = p1.longitude + t * dx;
      final projLat = p1.latitude + t * dy;
      final proj = LatLng(projLat, projLng);
      final walkM = getHaversineDistance(anchor, proj);

      if (walkM > maxWalkM) {
        distAcc += segLen;
        continue;
      }

      final fraction = (fracStart + t * (fracEnd - fracStart)).clamp(0.0, 1.0);
      if (best == null || walkM < best.walkM) {
        best = AccessPoint(
          point: proj,
          walkM: walkM,
          fraction: fraction,
          sampleIndex: i,
        );
      }

      distAcc += segLen;
    }

    return best;
  }

  List<AccessPoint> collectAccessPoints(
    List<LatLng> coords,
    LatLng anchor,
    double maxWalkM,
  ) {
    final out = <AccessPoint>[];
    try {
      final proj = projectPointOntoLineString(coords, anchor);
      if (proj.distance <= maxWalkM) {
        out.add(AccessPoint(
          point: proj.closest,
          walkM: proj.distance,
          fraction: proj.fraction,
          sampleIndex: -1,
        ));
      }
    } catch (_) {}

    final samples = samplePolyline(coords, 40);
    for (final s in samples) {
      final walkM = getHaversineDistance(anchor, s.point);
      if (walkM <= maxWalkM) {
        out.add(AccessPoint(
          point: s.point,
          walkM: walkM,
          fraction: s.fraction,
          sampleIndex: s.index,
        ));
      }
    }

    out.sort((a, b) => a.walkM.compareTo(b.walkM));
    final filtered = <AccessPoint>[];
    for (final p in out) {
      if (filtered.any((f) => (f.fraction - p.fraction).abs() < 0.01)) continue;
      filtered.add(p);
      if (filtered.length >= 12) break;
    }
    return filtered;
  }

  List<_Sample> samplePolyline(List<LatLng> coords, int maxSamples) {
    final total = getShapeLength(coords);
    if (total <= 0 || coords.isEmpty) return [];

    final step = max(1, (coords.length / maxSamples).floor());
    final out = <_Sample>[];
    double distAcc = 0;

    final fracs = List<double>.filled(coords.length, 0.0);
    for (var i = 1; i < coords.length; i++) {
      distAcc += getHaversineDistance(coords[i - 1], coords[i]);
      fracs[i] = total > 0 ? distAcc / total : 0;
    }

    for (var i = 0; i < coords.length; i += step) {
      out.add(_Sample(point: coords[i], fraction: fracs[i], index: i));
    }

    final last = coords.length - 1;
    if (out.isEmpty || out.last.index != last) {
      out.add(_Sample(point: coords[last], fraction: 1.0, index: last));
    }
    return out;
  }

  TransferPointResult? findTransferPoint(
    List<LatLng> line1,
    List<LatLng> line2,
  ) {
    final step1 = max(1, (line1.length / 80).floor());
    final step2 = max(1, (line2.length / 80).floor());
    double minDistance = double.infinity;
    var bestIdx1 = -1;
    var bestIdx2 = -1;

    for (var i = 0; i < line1.length; i += step1) {
      for (var j = 0; j < line2.length; j += step2) {
        final dist = getHaversineDistance(line1[i], line2[j]);
        if (dist < minDistance) {
          minDistance = dist;
          bestIdx1 = i;
          bestIdx2 = j;
        }
      }
    }

    if (minDistance > 120 || bestIdx1 < 0) return null;

    final len1 = getShapeLength(line1);
    final len2 = getShapeLength(line2);
    double len1Before = 0;
    for (var i = 0; i < bestIdx1; i++) {
      len1Before += getHaversineDistance(line1[i], line1[i + 1]);
    }
    double len2Before = 0;
    for (var j = 0; j < bestIdx2; j++) {
      len2Before += getHaversineDistance(line2[j], line2[j + 1]);
    }

    return TransferPointResult(
      point: line1[bestIdx1],
      idx1: bestIdx1,
      idx2: bestIdx2,
      frac1: len1 > 0 ? len1Before / len1 : 0,
      frac2: len2 > 0 ? len2Before / len2 : 0,
      transferWalkDist: minDistance,
    );
  }

  AccessPoint? pickBestAccessBefore(List<AccessPoint> candidates, double transferFrac) {
    final valid = candidates.where((c) => c.fraction < transferFrac - 0.01).toList();
    if (valid.isEmpty) return null;
    return valid.reduce((a, b) => a.walkM <= b.walkM ? a : b);
  }

  AccessPoint? pickBestAccessAfter(List<AccessPoint> candidates, double transferFrac) {
    final valid = candidates.where((c) => c.fraction > transferFrac + 0.01).toList();
    if (valid.isEmpty) return null;
    return valid.reduce((a, b) => a.walkM <= b.walkM ? a : b);
  }

  LatLng? asValidCoord(LatLng? c) {
    if (c == null) return null;
    final lng = c.longitude;
    final lat = c.latitude;
    if (lng < -101.5 || lng > -100.8 || lat < 19.45 || lat > 20.0) return null;
    return c;
  }

  String formatWalk(double m) {
    if (m < 1000) return '${m.round()} m';
    return '${(m / 1000).toStringAsFixed(1)} km';
  }

  List<TripPlanModel> planTrip({
    required LatLng origin,
    required LatLng destination,
    required List<RouteShapeModel> shapes,
    double maxWalkDistanceMeters = 900.0,
    bool allowTransfers = true,
  }) {
    if (origin.latitude == destination.latitude &&
        origin.longitude == destination.longitude) {
      return [
        TripPlanModel(
          type: TripPlanType.direct,
          segments: [
            TravelSegmentModel(
              type: SegmentType.walk,
              instruction: 'Ya estás en tu destino',
              distance: 0,
              duration: 0,
              walkFrom: origin,
              walkTo: destination,
              walkKind: WalkKind.toBoard,
            ),
          ],
          boardingPoint: origin,
          alightingPoint: destination,
          totalDistance: 0,
          totalDuration: 0,
          walkDistanceTotal: 0,
        )
      ];
    }

    if (shapes.isEmpty) return [];

    final directs = <TripPlanModel>[];

    // 1) Compute Direct Plans
    for (final shape in shapes) {
      final pair = findShortestWalkBoardAlight(
        shape.coordinates,
        origin,
        destination,
        maxWalkDistanceMeters,
      );
      if (pair == null) continue;
      if (pair.rideM < 250) continue;
      if (pair.walkTotal > maxWalkDistanceMeters * 2) continue;

      final boardPt = asValidCoord(pair.board.point);
      final alightPt = asValidCoord(pair.alight.point);
      if (boardPt == null || alightPt == null) continue;

      final walk1Dist = pair.board.walkM;
      final walk2Dist = pair.alight.walkM;
      final rideDistance = pair.rideM;

      final walkDuration = (walk1Dist + walk2Dist) / walkSpeed;
      final rideDuration = rideDistance / transitSpeed;
      final dirLabel = shape.direction == 'ida' ? 'Ida' : 'Vuelta';

      directs.pushPlan(
        TripPlanModel(
          type: TripPlanType.direct,
          segments: [
            TravelSegmentModel(
              type: SegmentType.walk,
              instruction: 'Camina ${formatWalk(walk1Dist)} hasta este punto para subir',
              distance: walk1Dist,
              duration: walk1Dist / walkSpeed,
              walkFrom: origin,
              walkTo: boardPt,
              walkKind: WalkKind.toBoard,
            ),
            TravelSegmentModel(
              type: SegmentType.ride,
              instruction: 'Sube cerca de · ${shape.routeName} ($dirLabel) · ~${max(1, (rideDuration / 60).round())} min',
              distance: rideDistance,
              duration: rideDuration,
              routeId: shape.routeId,
              routeName: shape.routeName,
              color: shape.color,
              direction: shape.direction,
              boardingPoint: boardPt,
              alightingPoint: alightPt,
            ),
            TravelSegmentModel(
              type: SegmentType.walk,
              instruction: 'Baja y camina ${formatWalk(walk2Dist)} hasta tu destino',
              distance: walk2Dist,
              duration: walk2Dist / walkSpeed,
              walkFrom: alightPt,
              walkTo: destination,
              walkKind: WalkKind.fromAlight,
            ),
          ],
          boardingPoint: boardPt,
          alightingPoint: alightPt,
          totalDistance: walk1Dist + rideDistance + walk2Dist,
          totalDuration: walkDuration + rideDuration,
          walkDistanceTotal: walk1Dist + walk2Dist,
        ),
      );
    }

    directs.sort((a, b) {
      if ((a.walkDistanceTotal - b.walkDistanceTotal).abs() > 40) {
        return a.walkDistanceTotal.compareTo(b.walkDistanceTotal);
      }
      return a.totalDuration.compareTo(b.totalDuration);
    });

    final goodDirects = _dedupePlans(directs).take(6).toList();

    // 2) Compute Transfer Plans (if allowed)
    final transfers = <TripPlanModel>[];
    if (allowTransfers) {
      // Find matching access points for all shapes
      final shapeAccesses = shapes.map((shape) {
        return _ShapeAccess(
          shape: shape,
          nearOrigin: collectAccessPoints(shape.coordinates, origin, maxWalkDistanceMeters),
          nearDest: collectAccessPoints(shape.coordinates, destination, maxWalkDistanceMeters),
        );
      }).toList();

      final withOrigin = shapeAccesses
          .where((a) => a.nearOrigin.isNotEmpty)
          .toList();
      withOrigin.sort((a, b) => a.minOriginWalk.compareTo(b.minOriginWalk));
      final originCandidates = withOrigin.take(20).toList();

      final withDest = shapeAccesses
          .where((a) => a.nearDest.isNotEmpty)
          .toList();
      withDest.sort((a, b) => a.minDestWalk.compareTo(b.minDestWalk));
      final destCandidates = withDest.take(20).toList();

      for (final a in originCandidates) {
        for (final b in destCandidates) {
          if (a.shape.routeId == b.shape.routeId) continue;
          if (a.shape.id == b.shape.id) continue;

          final xferResult = findTransferPoint(a.shape.coordinates, b.shape.coordinates);
          if (xferResult == null || xferResult.transferWalkDist > 90) continue;

          final board1 = pickBestAccessBefore(a.nearOrigin, xferResult.frac1);
          final alight2 = pickBestAccessAfter(b.nearDest, xferResult.frac2);
          if (board1 == null || alight2 == null) continue;

          final shape1Len = getShapeLength(a.shape.coordinates);
          final shape2Len = getShapeLength(b.shape.coordinates);
          final ride1Dist = (xferResult.frac1 - board1.fraction) * shape1Len;
          final ride2Dist = (alight2.fraction - xferResult.frac2) * shape2Len;
          if (ride1Dist < 250 || ride2Dist < 250) continue;

          final walk1Dist = board1.walkM;
          final walk2Dist = alight2.walkM;
          final xferWalkDist = xferResult.transferWalkDist;
          if (walk1Dist + walk2Dist + xferWalkDist > maxWalkDistanceMeters * 2) continue;

          final board1Pt = asValidCoord(board1.point);
          final xferOff = asValidCoord(xferResult.point);
          final alight2Pt = asValidCoord(alight2.point);
          if (board1Pt == null || xferOff == null || alight2Pt == null) continue;

          final LatLng board2Pt = asValidCoord(
            b.shape.coordinates[xferResult.idx2]
          ) ?? xferOff;

          final realTransferWalk = getHaversineDistance(xferOff, board2Pt);
          if (realTransferWalk > 100) continue;

          final walkDuration = (walk1Dist + walk2Dist + realTransferWalk) / walkSpeed;
          final rideDuration = (ride1Dist + ride2Dist) / transitSpeed;

          transfers.pushPlan(
            TripPlanModel(
              type: TripPlanType.transfer,
              segments: [
                TravelSegmentModel(
                  type: SegmentType.walk,
                  instruction: 'Camina ${formatWalk(walk1Dist)} hasta este punto para subir',
                  distance: walk1Dist,
                  duration: walk1Dist / walkSpeed,
                  walkFrom: origin,
                  walkTo: board1Pt,
                  walkKind: WalkKind.toBoard,
                ),
                TravelSegmentModel(
                  type: SegmentType.ride,
                  instruction: '1ª · Sube cerca de · ${a.shape.routeName} (${a.shape.direction == 'ida' ? 'Ida' : 'Vuelta'}) · ~${max(1, (ride1Dist / transitSpeed / 60).round())} min',
                  distance: ride1Dist,
                  duration: ride1Dist / transitSpeed,
                  routeId: a.shape.routeId,
                  routeName: a.shape.routeName,
                  color: a.shape.color,
                  direction: a.shape.direction,
                  boardingPoint: board1Pt,
                  alightingPoint: xferOff,
                ),
                TravelSegmentModel(
                  type: SegmentType.walk,
                  instruction: 'Transbordo · camina ${formatWalk(realTransferWalk)} al siguiente punto de subida',
                  distance: realTransferWalk,
                  duration: realTransferWalk / walkSpeed,
                  walkFrom: xferOff,
                  walkTo: board2Pt,
                  walkKind: WalkKind.transfer,
                ),
                TravelSegmentModel(
                  type: SegmentType.ride,
                  instruction: '2ª · Sube cerca de · ${b.shape.routeName} (${b.shape.direction == 'ida' ? 'Ida' : 'Vuelta'}) · ~${max(1, (ride2Dist / transitSpeed / 60).round())} min',
                  distance: ride2Dist,
                  duration: ride2Dist / transitSpeed,
                  routeId: b.shape.routeId,
                  routeName: b.shape.routeName,
                  color: b.shape.color,
                  direction: b.shape.direction,
                  boardingPoint: board2Pt,
                  alightingPoint: alight2Pt,
                ),
                TravelSegmentModel(
                  type: SegmentType.walk,
                  instruction: 'Baja y camina ${formatWalk(walk2Dist)} hasta tu destino',
                  distance: walk2Dist,
                  duration: walk2Dist / walkSpeed,
                  walkFrom: alight2Pt,
                  walkTo: destination,
                  walkKind: WalkKind.fromAlight,
                ),
              ],
              boardingPoint: board1Pt,
              alightingPoint: alight2Pt,
              totalDistance: walk1Dist + ride1Dist + realTransferWalk + ride2Dist + walk2Dist,
              totalDuration: walkDuration + rideDuration,
              walkDistanceTotal: walk1Dist + walk2Dist + realTransferWalk,
            ),
          );
        }
      }
    }

    transfers.sort((a, b) {
      if ((a.walkDistanceTotal - b.walkDistanceTotal).abs() > 40) {
        return a.walkDistanceTotal.compareTo(b.walkDistanceTotal);
      }
      return a.totalDuration.compareTo(b.totalDuration);
    });

    final goodTransfers = _dedupePlans(transfers).take(6).toList();

    return [...goodDirects, ...goodTransfers];
  }

  List<TripPlanModel> _dedupePlans(List<TripPlanModel> plans) {
    final seen = <String>{};
    final out = <TripPlanModel>[];
    for (final p in plans) {
      final key = p.segments
          .where((s) => s.type == SegmentType.ride)
          .map((s) => '${s.routeId}:${s.direction}')
          .join('|');
      if (seen.contains(key)) continue;
      seen.add(key);
      out.add(p);
    }
    return out;
  }
}

class _Sample {
  final LatLng point;
  final double fraction;
  final int index;

  _Sample({required this.point, required this.fraction, required this.index});
}

class _ShapeAccess {
  final RouteShapeModel shape;
  final List<AccessPoint> nearOrigin;
  final List<AccessPoint> nearDest;

  _ShapeAccess({
    required this.shape,
    required this.nearOrigin,
    required this.nearDest,
  });

  double get minOriginWalk =>
      nearOrigin.isEmpty ? double.infinity : nearOrigin.first.walkM;

  double get minDestWalk =>
      nearDest.isEmpty ? double.infinity : nearDest.first.walkM;
}

extension _ListPushPlan on List<TripPlanModel> {
  void pushPlan(TripPlanModel plan) {
    add(plan);
  }
}
