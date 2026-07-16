import 'package:latlong2/latlong.dart';

class GeoConstants {
  const GeoConstants._();

  static const LatLng moreliaCenter = LatLng(19.7026, -101.1944);
  static const double defaultZoom = 13.2;
  static const double minZoom = 11.0;
  static const double maxZoom = 18.5;

  static const double west = -101.35;
  static const double south = 19.55;
  static const double east = -101.05;
  static const double north = 19.85;

  /// Carto light retina — nítido sobre Positron-like basemap.
  static const String cartoRetina =
      'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png';
  static const String cartoFallback =
      'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png';
  static const String userAgent = 'com.viamorelia.viamoreliaapp';

  /// Producción web (APIs + estáticos).
  static const String webBase = 'https://viamorelia.org';
  static const String routesBase = 'https://rutasmorelia.vercel.app';
  static const String shareBase = 'https://viamorelia.org';

  static bool isInMorelia(LatLng p) {
    return p.longitude >= west &&
        p.longitude <= east &&
        p.latitude >= south &&
        p.latitude <= north;
  }
}
