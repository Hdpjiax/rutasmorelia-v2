import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/place_model.dart';

class FavoritesStore {
  static const _kLocations = 'vm_favorite_locations_v1';
  static const _kRoutes = 'vm_favorite_routes_v1';
  static const _kRecentPlaces = 'vm_recent_places_v1';
  static const _kHome = 'vm_home_place_v1';
  static const _kWork = 'vm_work_place_v1';
  static const _kWelcome = 'vm_welcome_seen_v1';
  static const _kOnboarding = 'seen_onboarding';
  static const _kLastTrip = 'vm_last_trip_v1';

  Future<SharedPreferences> get _prefs => SharedPreferences.getInstance();

  Future<bool> getWelcomeSeen() async => (await _prefs).getBool(_kWelcome) ?? false;
  Future<void> setWelcomeSeen(bool v) async => (await _prefs).setBool(_kWelcome, v);

  Future<bool> getOnboardingSeen() async => (await _prefs).getBool(_kOnboarding) ?? false;
  Future<void> setOnboardingSeen(bool v) async => (await _prefs).setBool(_kOnboarding, v);

  Future<List<PlaceModel>> getFavoriteLocations() async {
    final raw = (await _prefs).getString(_kLocations);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list.map((e) => PlaceModel.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveFavoriteLocations(List<PlaceModel> places) async {
    final raw = jsonEncode(places.map((p) => p.toJson()).toList());
    await (await _prefs).setString(_kLocations, raw);
  }

  Future<List<String>> getFavoriteRouteIds() async {
    return (await _prefs).getStringList(_kRoutes) ?? [];
  }

  Future<void> saveFavoriteRouteIds(List<String> ids) async {
    await (await _prefs).setStringList(_kRoutes, ids);
  }

  Future<List<PlaceModel>> getRecentPlaces() async {
    final raw = (await _prefs).getString(_kRecentPlaces);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list.map((e) => PlaceModel.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveRecentPlaces(List<PlaceModel> places) async {
    final raw = jsonEncode(places.take(12).map((p) => p.toJson()).toList());
    await (await _prefs).setString(_kRecentPlaces, raw);
  }

  Future<PlaceModel?> getHome() async {
    final raw = (await _prefs).getString(_kHome);
    if (raw == null) return null;
    try {
      return PlaceModel.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> setHome(PlaceModel? place) async {
    final p = await _prefs;
    if (place == null) {
      await p.remove(_kHome);
    } else {
      await p.setString(_kHome, jsonEncode(place.toJson()));
    }
  }

  Future<PlaceModel?> getWork() async {
    final raw = (await _prefs).getString(_kWork);
    if (raw == null) return null;
    try {
      return PlaceModel.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> setWork(PlaceModel? place) async {
    final p = await _prefs;
    if (place == null) {
      await p.remove(_kWork);
    } else {
      await p.setString(_kWork, jsonEncode(place.toJson()));
    }
  }

  Future<void> saveLastTrip(PlaceModel? origin, PlaceModel? destination) async {
    if (origin == null || destination == null) return;
    final payload = jsonEncode({
      'origin': origin.toJson(),
      'destination': destination.toJson(),
      'at': DateTime.now().toIso8601String(),
    });
    await (await _prefs).setString(_kLastTrip, payload);
  }

  Future<({PlaceModel origin, PlaceModel destination})?> getLastTrip() async {
    final raw = (await _prefs).getString(_kLastTrip);
    if (raw == null) return null;
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      return (
        origin: PlaceModel.fromJson(m['origin'] as Map<String, dynamic>),
        destination: PlaceModel.fromJson(m['destination'] as Map<String, dynamic>),
      );
    } catch (_) {
      return null;
    }
  }
}
