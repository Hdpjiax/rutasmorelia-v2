from strict_map_match_valhalla_osrm import (
    bridge_points,
    gap_distance_m,
    max_gap_in_line,
    valhalla_route_waypoints,
)

a = (-101.0322713941072, 19.6887614637031)
b = (-101.0282787850753, 19.69549829011316)
print("direct gap", gap_distance_m(a, b))
for wps in ([a, b], bridge_points(a, b, None)):
    try:
        r = valhalla_route_waypoints(wps)
        print("wps", len(wps), "-> pts", len(r), "max_gap", max_gap_in_line(r))
    except Exception as e:
        print("wps", len(wps), "err", e)