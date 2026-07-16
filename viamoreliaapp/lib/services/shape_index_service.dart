import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import '../core/constants/geo_constants.dart';
import '../models/route_model.dart';
import 'api_client.dart';
import 'local_db_service.dart';

/// ├ìndice de shapes: cat├ílogo r├ípido + carga bajo demanda (bbox) + cache disco.
/// No bloquea el arranque cargando las 101 rutas.
class ShapeIndexService {
  ShapeIndexService({
    ApiClient? api,
    this.baseUrl = GeoConstants.routesBase,
  }) : _api = api ?? ApiClient();

  final ApiClient _api;
  final String baseUrl;
  final LocalDbService _localDb = LocalDbService();

  List<RouteMetaModel> _catalog = [];
  final Map<String, List<RouteShapeModel>> _byRouteId = {};
  bool _catalogReady = false;
  String? _error;

  bool get isReady => _catalogReady;
  String? get error => _error;
  List<RouteMetaModel> get catalog => List.unmodifiable(_catalog);
  int get loadedShapeRouteCount => _byRouteId.length;

  List<RouteShapeModel> get allLoadedShapes =>
      _byRouteId.values.expand((e) => e).toList(growable: false);

  List<RouteShapeModel> shapesForRoute(String routeId) =>
      List.unmodifiable(_byRouteId[routeId] ?? const []);

  Future<void> initialize({void Function(double progress)? onProgress}) async {
    _error = null;
    onProgress?.call(0.1);

    // Cat├ílogo remoto ÔåÆ cache ÔåÆ assets (r├ípido; no shapes a├║n)
    var list = await _api.fetchCatalog();
    if (list.isEmpty) {
      try {
        final asset = await rootBundle.loadString('assets/routes/index.json');
        list = _parseCatalog(asset);
        await _localDb.cacheRouteMetaList(asset);
      } catch (e) {
        _error = 'No se pudo cargar cat├ílogo: $e';
      }
    }

    _catalog = list;
    _catalogReady = _catalog.isNotEmpty;
    onProgress?.call(1);
    if (!_catalogReady) {
      _error ??= 'Cat├ílogo vac├¡o';
    }
  }

  /// Precarga un subconjunto (favoritas + muestra) en background.
  Future<void> precacheSubset(List<String> routeIds, {int sample = 12}) async {
    final ids = <String>{...routeIds};
    for (final m in _catalog.take(sample)) {
      ids.add(m.id);
    }
    for (final id in ids) {
      await ensureShapesForRoute(id);
    }
  }

  Future<List<RouteShapeModel>> ensureShapesForRoute(String routeId) async {
    if (_byRouteId.containsKey(routeId)) return _byRouteId[routeId]!;
    RouteMetaModel? meta;
    for (final m in _catalog) {
      if (m.id == routeId) {
        meta = m;
        break;
      }
    }
    if (meta == null) return const [];
    final raw = await _loadGeojsonString(meta);
    if (raw == null) return const [];
    final parsed = parseShapesFromGeojson(meta, raw);
    if (parsed.isNotEmpty) _byRouteId[routeId] = parsed;
    return parsed;
  }

  /// Carga shapes para planificar OD.
  /// Evalua TODO el catalogo en lotes paralelos (no solo las primeras N)
  /// y filtra por bbox del viaje para no perder directos.
  Future<List<RouteShapeModel>> loadShapesNearTrip(
    LatLng origin,
    LatLng destination, {
    void Function(double p)? onProgress,
  }) async {
    if (_catalog.isEmpty) return const [];

    final all = <RouteShapeModel>[];
    final list = List<RouteMetaModel>.from(_catalog);
    const batch = 10;

    for (var i = 0; i < list.length; i += batch) {
      final slice = list.skip(i).take(batch).toList();
      final results = await Future.wait(
        slice.map((m) => ensureShapesForRoute(m.id)),
      );
      for (final shapes in results) {
        all.addAll(shapes);
      }
      onProgress?.call(((i + slice.length) / list.length * 0.9).clamp(0.0, 0.9));
    }

    for (final pad in [0.05, 0.09, 0.15, 0.24]) {
      final filtered = _filterShapesByBbox(all, origin, destination, pad);
      if (filtered.length >= 14 || pad >= 0.24) {
        onProgress?.call(1);
        if (filtered.isEmpty) return all;
        return filtered;
      }
    }

    onProgress?.call(1);
    return all;
  }

  List<RouteShapeModel> _filterShapesByBbox(
    List<RouteShapeModel> shapes,
    LatLng origin,
    LatLng destination,
    double pad,
  ) {
    final minLat = [origin.latitude, destination.latitude].reduce((a, b) => a < b ? a : b) - pad;
    final maxLat = [origin.latitude, destination.latitude].reduce((a, b) => a > b ? a : b) + pad;
    final minLng = [origin.longitude, destination.longitude].reduce((a, b) => a < b ? a : b) - pad;
    final maxLng = [origin.longitude, destination.longitude].reduce((a, b) => a > b ? a : b) + pad;

    final out = <RouteShapeModel>[];
    for (final s in shapes) {
      if (s.coordinates.isEmpty) continue;
      // 1 hit basta: rutas largas pueden rozar el bbox en pocos puntos
      final step = (s.coordinates.length / 20).ceil().clamp(1, 40);
      for (var i = 0; i < s.coordinates.length; i += step) {
        final p = s.coordinates[i];
        if (p.latitude >= minLat &&
            p.latitude <= maxLat &&
            p.longitude >= minLng &&
            p.longitude <= maxLng) {
          out.add(s);
          break;
        }
      }
    }
    return out;
  }

  Future<String?> _loadGeojsonString(RouteMetaModel meta) async {
    // 1) Disk cache
    final cached = await _localDb.getCachedRouteGeojson(meta.id);
    if (cached != null) return cached;

    // 2) Asset bundle
    try {
      final data = await rootBundle.loadString('assets/routes/${meta.id}.geojson');
      // cache async fire-and-forget
      _localDb.cacheRouteGeojson(meta.id, data);
      return data;
    } catch (_) {}

    // 3) Network
    final filename = meta.geojsonFile ?? 'routes/${meta.id}.geojson';
    final clean = filename.startsWith('/') ? filename.substring(1) : filename;
    try {
      final response = await http
          .get(Uri.parse('$baseUrl/$clean'), headers: {'User-Agent': 'ViaMorelia-Flutter/1.0'})
          .timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        await _localDb.cacheRouteGeojson(meta.id, response.body);
        return response.body;
      }
    } catch (e) {
      debugPrint('geojson fetch ${meta.id}: $e');
    }
    return null;
  }

  List<RouteMetaModel> _parseCatalog(String jsonString) {
    final data = jsonDecode(jsonString) as Map<String, dynamic>;
    final routes = data['routes'] as List<dynamic>? ?? [];
    return routes
        .map((r) => RouteMetaModel.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  static List<RouteShapeModel> parseShapesFromGeojson(RouteMetaModel meta, String geojsonStr) {
    final out = <RouteShapeModel>[];
    try {
      final data = jsonDecode(geojsonStr) as Map<String, dynamic>;
      final rootProps = data['properties'] as Map<String, dynamic>? ?? {};
      final rootMode = (rootProps['directionMode'] ?? rootProps['corridor'] ?? '').toString();
      final features = data['features'] as List<dynamic>? ?? [];

      for (final f in features) {
        final properties = f['properties'] as Map<String, dynamic>? ?? {};
        final geometry = f['geometry'] as Map<String, dynamic>? ?? {};

        final type = (properties['type'] ?? '').toString().toLowerCase();
        if (type == 'sense-label' || type == 'walk') continue;
        if (geometry['type'] != 'LineString') continue;

        final dirRaw = (properties['direction'] ?? properties['name'] ?? '').toString().toLowerCase();
        final dir = dirRaw.contains('ida')
            ? 'ida'
            : dirRaw.contains('vuelta')
                ? 'vuelta'
                : '';

        if (dir != 'ida' && dir != 'vuelta') continue;

        // QA: skip rejected shapes if annotated
        final qa = (properties['qa_status'] ?? properties['qaStatus'] ?? meta.qaStatus ?? 'approved')
            .toString()
            .toLowerCase();
        if (qa == 'rejected') continue;

        final coordsList = geometry['coordinates'] as List<dynamic>?;
        if (coordsList == null || coordsList.length < 2) continue;

        final coordinates = coordsList.map((c) {
          final point = c as List<dynamic>;
          return LatLng(
            (point[1] as num).toDouble(),
            (point[0] as num).toDouble(),
          );
        }).toList();

        final mode = (properties['directionMode'] ?? rootMode).toString();
        Color? casing;
        final casingHex = properties['casingColor'] as String? ?? meta.casingColor;
        if (casingHex != null) {
          try {
            var h = casingHex.replaceAll('#', '');
            if (h.length == 6) h = 'FF$h';
            casing = Color(int.parse(h, radix: 16));
          } catch (_) {}
        }

        out.add(RouteShapeModel(
          id: '${meta.id}-$dir',
          routeId: meta.id,
          routeName: properties['routeName'] as String? ?? meta.name,
          color: meta.color,
          direction: dir,
          coordinates: coordinates,
          directionMode: mode.isEmpty ? null : mode,
          role: 'full',
          casingColor: casing,
        ));
      }
    } catch (_) {}
    return out;
  }
}
