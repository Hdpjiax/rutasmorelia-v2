import 'dart:io';
import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;
import '../models/route_model.dart';

class LocalDbService {
  static const String _kRouteMetaListKey = 'cached_route_meta_list';
  static const String _kAssetsVersionKey = 'routes_assets_version_v3';

  Future<String?> getCachedRouteMetaList() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kRouteMetaListKey);
  }

  Future<void> cacheRouteMetaList(String jsonString) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kRouteMetaListKey, jsonString);
  }

  Future<String?> getCachedAssetsVersion() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kAssetsVersionKey);
  }

  Future<void> setCachedAssetsVersion(String version) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kAssetsVersionKey, version);
  }

  Future<File> _getGeojsonFile(String routeId) async {
    final dir = await getApplicationDocumentsDirectory();
    final routesDir = Directory('${dir.path}/routes');
    if (!await routesDir.exists()) {
      await routesDir.create(recursive: true);
    }
    return File('${routesDir.path}/$routeId.geojson');
  }

  Future<String?> getCachedRouteGeojson(String routeId) async {
    try {
      final file = await _getGeojsonFile(routeId);
      if (await file.exists()) {
        return await file.readAsString();
      }
    } catch (_) {
      // Fallback
    }
    return null;
  }

  Future<void> cacheRouteGeojson(String routeId, String geojsonString) async {
    try {
      final file = await _getGeojsonFile(routeId);
      await file.writeAsString(geojsonString);
    } catch (_) {
      // Ignore write errors
    }
  }

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    final documentsDirectory = await getApplicationDocumentsDirectory();
    final path = p.join(documentsDirectory.path, "viamorelia.db");
    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE routes (
        id TEXT PRIMARY KEY,
        name TEXT,
        color INTEGER,
        direction_mode TEXT
      )
    ''');
    await db.execute('''
      CREATE TABLE shapes (
        id TEXT PRIMARY KEY,
        route_id TEXT,
        direction TEXT,
        coordinates_json TEXT,
        min_lat REAL,
        max_lat REAL,
        min_lng REAL,
        max_lng REAL,
        casing_color INTEGER,
        FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE
      )
    ''');
    await db.execute('''
      CREATE INDEX IF NOT EXISTS idx_shapes_bbox 
      ON shapes (min_lat, max_lat, min_lng, max_lng)
    ''');
  }

  Future<void> saveRoutesAndShapes(List<RouteMetaModel> routes, Map<String, List<RouteShapeModel>> shapesMap) async {
    final db = await database;
    await db.transaction((txn) async {
      final batch = txn.batch();
      for (final r in routes) {
        final shapes = shapesMap[r.id] ?? [];
        final mode = shapes.isNotEmpty ? (shapes.first.directionMode ?? '') : '';
        batch.insert(
          'routes',
          {
            'id': r.id,
            'name': r.name,
            'color': r.color.value,
            'direction_mode': mode,
          },
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      for (final routeId in shapesMap.keys) {
        final shapes = shapesMap[routeId] ?? [];
        for (final s in shapes) {
          if (s.coordinates.isEmpty) continue;
          double minLat = double.infinity;
          double maxLat = -double.infinity;
          double minLng = double.infinity;
          double maxLng = -double.infinity;
          for (final c in s.coordinates) {
            if (c.latitude < minLat) minLat = c.latitude;
            if (c.latitude > maxLat) maxLat = c.latitude;
            if (c.longitude < minLng) minLng = c.longitude;
            if (c.longitude > maxLng) maxLng = c.longitude;
          }
          final coordsJson = s.coordinates.map((c) => [c.longitude, c.latitude]).toList();
          batch.insert(
            'shapes',
            {
              'id': s.id,
              'route_id': s.routeId,
              'direction': s.direction,
              'coordinates_json': jsonEncode(coordsJson),
              'min_lat': minLat,
              'max_lat': maxLat,
              'min_lng': minLng,
              'max_lng': maxLng,
              'casing_color': s.casingColor?.value,
            },
            conflictAlgorithm: ConflictAlgorithm.replace,
          );
        }
      }
      await batch.commit(noResult: true);
    });
  }

  Future<List<Map<String, dynamic>>> queryShapesInBbox(
    double minLat,
    double maxLat,
    double minLng,
    double maxLng,
  ) async {
    final db = await database;
    return await db.rawQuery('''
      SELECT s.*, r.name as route_name, r.color as route_color, r.direction_mode
      FROM shapes s
      JOIN routes r ON s.route_id = r.id
      WHERE NOT (s.max_lat < ? OR s.min_lat > ? OR s.max_lng < ? OR s.min_lng > ?)
    ''', [minLat, maxLat, minLng, maxLng]);
  }

  Future<void> clearCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kRouteMetaListKey);
    try {
      final dir = await getApplicationDocumentsDirectory();
      final routesDir = Directory('${dir.path}/routes');
      if (await routesDir.exists()) {
        await routesDir.delete(recursive: true);
      }
      final pmtilesFile = File('${dir.path}/rutas.pmtiles');
      if (await pmtilesFile.exists()) {
        await pmtilesFile.delete();
      }
      if (_db != null) {
        await _db!.close();
        _db = null;
      }
      final dbPath = p.join(dir.path, "viamorelia.db");
      final dbFile = File(dbPath);
      if (await dbFile.exists()) {
        await dbFile.delete();
      }
    } catch (_) {
      // Ignore
    }
  }

  Future<String> getLocalPmtilesPath() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/rutas.pmtiles');
    
    final data = await rootBundle.load('assets/routes/rutas.pmtiles');
    final assetLength = data.lengthInBytes;
    
    bool needsCopy = true;
    if (await file.exists()) {
      final localLength = await file.length();
      if (localLength == assetLength) {
        needsCopy = false;
      }
    }
    
    if (needsCopy) {
      final bytes = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
      await file.writeAsBytes(bytes);
    }
    return file.path;
  }

  Future<String> getLocalBasemapPmtilesPath() async {
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/morelia_basemap.pmtiles');
    try {
      final data = await rootBundle.load('assets/map/morelia_basemap.pmtiles');
      final assetLength = data.lengthInBytes;
      
      bool needsCopy = true;
      if (await file.exists()) {
        final localLength = await file.length();
        if (localLength == assetLength) {
          needsCopy = false;
        }
      }
      
      if (needsCopy) {
        final bytes = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
        await file.writeAsBytes(bytes);
      }
      return file.path;
    } catch (_) {
      return file.path;
    }
  }
}
