import 'package:latlong2/latlong.dart';

enum PlaceSource {
  catalog,
  geocode,
  gps,
  favorite,
}

class PlaceModel {
  final String id;
  final String name;
  final String? description;
  final String category;
  final LatLng coordinates;
  final PlaceSource source;
  final bool isFavorite;

  const PlaceModel({
    required this.id,
    required this.name,
    this.description,
    required this.category,
    required this.coordinates,
    required this.source,
    this.isFavorite = false,
  });

  factory PlaceModel.fromJson(Map<String, dynamic> json) {
    final coords = json['coordinates'] as List<dynamic>;
    final sourceStr = json['source'] as String?;
    
    PlaceSource resolvedSource = PlaceSource.catalog;
    if (sourceStr == 'geocode') resolvedSource = PlaceSource.geocode;
    if (sourceStr == 'gps') resolvedSource = PlaceSource.gps;
    if (sourceStr == 'favorite') resolvedSource = PlaceSource.favorite;

    return PlaceModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      category: json['category'] as String,
      coordinates: LatLng(coords[1] as double, coords[0] as double), // [lng, lat] to LatLng(lat, lng)
      source: resolvedSource,
      isFavorite: json['isFavorite'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'category': category,
      'coordinates': [coordinates.longitude, coordinates.latitude], // [lng, lat]
      'source': source.name,
      'isFavorite': isFavorite,
    };
  }

  PlaceModel copyWith({
    String? id,
    String? name,
    String? description,
    String? category,
    LatLng? coordinates,
    PlaceSource? source,
    bool? isFavorite,
  }) {
    return PlaceModel(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      category: category ?? this.category,
      coordinates: coordinates ?? this.coordinates,
      source: source ?? this.source,
      isFavorite: isFavorite ?? this.isFavorite,
    );
  }
}
