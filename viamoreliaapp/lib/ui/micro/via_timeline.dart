import 'package:flutter/material.dart';
import '../../core/theme/via_theme.dart';
import '../../models/segment_model.dart';
import '../../models/trip_plan_model.dart';
import 'via_panel.dart';

class ViaTripTimeline extends StatelessWidget {
  final TripPlanModel plan;

  const ViaTripTimeline({super.key, required this.plan});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < plan.segments.length; i++) ...[
          _StepRow(segment: plan.segments[i], isLast: i == plan.segments.length - 1),
        ],
        const SizedBox(height: 8),
        const ViaSuggestedStopBanner(),
      ],
    );
  }
}

class _StepRow extends StatelessWidget {
  final TravelSegmentModel segment;
  final bool isLast;

  const _StepRow({required this.segment, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final isWalk = segment.type == SegmentType.walk;
    final color = isWalk ? _walkColor(segment.walkKind) : (segment.color ?? ViaColors.mint);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 28,
            child: Column(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                    border: Border.all(color: color, width: 2),
                  ),
                  child: Icon(
                    isWalk ? Icons.directions_walk_rounded : Icons.directions_bus_filled_rounded,
                    size: 12,
                    color: color,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: ViaColors.hairline,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    segment.instruction,
                    style: const TextStyle(
                      color: ViaColors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 13.5,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _meta(segment),
                    style: const TextStyle(
                      color: ViaColors.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (isWalk) ...[
                    const SizedBox(height: 2),
                    Text(
                      _walkHint(segment.walkKind),
                      style: TextStyle(
                        color: color,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _walkColor(WalkKind? kind) {
    switch (kind) {
      case WalkKind.toBoard:
        return ViaColors.walkToBoard;
      case WalkKind.fromAlight:
        return ViaColors.walkFromAlight;
      case WalkKind.transfer:
        return ViaColors.walkTransfer;
      case null:
        return ViaColors.textSecondary;
    }
  }

  String _walkHint(WalkKind? kind) {
    switch (kind) {
      case WalkKind.toBoard:
        return 'Caminata a punto de subida sugerido';
      case WalkKind.fromAlight:
        return 'Caminata desde bajada sugerida al destino';
      case WalkKind.transfer:
        return 'Caminata de transbordo (punto sugerido)';
      case null:
        return 'Tramo a pie';
    }
  }

  String _meta(TravelSegmentModel s) {
    final dist = s.distance < 1000
        ? '${s.distance.round()} m'
        : '${(s.distance / 1000).toStringAsFixed(1)} km';
    final mins = (s.duration / 60).round().clamp(1, 999);
    final dir = s.direction == null
        ? ''
        : ' · ${s.direction == 'ida' ? 'Ida' : 'Vuelta'}';
    return '$dist · ~$mins min$dir';
  }
}
