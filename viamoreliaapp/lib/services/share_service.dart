import 'package:latlong2/latlong.dart';
import 'package:share_plus/share_plus.dart';
import '../core/constants/geo_constants.dart';
import '../models/place_model.dart';
import '../models/segment_model.dart';
import '../models/trip_plan_model.dart';

class ShareService {
  /// Construye URL compatible con la web + huella de rutas del plan elegido.
  ///
  /// Params:
  /// - from / to / fromLabel / toLabel (web)
  /// - plan: índice en lista de planes
  /// - route: primera ruta del plan (web)
  /// - routes: `id:ida|id2:vuelta` para reconstruir el plan exacto
  String buildTripUrl({
    required PlaceModel? origin,
    required PlaceModel? destination,
    int? planIndex,
    String? routeId,
    String? routesFingerprint,
  }) {
    final params = <String, String>{};
    if (origin != null) {
      params['from'] = _coord(origin.coordinates);
      params['fromLabel'] = origin.name;
    }
    if (destination != null) {
      params['to'] = _coord(destination.coordinates);
      params['toLabel'] = destination.name;
    }
    if (planIndex != null) params['plan'] = '$planIndex';
    if (routeId != null && routeId.isNotEmpty) params['route'] = routeId;
    if (routesFingerprint != null && routesFingerprint.isNotEmpty) {
      params['routes'] = routesFingerprint;
    }

    final uri = Uri.parse(GeoConstants.shareBase).replace(queryParameters: params);
    return uri.toString();
  }

  /// Huella estable de rides del plan: `ruta-id:ida|otra:vuelta`
  static String fingerprintForPlan(TripPlanModel plan) {
    final parts = <String>[];
    for (final s in plan.segments) {
      if (s.type != SegmentType.ride || s.routeId == null) continue;
      final dir = s.direction ?? 'ida';
      parts.add('${s.routeId}:$dir');
    }
    return parts.join('|');
  }

  static String? primaryRouteId(TripPlanModel plan) {
    for (final s in plan.segments) {
      if (s.type == SegmentType.ride && s.routeId != null) return s.routeId;
    }
    return null;
  }

  /// Busca el plan que mejor coincide con la huella (o routeId suelto).
  static int matchPlanIndex(
    List<TripPlanModel> plans, {
    String? fingerprint,
    String? routeId,
    int? fallbackIndex,
  }) {
    if (plans.isEmpty) return 0;

    if (fingerprint != null && fingerprint.isNotEmpty) {
      final target = fingerprint.toLowerCase();
      for (var i = 0; i < plans.length; i++) {
        if (fingerprintForPlan(plans[i]).toLowerCase() == target) return i;
      }
      // Coincidencia parcial: todos los ids de la huella presentes
      final want = target.split('|').map((e) => e.split(':').first).toSet();
      for (var i = 0; i < plans.length; i++) {
        final got = plans[i]
            .segments
            .where((s) => s.routeId != null)
            .map((s) => s.routeId!.toLowerCase())
            .toSet();
        if (want.isNotEmpty && want.every(got.contains)) return i;
      }
    }

    if (routeId != null && routeId.isNotEmpty) {
      final id = routeId.toLowerCase();
      for (var i = 0; i < plans.length; i++) {
        final has = plans[i].segments.any(
          (s) => s.routeId?.toLowerCase() == id,
        );
        if (has) return i;
      }
    }

    if (fallbackIndex != null &&
        fallbackIndex >= 0 &&
        fallbackIndex < plans.length) {
      return fallbackIndex;
    }
    return 0;
  }

  Future<void> shareTrip({
    required PlaceModel? origin,
    required PlaceModel? destination,
    int? planIndex,
    String? routeId,
    String? routesFingerprint,
  }) async {
    final url = buildTripUrl(
      origin: origin,
      destination: destination,
      planIndex: planIndex,
      routeId: routeId,
      routesFingerprint: routesFingerprint,
    );
    final o = origin?.name ?? 'Origen';
    final d = destination?.name ?? 'Destino';
    await Share.share(
      'Viaje en Vía Morelia: $o → $d\n$url',
      subject: 'Mi viaje en Vía Morelia',
    );
  }

  String _coord(LatLng p) =>
      '${p.longitude.toStringAsFixed(6)},${p.latitude.toStringAsFixed(6)}';
}
