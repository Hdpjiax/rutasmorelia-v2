import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import '../core/constants/geo_constants.dart';

class LocationResult {
  final LatLng coordinates;
  final bool fromDevice;
  final String? errorMessage;

  const LocationResult({
    required this.coordinates,
    required this.fromDevice,
    this.errorMessage,
  });
}

class LocationService {
  Future<bool> isServiceEnabled() => Geolocator.isLocationServiceEnabled();

  Future<LocationPermission> checkPermission() => Geolocator.checkPermission();

  Future<LocationPermission> requestPermission() => Geolocator.requestPermission();

  /// Solicita permiso y obtiene posición real (o error tipado).
  Future<LocationResult> getCurrentLocation({
    Duration timeout = const Duration(seconds: 12),
  }) async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return const LocationResult(
          coordinates: GeoConstants.moreliaCenter,
          fromDevice: false,
          errorMessage: 'Activa el GPS del teléfono para usar tu ubicación.',
        );
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        return const LocationResult(
          coordinates: GeoConstants.moreliaCenter,
          fromDevice: false,
          errorMessage: 'Permiso de ubicación denegado.',
        );
      }

      if (permission == LocationPermission.deniedForever) {
        return const LocationResult(
          coordinates: GeoConstants.moreliaCenter,
          fromDevice: false,
          errorMessage: 'Ubicación bloqueada. Actívala en Ajustes del sistema.',
        );
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: timeout,
        ),
      );

      final coords = LatLng(position.latitude, position.longitude);
      return LocationResult(coordinates: coords, fromDevice: true);
    } catch (e) {
      return LocationResult(
        coordinates: GeoConstants.moreliaCenter,
        fromDevice: false,
        errorMessage: 'No se pudo obtener GPS: $e',
      );
    }
  }

  Stream<LatLng> getPositionStream({int distanceFilter = 8}) {
    return Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilter,
      ),
    ).map((p) => LatLng(p.latitude, p.longitude));
  }

  Future<void> openLocationSettings() => Geolocator.openLocationSettings();
  Future<void> openAppSettings() => Geolocator.openAppSettings();
}
