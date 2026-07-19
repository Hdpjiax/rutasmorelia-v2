import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../models/segment_model.dart';
import '../../models/trip_plan_model.dart';
import '../../state/app_controller.dart';
import '../micro/via_panel.dart';
import 'report_route_dialog.dart';

class TripPanel extends ConsumerWidget {
  const TripPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appControllerProvider);
    final ctrl = ref.read(appControllerProvider.notifier);
    final plans = state.filteredPlans;

    return ViaSheetScaffold(
      title: 'Opciones de viaje',
      subtitle: state.origin != null && state.destination != null
          ? '${state.origin!.name} → ${state.destination!.name}'
          : 'Elige origen y destino',
      maxHeightFactor: 0.42,
      onClose: () => ctrl.setPanel(AppPanel.none),
      actions: [
        IconButton(
          tooltip: 'Compartir',
          onPressed: state.origin != null && state.destination != null
              ? () => ctrl.shareCurrentTrip()
              : null,
          icon: const Icon(Icons.ios_share_rounded,
              color: ViaColors.textSecondary),
        ),
        IconButton(
          tooltip: 'Reportar',
          onPressed: () {
            showDialog(
                context: context, builder: (_) => const ReportRouteDialog());
          },
          icon: const Icon(Icons.flag_outlined,
              color: ViaColors.textSecondary),
        ),
      ],
      child: Column(
        children: [
          // Filter & sort chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                ViaChip(
                  label: 'Todas',
                  selected: state.planFilter == PlanFilter.all,
                  onTap: () => ctrl.setPlanFilter(PlanFilter.all),
                ),
                const SizedBox(width: 6),
                ViaChip(
                  label: 'Directas',
                  selected: state.planFilter == PlanFilter.direct,
                  icon: Icons.trending_flat_rounded,
                  onTap: () => ctrl.setPlanFilter(PlanFilter.direct),
                ),
                const SizedBox(width: 6),
                ViaChip(
                  label: 'Transbordo',
                  selected: state.planFilter == PlanFilter.transfer,
                  icon: Icons.transfer_within_a_station_rounded,
                  selectedColor: ViaColors.secondary,
                  onTap: () => ctrl.setPlanFilter(PlanFilter.transfer),
                ),
                const SizedBox(width: 10),
                Container(
                    width: 1, height: 20, color: ViaColors.hairline),
                const SizedBox(width: 10),
                ViaChip(
                  label: 'Tiempo',
                  selected: state.planSort == PlanSort.time,
                  onTap: () => ctrl.setPlanSort(PlanSort.time),
                ),
                const SizedBox(width: 6),
                ViaChip(
                  label: 'Caminata',
                  selected: state.planSort == PlanSort.walk,
                  onTap: () => ctrl.setPlanSort(PlanSort.walk),
                ),
                const SizedBox(width: 6),
                ViaChip(
                  label: 'Transbordos',
                  selected: state.planSort == PlanSort.transfers,
                  onTap: () => ctrl.setPlanSort(PlanSort.transfers),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Loading or empty or list
          if (state.planning)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: state.planningProgress.clamp(0.05, 1),
                      minHeight: 6,
                      color: ViaColors.primary,
                      backgroundColor: ViaColors.paperTint,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Calculando rutas… ${(state.planningProgress * 100).round()}%',
                    style: const TextStyle(
                      color: ViaColors.textSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            )
          else if (plans.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                state.origin == null || state.destination == null
                    ? 'Define origen y destino para ver opciones.'
                    : 'No hay opciones con la caminata máxima. Prueba otros puntos.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: ViaColors.textSecondary),
              ),
            )
          else
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                itemCount: plans.length,
                itemBuilder: (context, i) {
                  final plan = plans[i];
                  final globalIndex = state.plans.indexOf(plan);
                  final selected = globalIndex == state.selectedPlanIndex;
                  return _PlanCard(
                    plan: plan,
                    selected: selected,
                    index: i,
                    tracking: selected && state.tracking,
                    trackingLabel: selected && state.tracking
                        ? _segLabel(state.trackingSegment)
                        : null,
                    onSelect: () => ctrl.selectPlan(globalIndex),
                    onTrack: () {
                      ctrl.selectPlan(globalIndex);
                      ctrl.startTracking();
                    },
                    onStopTrack: ctrl.stopTracking,
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  String _segLabel(TrackingSegment s) {
    switch (s) {
      case TrackingSegment.walkToBoard:
        return 'Camina al punto de subida';
      case TrackingSegment.ride:
        return 'En ruta · espera bajada';
      case TrackingSegment.walkToDest:
        return 'Baja y camina al destino';
      case TrackingSegment.done:
        return 'Llegaste';
    }
  }
}

class _PlanCard extends StatelessWidget {
  final TripPlanModel plan;
  final bool selected;
  final bool tracking;
  final int index;
  final String? trackingLabel;
  final VoidCallback onSelect;
  final VoidCallback onTrack;
  final VoidCallback onStopTrack;

  const _PlanCard({
    required this.plan,
    required this.selected,
    required this.tracking,
    required this.index,
    this.trackingLabel,
    required this.onSelect,
    required this.onTrack,
    required this.onStopTrack,
  });

  @override
  Widget build(BuildContext context) {
    final isTransfer = plan.type == TripPlanType.transfer;
    final gradientColors = isTransfer
        ? const [ViaColors.primary, ViaColors.secondary]
        : const [ViaColors.emerald, ViaColors.primary];

    // Unique route chips preserving order
    final routeNames = <String, Color>{};
    for (final s in plan.segments) {
      if (s.type == SegmentType.ride &&
          s.routeName != null &&
          !routeNames.containsKey(s.routeName)) {
        routeNames[s.routeName!] = s.color ?? ViaColors.primary;
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(ViaRadii.card),
        border: Border.all(
          color: selected
              ? ViaColors.primary.withValues(alpha: 0.4)
              : ViaColors.hairline.withValues(alpha: 0.5),
        ),
        color: selected
            ? ViaColors.mintSoft.withValues(alpha: 0.5)
            : ViaColors.paperElevated.withValues(alpha: 0.92),
        boxShadow: selected
            ? [
                BoxShadow(
                  color: ViaColors.primary.withValues(alpha: 0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(ViaRadii.card),
          onTap: onSelect,
          child: Stack(
            children: [
              // Top gradient accent bar
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: gradientColors,
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                    ),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(ViaRadii.card - 1),
                      topRight: Radius.circular(ViaRadii.card - 1),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Route chips (always visible)
                    if (routeNames.isNotEmpty) ...[
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: routeNames.entries.map((e) {
                          return _RouteChip(
                            label: e.key,
                            color: e.value,
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Time and Cost below the route chips
                    Row(
                      children: [
                        // Time Badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: ViaColors.esmeraldaSoft,
                            borderRadius: BorderRadius.circular(ViaRadii.sm),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.access_time_filled_rounded,
                                size: 12,
                                color: ViaColors.esmeralda,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '${plan.totalDurationMinutes} min',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: ViaColors.esmeralda,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Cost Badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: ViaColors.doradoSoft,
                            borderRadius: BorderRadius.circular(ViaRadii.sm),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.payments_rounded,
                                size: 12,
                                color: ViaColors.amberDark,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                plan.totalFareFormatted ?? '\$9.00',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: ViaColors.amberDark,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(
                          Icons.info_outline_rounded,
                          size: 13,
                          color: ViaColors.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            plan.fareDetail,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: ViaColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),

                    // Tracking label & action button when selected
                    if (selected) ...[
                      if (trackingLabel != null) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: ViaColors.coralSoft,
                            borderRadius: BorderRadius.circular(ViaRadii.sm),
                            border: Border.all(
                              color: ViaColors.coral.withValues(alpha: 0.25),
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: const BoxDecoration(
                                  color: ViaColors.coral,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  trackingLabel!,
                                  style: const TextStyle(
                                    color: ViaColors.coral,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        height: 38,
                        child: FilledButton.icon(
                          onPressed: tracking ? onStopTrack : onTrack,
                          icon: Icon(
                            tracking
                                ? Icons.stop_rounded
                                : Icons.navigation_rounded,
                            size: 16,
                          ),
                          label: Text(
                            tracking ? 'Detener seguimiento' : 'Seguir mi viaje',
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: tracking ? ViaColors.coral : ViaColors.primary,
                            padding: EdgeInsets.zero,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(ViaRadii.sm),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(
          duration: 280.ms,
          delay: (40 * index).ms,
          curve: Curves.easeOutCubic,
        ).slideY(
          begin: 0.08,
          end: 0,
          duration: 320.ms,
          delay: (40 * index).ms,
          curve: Curves.easeOutCubic,
        );
  }
}

class _RouteChip extends StatelessWidget {
  final String label;
  final Color color;

  const _RouteChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(ViaRadii.pill),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.35),
                  blurRadius: 3,
                ),
              ],
            ),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 11.5,
            ),
          ),
        ],
      ),
    );
  }
}
