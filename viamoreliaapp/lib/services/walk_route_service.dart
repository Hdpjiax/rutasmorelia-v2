import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'api_client.dart';

/// Walk: caché en memoria + proxy web → OSRM simplificado → línea recta.
class WalkRouteService {
  WalkRouteService({ApiClient? api}) : _api = api ?? ApiClient();
  final ApiClient _api;

  /// Caché por tramo (aprox. 5 m de precisión).
  final Map<String, List<LatLng>> _cache = {};

  static String _key(LatLng from, LatLng to) {
    String r(double v) => v.toStringAsFixed(4);
    return '${r(from.latitude)},${r(from.longitude)}>${r(to.latitude)},${r(to.longitude)}';
  }

  Future<List<LatLng>> fetchWalkRoute(
    LatLng from,
    LatLng to, {
    bool online = true,
  }) async {
    final k = _key(from, to);
    final hit = _cache[k];
    if (hit != null) return hit;

    // Tramos muy cortos: no gastar red
    final dx = from.latitude - to.latitude;
    final dy = from.longitude - to.longitude;
    if (dx * dx + dy * dy < 1e-10) {
      return _cache[k] = [from, to];
    }

    if (!online) return _cache[k] = [from, to];

    // 1) Proxy web (timeout corto)
    try {
      final proxy = await _api
          .walkRoute(from.longitude, from.latitude, to.longitude, to.latitude)
          .timeout(const Duration(milliseconds: 8000));
      if (proxy.length >= 2) {
        final path = proxy.map((c) => LatLng(c[1], c[0])).toList();
        return _cache[k] = path;
      }
    } catch (_) {}

    // 2) OSRM público simplified (más rápido que overview=full)
    try {
      final url =
          'https://router.project-osrm.org/route/v1/foot/'
          '${from.longitude},${from.latitude};${to.longitude},${to.latitude}'
          '?overview=simplified&geometries=geojson';
      final res = await http
          .get(
            Uri.parse(url),
            headers: {'User-Agent': 'ViaMorelia/1.0 (https://viamorelia.org; foot)'},
          )
          .timeout(const Duration(milliseconds: 8000));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final routes = data['routes'] as List<dynamic>?;
        final geom = routes?.firstOrNull?['geometry'] as Map<String, dynamic>?;
        final coords = geom?['coordinates'] as List<dynamic>?;
        if (coords != null && coords.length >= 2) {
          final path = coords
              .map((c) => LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()))
              .toList();
          return _cache[k] = path;
        }
      }
    } catch (_) {}

    return _cache[k] = [from, to];
  }

  /// Varios tramos en paralelo (p. ej. walks de un plan).
  Future<List<List<LatLng>>> fetchMany(
    List<(LatLng, LatLng)> pairs, {
    bool online = true,
  }) {
    return Future.wait(
      pairs.map((p) => fetchWalkRoute(p.$1, p.$2, online: online)),
    );
  }
}
