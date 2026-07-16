import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../gis/route_display.dart';

class RouteMetaModel {
  final String id;
  final String name;
  final Color color;
  final String? transportType;
  final String? geojsonFile;
  final String? casingColor;
  final String? qaStatus;
  final String? colorName;
  final String? colorLetter;

  RouteMetaModel({
    required this.id,
    required this.name,
    required this.color,
    this.transportType,
    this.geojsonFile,
    this.casingColor,
    this.qaStatus,
    this.colorName,
    this.colorLetter,
  });

  bool get isPublished {
    final s = (qaStatus ?? 'approved').toLowerCase();
    return s == 'approved' || s == 'published' || s.isEmpty;
  }

  RouteDisplayInfo get display => RouteDisplay.parse(
        id: id,
        name: name,
        transportType: transportType,
      );

  factory RouteMetaModel.fromJson(Map<String, dynamic> json) {
    final hexColor = json['color'] as String? ?? '#3b82f6';
    return RouteMetaModel(
      id: json['id'] as String,
      name: json['name'] as String,
      color: _parseHexColor(hexColor),
      transportType: json['transportType'] as String? ?? json['transport_type'] as String?,
      geojsonFile: json['geojsonFile'] as String? ?? json['geojson_file'] as String?,
      casingColor: json['casingColor'] as String? ?? json['casing_color'] as String?,
      qaStatus: json['qaStatus'] as String? ?? json['qa_status'] as String?,
      colorName: json['colorName'] as String?,
      colorLetter: json['colorLetter'] as String?,
    );
  }

  static Color _parseHexColor(String hex) {
    var hexStr = hex.replaceAll('#', '');
    if (hexStr.length == 6) hexStr = 'FF$hexStr';
    return Color(int.parse(hexStr, radix: 16));
  }
}

class RouteShapeModel {
  final String id;
  final String routeId;
  final String routeName;
  final Color color;
  final String direction; // ida | vuelta | corridor
  final List<LatLng> coordinates;
  final String? directionMode; // mirrored | independent | dualRing
  final String? role; // full | segment | sense-label
  final Color? casingColor;

  RouteShapeModel({
    required this.id,
    required this.routeId,
    required this.routeName,
    required this.color,
    required this.direction,
    required this.coordinates,
    this.directionMode,
    this.role,
    this.casingColor,
  });

  RouteShapeModel copyWith({
    String? id,
    String? routeId,
    String? routeName,
    Color? color,
    String? direction,
    List<LatLng>? coordinates,
    String? directionMode,
    String? role,
    Color? casingColor,
  }) {
    return RouteShapeModel(
      id: id ?? this.id,
      routeId: routeId ?? this.routeId,
      routeName: routeName ?? this.routeName,
      color: color ?? this.color,
      direction: direction ?? this.direction,
      coordinates: coordinates ?? this.coordinates,
      directionMode: directionMode ?? this.directionMode,
      role: role ?? this.role,
      casingColor: casingColor ?? this.casingColor,
    );
  }
}
