import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:pmtiles/pmtiles.dart';

class TileServer {
  HttpServer? _server;
  PmTilesArchive? _archive;
  final String pmtilesPath;

  TileServer({required this.pmtilesPath});

  Future<void> start() async {
    try {
      _archive = await PmTilesArchive.from(pmtilesPath);
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
          // Path matches /tiles/z/x/y.pbf
          final match = RegExp(r'^/tiles/(\d+)/(\d+)/(\d+)\.pbf$').firstMatch(path);
          if (match != null) {
            final z = int.parse(match.group(1)!);
            final x = int.parse(match.group(2)!);
            final y = int.parse(match.group(3)!);
            
            final tileId = ZXY(z, x, y).toTileId();
            final tile = await _archive!.tile(tileId);
            List<int> bytes;
            try {
              bytes = tile.bytes();
            } catch (_) {
              request.response.statusCode = HttpStatus.notFound;
              debugPrint('TileServer 404 (TileNotFound): $path');
              return;
            }
            
            // Set protobuf content type for vector tiles
            request.response.headers.contentType = ContentType('application', 'x-protobuf');
            
            // MapLibre expects decompression or content encoding
            // Tippecanoe vector tiles are typically gzip compressed.
            // We set Content-Encoding to gzip, so native MapLibre client decompresses automatically.
            request.response.headers.set('Content-Encoding', 'gzip');
            request.response.headers.set('Access-Control-Allow-Origin', '*');
            
            request.response.add(bytes);
            debugPrint('TileServer SUCCESS: $path (bytes: ${bytes.length})');
          } else {
            request.response.statusCode = HttpStatus.notFound;
            debugPrint('TileServer 404: $path (invalid pattern)');
          }
        } catch (e) {
          request.response.statusCode = HttpStatus.internalServerError;
          debugPrint('TileServer ERROR: $path -> $e');
        } finally {
          await request.response.close();
        }
      });
      final meta = await _archive!.metadata;
      debugPrint('Local tile server started on port $port serving $pmtilesPath (minZoom: $minZoom, maxZoom: $maxZoom)');
      debugPrint('PMTiles Archive Metadata: $meta');
    } catch (e) {
      debugPrint('Error starting local tile server: $e');
      rethrow;
    }
  }

  int get port => _server?.port ?? 0;
  int get minZoom => _archive?.minZoom ?? 0;
  int get maxZoom => _archive?.maxZoom ?? 14;

  Future<void> stop() async {
    try {
      await _server?.close(force: true);
      await _archive?.close();
    } catch (e) {
      debugPrint('Error stopping local tile server: $e');
    }
  }
}
