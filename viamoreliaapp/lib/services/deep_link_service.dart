import 'dart:async';
import 'package:app_links/app_links.dart';
import 'package:latlong2/latlong.dart';

class TripDeepLink {
  final LatLng? origin;
  final LatLng? destination;
  final String? originLabel;
  final String? destinationLabel;
  final String? routeId;
  /// Huella `id:ida|id2:vuelta` del plan elegido al compartir.
  final String? routesFingerprint;
  final int? planIndex;

  const TripDeepLink({
    this.origin,
    this.destination,
    this.originLabel,
    this.destinationLabel,
    this.routeId,
    this.routesFingerprint,
    this.planIndex,
  });

  bool get hasTrip =>
      origin != null || destination != null || routeId != null || routesFingerprint != null;
}

class DeepLinkService {
  final AppLinks _links = AppLinks();
  StreamSubscription<Uri>? _sub;

  Future<TripDeepLink?> getInitial() async {
    try {
      final uri = await _links.getInitialLink();
      if (uri == null) return null;
      return parseUri(uri);
    } catch (_) {
      return null;
    }
  }

  Stream<TripDeepLink> listen() {
    final controller = StreamController<TripDeepLink>.broadcast();
    _sub = _links.uriLinkStream.listen((uri) {
      final parsed = parseUri(uri);
      if (parsed != null && parsed.hasTrip) controller.add(parsed);
    });
    return controller.stream;
  }

  static TripDeepLink? parseUri(Uri uri) {
    // viamorelia://open?...  or https://viamorelia.org/?from=...
    final q = uri.queryParameters;
    if (q.isEmpty && uri.fragment.isNotEmpty) {
      // ignore
    }
    if (q.isEmpty) return null;

    LatLng? origin = _parseCoord(q['from']);
    LatLng? dest = _parseCoord(q['to']);
    final planRaw = q['plan'];
    final planIndex = planRaw != null ? int.tryParse(planRaw) : null;
    final routesFp = q['routes']?.trim();
    final routeId = q['route']?.trim();

    return TripDeepLink(
      origin: origin,
      destination: dest,
      originLabel: q['fromLabel'] ?? q['ol'],
      destinationLabel: q['toLabel'] ?? q['dl'],
      routeId: (routeId != null && routeId.isNotEmpty) ? routeId : null,
      routesFingerprint: (routesFp != null && routesFp.isNotEmpty) ? routesFp : null,
      planIndex: planIndex,
    );
  }

  /// Acepta lng,lat o lat,lng (heurística Morelia).
  static LatLng? _parseCoord(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final parts = raw.split(',');
    if (parts.length != 2) return null;
    final a = double.tryParse(parts[0].trim());
    final b = double.tryParse(parts[1].trim());
    if (a == null || b == null) return null;
    // lng ~ -101, lat ~ 19.7
    if (a >= -102.5 && a <= -100 && b >= 19 && b <= 20.5) {
      return LatLng(b, a);
    }
    if (b >= -102.5 && b <= -100 && a >= 19 && a <= 20.5) {
      return LatLng(a, b);
    }
    if (a.abs() <= 90 && b.abs() <= 180) {
      // assume lat,lng
      return LatLng(a, b);
    }
    return LatLng(b, a);
  }

  Future<void> dispose() async {
    await _sub?.cancel();
  }
}
