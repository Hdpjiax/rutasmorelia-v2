import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:maplibre/maplibre.dart';

/// Aplica tintes tipo web (`enhance-basemap.ts`) + Periférico República.
///
/// - Parques/verde, agua, vías férreas (sobre capas Carto Positron)
/// - Circuito Periférico Paseo de la República (GeoJSON OSM real)
Future<void> enhanceBasemapLikeWeb(StyleController style) async {
  // ---- Verde / parques (sobre landcover existente) ----
  await _tryAddFill(
    style,
    id: 'rm-green-landcover',
    sourceId: 'carto',
    sourceLayerId: 'landcover',
    paint: {
      'fill-color': '#cfe8c8',
      'fill-opacity': 0.55,
    },
  );
  await _tryAddFill(
    style,
    id: 'rm-green-park',
    sourceId: 'carto',
    sourceLayerId: 'park',
    paint: {
      'fill-color': '#cfe8c8',
      'fill-opacity': 0.62,
    },
  );
  await _tryAddFill(
    style,
    id: 'rm-green-landuse',
    sourceId: 'carto',
    sourceLayerId: 'landuse',
    paint: {
      'fill-color': '#d4ebc9',
      'fill-opacity': 0.35,
    },
  );

  // ---- Agua ----
  await _tryAddFill(
    style,
    id: 'rm-water-boost',
    sourceId: 'carto',
    sourceLayerId: 'water',
    paint: {
      'fill-color': '#b8d8e8',
      'fill-opacity': 0.88,
    },
  );
  await _tryAddLine(
    style,
    id: 'rm-waterway-boost',
    sourceId: 'carto',
    sourceLayerId: 'waterway',
    paint: {
      'line-color': '#8eb8cc',
      'line-opacity': 0.85,
      'line-width': 1.2,
    },
  );

  // ---- Ferrocarril (tenue, como web) ----
  await _tryAddLine(
    style,
    id: 'rm-rail-boost',
    sourceId: 'carto',
    sourceLayerId: 'transportation',
    filter: [
      'in',
      ['get', 'class'],
      ['literal', ['rail', 'transit']],
    ],
    paint: {
      'line-color': '#c2b8b0',
      'line-opacity': 0.32,
      'line-width': 1.4,
    },
  );

  // ---- Periférico República (asset) ----
  try {
    final geo = await rootBundle.loadString('assets/map/periferico-republica.geojson');
    await style.addSource(
      GeoJsonSource(id: 'rm-periferico', data: geo, maxZoom: 18),
    );
    await style.addLayer(
      LineStyleLayer(
        id: 'rm-periferico-casing',
        sourceId: 'rm-periferico',
        paint: {
          'line-color': '#f3e8b8',
          'line-width': 9.0,
          'line-opacity': 0.18,
          'line-blur': 0.8,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      ),
    );
    await style.addLayer(
      LineStyleLayer(
        id: 'rm-periferico-line',
        sourceId: 'rm-periferico',
        paint: {
          'line-color': '#f5e9b0',
          'line-width': 4.5,
          'line-opacity': 0.38,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      ),
    );
    // Etiqueta a lo largo del eje (si el runtime lo soporta)
    await style.addLayer(
      SymbolStyleLayer(
        id: 'rm-periferico-label',
        sourceId: 'rm-periferico',
        minZoom: 12.5,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 280,
          'text-field': 'Periférico República',
          'text-size': 10.5,
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-keep-upright': true,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#9a8f5c',
          'text-halo-color': '#fffef8',
          'text-halo-width': 2.0,
          'text-opacity': 0.85,
        },
      ),
    );
  } catch (e) {
    debugPrint('[basemap] periferico: $e');
  }
}

Future<void> _tryAddFill(
  StyleController style, {
  required String id,
  required String sourceId,
  required String sourceLayerId,
  required Map<String, Object> paint,
  List<Object>? filter,
}) async {
  try {
    await style.addLayer(
      FillStyleLayer(
        id: id,
        sourceId: sourceId,
        sourceLayerId: sourceLayerId,
        paint: paint,
        filter: filter,
      ),
    );
  } catch (e) {
    debugPrint('[basemap] skip $id: $e');
  }
}

Future<void> _tryAddLine(
  StyleController style, {
  required String id,
  required String sourceId,
  required String sourceLayerId,
  required Map<String, Object> paint,
  Map<String, Object>? layout,
  List<Object>? filter,
}) async {
  try {
    await style.addLayer(
      LineStyleLayer(
        id: id,
        sourceId: sourceId,
        sourceLayerId: sourceLayerId,
        paint: paint,
        layout: layout ?? const {},
        filter: filter,
      ),
    );
  } catch (e) {
    debugPrint('[basemap] skip $id: $e');
  }
}
