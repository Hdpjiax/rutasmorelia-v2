import '../core/constants/local_places.dart';
import '../models/place_model.dart';
import 'api_client.dart';

class PlaceSearchService {
  PlaceSearchService({ApiClient? api}) : _api = api ?? ApiClient();
  final ApiClient _api;

  Future<List<PlaceModel>> search(
    String query, {
    bool online = true,
    int limit = 16,
    List<PlaceModel> favorites = const [],
  }) async {
    final q = query.trim();
    if (q.isEmpty) {
      return _dedupe([...favorites.take(4), ...localCatalog.take(12)]).take(limit).toList();
    }

    final local = searchLocalPlaces(q, limit: limit);
    final merged = <PlaceModel>[..._matchFavorites(q, favorites), ...local];

    if (online && q.length >= 2) {
      try {
        final remote = await _api.geocode(q);
        merged.addAll(remote);
      } on ApiException {
        rethrow;
      } catch (_) {}
    }

    return _rankAndDedupe(q, merged).take(limit).toList();
  }

  List<PlaceModel> _matchFavorites(String q, List<PlaceModel> favorites) {
    final nq = q.toLowerCase();
    return favorites
        .where((f) => f.name.toLowerCase().contains(nq))
        .map((f) => f.copyWith(isFavorite: true, source: PlaceSource.favorite))
        .toList();
  }

  List<PlaceModel> _rankAndDedupe(String query, List<PlaceModel> items) {
    final q = query.toLowerCase();
    final scored = items.map((p) {
      var score = 0.0;
      final name = p.name.toLowerCase();
      if (name == q) {
        score += 500;
      } else if (name.startsWith(q)) {
        score += 320;
      } else if (name.contains(q)) {
        score += 160;
      }
      if (p.isFavorite || p.source == PlaceSource.favorite) score += 40;
      if (p.source == PlaceSource.catalog) score += 12;
      if (p.source == PlaceSource.geocode) score += 8;
      return MapEntry(p, score);
    }).where((e) => e.value > 8).toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return _dedupe(scored.map((e) => e.key).toList());
  }

  List<PlaceModel> _dedupe(List<PlaceModel> items) {
    final seen = <String>{};
    final out = <PlaceModel>[];
    for (final p in items) {
      final key =
          '${p.name.toLowerCase()}|${p.coordinates.latitude.toStringAsFixed(4)}|${p.coordinates.longitude.toStringAsFixed(4)}';
      if (seen.add(key)) out.add(p);
    }
    return out;
  }
}
