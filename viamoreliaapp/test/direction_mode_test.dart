import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:viamoreliaapp/gis/direction_mode.dart';
import 'package:viamoreliaapp/models/route_model.dart';
import 'package:flutter/material.dart';

void main() {
  test('reverseCoordinates flips order', () {
    final a = [const LatLng(1, 1), const LatLng(2, 2), const LatLng(3, 3)];
    final r = DirectionModeService.reverseCoordinates(a);
    expect(r.first.latitude, 3);
    expect(r.last.latitude, 1);
  });

  test('mirrored detection when vuelta ~ reverse(ida)', () {
    final ida = [
      const LatLng(19.70, -101.20),
      const LatLng(19.71, -101.19),
      const LatLng(19.72, -101.18),
    ];
    final vuelta = DirectionModeService.reverseCoordinates(ida);
    final mode = DirectionModeService.detectMode(ida, vuelta);
    expect(mode, DirectionMode.mirrored);
  });

  test('toCorridorDisplay dual independent keeps both', () {
    final shapes = [
      RouteShapeModel(
        id: 'r-ida',
        routeId: 'r',
        routeName: 'R',
        color: Colors.red,
        direction: 'ida',
        coordinates: const [LatLng(19.70, -101.20), LatLng(19.71, -101.19)],
        directionMode: 'independent',
      ),
      RouteShapeModel(
        id: 'r-vuelta',
        routeId: 'r',
        routeName: 'R',
        color: Colors.red,
        direction: 'vuelta',
        coordinates: const [LatLng(19.70, -101.21), LatLng(19.71, -101.20)],
        directionMode: 'independent',
      ),
    ];
    final out = DirectionModeService.toCorridorDisplay(shapes);
    expect(out.length, 2);
  });
}
