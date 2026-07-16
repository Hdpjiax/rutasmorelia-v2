import 'dart:io';
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
        try {
          final path = request.uri.path;
          
          // Path matches /tiles/z/x/y.pbf
          final match = RegExp(r'^/tiles/(\d+)/(\d+)/(\d+)\.pbf$').firstMatch(path);
          if (match != null) {
            final z = int.parse(match.group(1)!);
            final x = int.parse(match.group(2)!);
            final y = int.parse(match.group(3)!);
            
            // In the pmtiles package, ZXY is defined in src/zxy.dart and exported
            final tileId = ZXY(z, x, y).toTileId();
            final tile = await _archive!.tile(tileId);
            
            // Set protobuf content type for vector tiles
            request.response.headers.contentType = ContentType('application', 'x-protobuf');
            
            // MapLibre expects decompression or content encoding
            // Tippecanoe vector tiles are typically gzip compressed.
            // We set Content-Encoding to gzip, so native MapLibre client decompresses automatically.
            request.response.headers.set('Content-Encoding', 'gzip');
            request.response.headers.set('Access-Control-Allow-Origin', '*');
            
            final bytes = tile.bytes();
            request.response.add(bytes);
          } else {
            request.response.statusCode = HttpStatus.notFound;
          }
        } catch (e) {
          request.response.statusCode = HttpStatus.internalServerError;
        } finally {
          await request.response.close();
        }
      });
      debugPrint('Local tile server started on port $port serving $pmtilesPath');
    } catch (e) {
      debugPrint('Error starting local tile server: $e');
      rethrow;
    }
  }

  int get port => _server?.port ?? 0;

  Future<void> stop() async {
    try {
      await _server?.close(force: true);
      await _archive?.close();
    } catch (e) {
      debugPrint('Error stopping local tile server: $e');
    }
  }
}
