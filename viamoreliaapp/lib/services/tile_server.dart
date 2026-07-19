import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:pmtiles/pmtiles.dart';

class TileServer {
  HttpServer? _server;
  PmTilesArchive? _routesArchive;
  PmTilesArchive? _basemapArchive;
  final String routesPmtilesPath;
  final String basemapPmtilesPath;

  TileServer({
    required this.routesPmtilesPath,
    required this.basemapPmtilesPath,
  });

  Future<void> start() async {
    try {
      _routesArchive = await PmTilesArchive.from(routesPmtilesPath);
      
      final basemapFile = File(basemapPmtilesPath);
      if (await basemapFile.exists()) {
        _basemapArchive = await PmTilesArchive.from(basemapPmtilesPath);
        debugPrint('Basemap PMTiles cargado con éxito desde $basemapPmtilesPath');
      } else {
        debugPrint('Aviso: Archivo de basemap PMTiles no encontrado en $basemapPmtilesPath. Se ejecutará sin basemap offline.');
      }

      // Bind to localhost on a random available port (0)
      _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      
      _server!.listen((HttpRequest request) async {
        final path = request.uri.path;
        try {
          if (path == '/tiles.json') {
            request.response.headers.contentType = ContentType.json;
            request.response.headers.set('Access-Control-Allow-Origin', '*');
            
            final tileJson = {
              'tilejson': '2.2.0',
              'name': 'rutas',
              'version': '1.0.0',
              'scheme': 'xyz',
              'tiles': [
                'http://127.0.0.1:$port/tiles/{z}/{x}/{y}.pbf'
              ],
              'minzoom': minZoom,
              'maxzoom': maxZoom,
              'bounds': [-101.35, 19.55, -101.05, 19.85]
            };
            
            request.response.write(jsonEncode(tileJson));
            debugPrint('TileServer SUCCESS: served tiles.json');
            return;
          }

          final routesMatch = RegExp(r'^/tiles/(\d+)/(\d+)/(\d+)\.pbf$').firstMatch(path);
          final basemapMatch = RegExp(r'^/basemap/(\d+)/(\d+)/(\d+)\.pbf$').firstMatch(path);

          if (routesMatch != null && _routesArchive != null) {
            final z = int.parse(routesMatch.group(1)!);
            final x = int.parse(routesMatch.group(2)!);
            final y = int.parse(routesMatch.group(3)!);
            await _serveTile(_routesArchive!, z, x, y, request, path);
          } else if (basemapMatch != null && _basemapArchive != null) {
            final z = int.parse(basemapMatch.group(1)!);
            final x = int.parse(basemapMatch.group(2)!);
            final y = int.parse(basemapMatch.group(3)!);
            await _serveTile(_basemapArchive!, z, x, y, request, path);
          } else {
            request.response.statusCode = HttpStatus.notFound;
            debugPrint('TileServer 404: $path (invalid pattern or archive not loaded)');
            await request.response.close();
          }
        } catch (e) {
          request.response.statusCode = HttpStatus.internalServerError;
          debugPrint('TileServer ERROR: $path -> $e');
          try {
            await request.response.close();
          } catch (_) {}
        }
      });
      debugPrint('Local tile server started on port $port serving archives.');
    } catch (e) {
      debugPrint('Error starting local tile server: $e');
      rethrow;
    }
  }

  Future<void> _serveTile(
    PmTilesArchive archive,
    int z,
    int x,
    int y,
    HttpRequest request,
    String path,
  ) async {
    final tileId = ZXY(z, x, y).toTileId();
    final tile = await archive.tile(tileId);
    List<int> bytes;
    try {
      bytes = tile.bytes();
    } catch (_) {
      request.response.statusCode = HttpStatus.notFound;
      debugPrint('TileServer 404 (TileNotFound): $path');
      return;
    }
    
    request.response.headers.contentType = ContentType('application', 'x-protobuf');
    request.response.headers.set('Content-Encoding', 'gzip');
    request.response.headers.set('Access-Control-Allow-Origin', '*');
    
    request.response.add(bytes);
    debugPrint('TileServer SUCCESS: $path (bytes: ${bytes.length})');
  }

  int get port => _server?.port ?? 0;
  int get minZoom => _routesArchive?.minZoom ?? 0;
  int get maxZoom => _routesArchive?.maxZoom ?? 14;

  Future<void> stop() async {
    try {
      await _server?.close(force: true);
      await _routesArchive?.close();
      await _basemapArchive?.close();
    } catch (e) {
      debugPrint('Error stopping local tile server: $e');
    }
  }
}
