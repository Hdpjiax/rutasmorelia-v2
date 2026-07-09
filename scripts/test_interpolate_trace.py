from strict_map_match_valhalla_osrm import (
    gap_distance_m,
    max_gap_in_line,
    valhalla_trace_segment,
)

a = (-101.0322713941072, 19.6887614637031)
b = (-101.0282787850753, 19.69549829011316)

for step in (30, 50, 80, 100):
    dist = gap_distance_m(a, b)
    n = max(2, int(dist / step))
    pts = [a]
    for i in range(1, n):
        t = i / n
        pts.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
    pts.append(b)
    for radius in (80, 120, 180, 250):
        try:
            seg = valhalla_trace_segment(pts, radius)
            print(f"step={step} n={len(pts)} r={radius} -> pts={len(seg)} max_gap={max_gap_in_line(seg):.1f}")
        except Exception as e:
            print(f"step={step} r={radius} err {e}")