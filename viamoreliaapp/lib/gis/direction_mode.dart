import 'dart:math';
import 'package:latlong2/latlong.dart';
import '../models/route_model.dart';

/// Port de `lib/gis/direction-mode.ts` (web).
enum DirectionMode { mirrored, independent, dualRing }

class DirectionModeService {
  static const double defaultMirrorThresholdM = 25;

  static List<LatLng> reverseCoordinates(List<LatLng> coords) =>
      coords.reversed.map((c) => LatLng(c.latitude, c.longitude)).toList();

  static double haversineMeters(LatLng a, LatLng b) {
    const r = 6371000.0;
    final dLat = _rad(b.latitude - a.latitude);
    final dLon = _rad(b.longitude - a.longitude);
    final lat1 = _rad(a.latitude);
    final lat2 = _rad(b.latitude);
    final h = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2);
    return 2 * r * asin(min(1, sqrt(h)));
  }

  static double _rad(double d) => d * pi / 180;

  static List<int> _sampleIndices(int n, int maxSamples) {
    if (n <= 0) return [];
    if (n <= maxSamples) return List.generate(n, (i) => i);
    return List.generate(
      maxSamples,
      (i) => ((i * (n - 1)) / (maxSamples - 1)).round(),
    );
  }

  static double meanNearestDistanceMeters(
    List<LatLng> a,
    List<LatLng> b, {
    int maxSamples = 40,
  }) {
    if (a.isEmpty || b.isEmpty) return double.infinity;
    final aIdx = _sampleIndices(a.length, maxSamples);
    var sum = 0.0;
    final bStep = max(1, b.length ~/ 80);
    for (final i in aIdx) {
      final pt = a[i];
      var best = double.infinity;
      for (var j = 0; j < b.length; j += bStep) {
        final d = haversineMeters(pt, b[j]);
        if (d < best) best = d;
      }
      best = min(best, haversineMeters(pt, b.first));
      best = min(best, haversineMeters(pt, b.last));
      sum += best;
    }
    return sum / aIdx.length;
  }

  static double mirrorSimilarityMeters(List<LatLng> ida, List<LatLng> vuelta) {
    if (ida.length < 2 || vuelta.length < 2) return double.infinity;
    final rev = reverseCoordinates(vuelta);
    final d1 = meanNearestDistanceMeters(ida, rev);
    final d2 = meanNearestDistanceMeters(rev, ida);
    return (d1 + d2) / 2;
  }

  static DirectionMode detectMode(
    List<LatLng> ida,
    List<LatLng> vuelta, {
    double thresholdM = defaultMirrorThresholdM,
    String? propertyMode,
  }) {
    final m = (propertyMode ?? '').toLowerCase();
    if (m == 'mirrored') return DirectionMode.mirrored;
    if (m == 'independent') return DirectionMode.independent;
    if (m == 'dual_ring' || m == 'dualring') return DirectionMode.dualRing;

    final sim = mirrorSimilarityMeters(ida, vuelta);
    return sim <= thresholdM ? DirectionMode.mirrored : DirectionMode.independent;
  }

  /// Prepara shapes de explorador como `toSingleCorridorDisplay` de la web.
  ///
  /// - dual_ring / independent: ambas líneas reales ida+vuelta
  /// - mirrored: una geometría + vuelta como reverse para labels
  static List<RouteShapeModel> toCorridorDisplay(
    List<RouteShapeModel> shapes, {
    DirectionMode? forceMode,
    String preferDirection = 'both', // both | ida | vuelta
  }) {
    if (shapes.isEmpty) return const [];

    final byDir = <String, RouteShapeModel>{};
    for (final s in shapes) {
      byDir[s.direction] = s;
    }
    final ida = byDir['ida'];
    final vuelta = byDir['vuelta'];
    final propMode = ida?.directionMode ?? vuelta?.directionMode;
    final mode = forceMode ??
        detectMode(
          ida?.coordinates ?? const [],
          vuelta?.coordinates ?? const [],
          propertyMode: propMode,
        );

    if (preferDirection == 'ida' && ida != null) {
      return [ida.copyWith(role: 'full')];
    }
    if (preferDirection == 'vuelta' && vuelta != null) {
      return [vuelta.copyWith(role: 'full')];
    }
    if (preferDirection == 'ida' && ida == null && vuelta != null) {
      return [
        vuelta.copyWith(
          direction: 'ida',
          coordinates: reverseCoordinates(vuelta.coordinates),
          role: 'full',
        ),
      ];
    }
    if (preferDirection == 'vuelta' && vuelta == null && ida != null) {
      return [
        ida.copyWith(
          direction: 'vuelta',
          coordinates: reverseCoordinates(ida.coordinates),
          role: 'full',
        ),
      ];
    }

    // both
    if (mode == DirectionMode.mirrored) {
      final base = ida ?? vuelta;
      if (base == null) return shapes;
      final corridor = base.coordinates;
      final rev = reverseCoordinates(corridor);
      return [
        base.copyWith(
          id: '${base.routeId}-corridor',
          direction: 'ida',
          coordinates: corridor,
          directionMode: 'mirrored',
          role: 'full',
        ),
        base.copyWith(
          id: '${base.routeId}-sense-vuelta',
          direction: 'vuelta',
          coordinates: rev,
          directionMode: 'mirrored',
          role: 'sense-label',
        ),
      ];
    }

    // dual_ring / independent: ambas reales
    final out = <RouteShapeModel>[];
    if (ida != null) {
      out.add(ida.copyWith(directionMode: mode.name, role: 'full'));
    }
    if (vuelta != null) {
      out.add(vuelta.copyWith(directionMode: mode.name, role: 'full'));
    }
    if (out.isEmpty) return shapes.map((s) => s.copyWith(role: 'full')).toList();
    return out;
  }
}
