import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:maplibre/maplibre.dart';

/// Ajustes sobre Carto Positron (mapa **blanco/papel**).
///
/// Importante: NO pintar landuse/landcover completo en verde (eso tiñe
/// toda la ciudad). Solo realzar zonas puntuales, como en la web:
/// - parques / césped / bosque (filtrados por `class`)
/// - agua
/// - ferrocarril tenue
/// - Periférico República (GeoJSON)
Future<void> enhanceBasemapLikeWeb(StyleController style) async {
  // Clases verdes reales (OpenMapTiles). Excluye residential/commercial/etc.
  final greenClasses = [
    'grass',
    'wood',
    'forest',
    'park',
    'garden',
    'cemetery',
    'pitch',
    'golf_course',
    'recreation_ground',
    'allotments',
    'village_green',
    'scrub',
    'wetland',
    'national_park',
    'nature_reserve',
  ];

  final greenFilter = <Object>[
    'in',
    ['get', 'class'],
    ['literal', greenClasses],
  ];

  // Parques / áreas verdes (sutiles; mapa base se mantiene claro)
  await _tryAddFill(
    style,
    id: 'rm-green-landcover',
    sourceId: 'carto',
    sourceLayerId: 'landcover',
    filter: greenFilter,
    paint: {
      'fill-color': '#cfe8c8',
      'fill-opacity': 0.42,
    },
  );
  await _tryAddFill(
    style,
    id: 'rm-green-park',
    sourceId: 'carto',
    sourceLayerId: 'park',
    paint: {
      'fill-color': '#cfe8c8',
      'fill-opacity': 0.48,
    },
  );
  // Solo landuse de tipo parque/recreo — NUNCA todo el landuse
  await _tryAddFill(
    style,
    id: 'rm-green-landuse',
    sourceId: 'carto',
    sourceLayerId: 'landuse',
    filter: greenFilter,
    paint: {
      'fill-color': '#d4ebc9',
      'fill-opacity': 0.36,
    },
  );

  // Agua (como en web)
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

  // (rail omitido a propósito: poco valor visual vs costo de capa extra)

  // Periférico República (asset local)
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
          'line-opacity': 0.16,
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
          'line-opacity': 0.34,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      ),
    );
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
