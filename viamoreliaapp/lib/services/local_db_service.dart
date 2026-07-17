import 'dart:io';
import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
}
