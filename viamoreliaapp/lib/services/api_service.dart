import '../models/route_model.dart';
import 'shape_index_service.dart';

/// Compat thin wrapper — prefer ShapeIndexService.
class ApiService {
  final ShapeIndexService _index = ShapeIndexService();

  Future<List<RouteMetaModel>> getRouteMetaCatalog() async {
    if (!_index.isReady) await _index.initialize();
    return _index.catalog;
  }

  Future<String?> getRouteGeojson(String routeId, String? customFilename) async {
    if (!_index.isReady) await _index.initialize();
    // Shapes already parsed in index; callers should use ShapeIndexService.
    return null;
  }
}
