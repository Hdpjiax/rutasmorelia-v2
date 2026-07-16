import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/constants/geo_constants.dart';
import '../models/place_model.dart';
import '../models/route_model.dart';
import 'local_db_service.dart';

/// Cliente de APIs de la web (proxies de producción).
class ApiClient {
  ApiClient({
    this.webBase = GeoConstants.webBase,
    this.routesBase = GeoConstants.routesBase,
  });

  final String webBase;
  final String routesBase;
  final LocalDbService _db = LocalDbService();
  final _http = http.Client();

  static const _ua = 'ViaMorelia-Flutter/1.0 (https://viamorelia.org)';

  Future<List<RouteMetaModel>> fetchCatalog() async {
    // 1) Remote catalog API
    try {
      final res = await _http
          .get(
            Uri.parse('$webBase/api/routes/catalog'),
            headers: {'User-Agent': _ua, 'Accept': 'application/json'},
          )
          .timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        await _db.cacheRouteMetaList(res.body);
        return _parseCatalog(res.body);
      }
    } catch (_) {}

    // 2) Static index on Vercel
    try {
      final res = await _http
          .get(
            Uri.parse('$routesBase/routes/index.json'),
            headers: {'User-Agent': _ua},
          )
          .timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        await _db.cacheRouteMetaList(res.body);
        return _parseCatalog(res.body);
      }
    } catch (_) {}

    // 3) Disk cache
    final cached = await _db.getCachedRouteMetaList();
    if (cached != null) return _parseCatalog(cached);

    return [];
  }

  Future<List<PlaceModel>> geocode(String query) async {
    final q = query.trim();
    if (q.length < 2) return [];
    try {
      final uri = Uri.parse('$webBase/api/geocode').replace(queryParameters: {'q': q});
      final res = await _http
          .get(uri, headers: {'User-Agent': _ua, 'Accept': 'application/json'})
          .timeout(const Duration(seconds: 5));
      if (res.statusCode == 429) {
        throw ApiException('RATE_LIMIT', 'Demasiadas búsquedas. Espera un momento.');
      }
      if (res.statusCode != 200) return [];
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final results = data['results'] as List<dynamic>? ?? [];
      return results.map((raw) {
        final m = Map<String, dynamic>.from(raw as Map);
        m['source'] = 'geocode';
        return PlaceModel.fromJson(m);
      }).toList();
    } catch (e) {
      if (e is ApiException) rethrow;
      return [];
    }
  }

  Future<List<List<double>>> walkRoute(double fromLng, double fromLat, double toLng, double toLat) async {
    try {
      final uri = Uri.parse('$webBase/api/walk-route').replace(queryParameters: {
        'fromLng': '$fromLng',
        'fromLat': '$fromLat',
        'toLng': '$toLng',
        'toLat': '$toLat',
      });
      final res = await _http
          .get(uri, headers: {'User-Agent': _ua})
          .timeout(const Duration(milliseconds: 2200));
      if (res.statusCode != 200) return [];
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      final feature = data['feature'] as Map<String, dynamic>?;
      final geom = feature?['geometry'] as Map<String, dynamic>?;
      final coords = geom?['coordinates'] as List<dynamic>?;
      if (coords == null) return [];
      return coords
          .map((c) => [
                (c[0] as num).toDouble(),
                (c[1] as num).toDouble(),
              ])
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<bool> reportRoute({
    required String routeId,
    String? routeName,
    required String reason,
    String? note,
  }) async {
    try {
      final res = await _http
          .post(
            Uri.parse('$webBase/api/report-route'),
            headers: {
              'User-Agent': _ua,
              'Content-Type': 'application/json',
            },
            body: jsonEncode({
              'routeId': routeId,
              if (routeName != null) 'routeName': routeName,
              'reason': reason,
              if (note != null && note.isNotEmpty) 'note': note,
            }),
          )
          .timeout(const Duration(seconds: 8));
      return res.statusCode >= 200 && res.statusCode < 300;
    } catch (_) {
      return false;
    }
  }

  Future<void> telemetry(String type, [Map<String, dynamic>? props]) async {
    try {
      await _http
          .post(
            Uri.parse('$webBase/api/telemetry'),
            headers: {
              'User-Agent': _ua,
              'Content-Type': 'application/json',
            },
            body: jsonEncode({
              'event': {
                'type': type,
                'ts': DateTime.now().toUtc().toIso8601String(),
                'platform': 'flutter',
                if (props != null) ...props,
              },
            }),
          )
          .timeout(const Duration(seconds: 3));
    } catch (_) {}
  }

  List<RouteMetaModel> _parseCatalog(String jsonString) {
    final data = jsonDecode(jsonString) as Map<String, dynamic>;
    final routes = data['routes'] as List<dynamic>? ?? data['items'] as List<dynamic>? ?? [];
    return routes
        .map((r) => RouteMetaModel.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  void dispose() => _http.close();
}

class ApiException implements Exception {
  final String code;
  final String message;
  ApiException(this.code, this.message);
  @override
  String toString() => message;
}
