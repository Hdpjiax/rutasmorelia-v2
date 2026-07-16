import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

enum SegmentType { walk, ride }
enum WalkKind { toBoard, fromAlight, transfer }

class TravelSegmentModel {
  final SegmentType type;
  final String instruction;
  final double distance; // meters
  final double duration; // seconds
  final String? routeId;
  final String? routeName;
  final Color? color;
  final String? direction; // 'ida' | 'vuelta'
  final LatLng? boardingPoint;
  final LatLng? alightingPoint;
  final LatLng? walkFrom;
  final LatLng? walkTo;
  final WalkKind? walkKind;
  final List<LatLng>? walkPath;

  TravelSegmentModel({
    required this.type,
    required this.instruction,
    required this.distance,
    required this.duration,
    this.routeId,
    this.routeName,
    this.color,
    this.direction,
    this.boardingPoint,
    this.alightingPoint,
    this.walkFrom,
    this.walkTo,
    this.walkKind,
    this.walkPath,
  });
}
