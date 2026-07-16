import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../models/trip_plan_model.dart';
import '../../state/app_controller.dart';
import '../micro/via_panel.dart';
import '../micro/via_timeline.dart';
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
      onClose: () => ctrl.setPanel(AppPanel.none),
      actions: [
        IconButton(
          tooltip: 'Compartir',
          onPressed: state.origin != null && state.destination != null
              ? () => ctrl.shareCurrentTrip()
              : null,
          icon: const Icon(Icons.ios_share_rounded, color: ViaColors.textSecondary),
        ),
        IconButton(
          tooltip: 'Reportar',
          onPressed: () {
            showDialog(context: context, builder: (_) => const ReportRouteDialog());
          },
          icon: const Icon(Icons.flag_outlined, color: ViaColors.textSecondary),
        ),
      ],
      child: Column(
        children: [
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
                  selectedColor: ViaColors.violet,
                  onTap: () => ctrl.setPlanFilter(PlanFilter.transfer),
                ),
                const SizedBox(width: 10),
                ViaChip(
                  label: 'Tiempo',
                  selected: state.planSort == PlanSort.time,
                  onTap: () => ctrl.setPlanSort(PlanSort.time),
                ),
                const SizedBox(width: 6),
                ViaChip(
                  label: 'Menos caminar',
                  selected: state.planSort == PlanSort.walk,
                  onTap: () => ctrl.setPlanSort(PlanSort.walk),
                ),
                const SizedBox(width: 6),
                ViaChip(
                  label: 'Menos transbordos',
                  selected: state.planSort == PlanSort.transfers,
                  onTap: () => ctrl.setPlanSort(PlanSort.transfers),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          if (state.planning)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  LinearProgressIndicator(
                    value: state.planningProgress.clamp(0.05, 1),
                    color: ViaColors.mint,
                    backgroundColor: ViaColors.paperTint,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Calculando rutas… ${(state.planningProgress * 100).round()}%',
                    style: const TextStyle(color: ViaColors.textSecondary),
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
  final String? trackingLabel;
  final VoidCallback onSelect;
  final VoidCallback onTrack;
  final VoidCallback onStopTrack;

  const _PlanCard({
    required this.plan,
    required this.selected,
    required this.tracking,
    this.trackingLabel,
    required this.onSelect,
    required this.onTrack,
    required this.onStopTrack,
  });

  @override
  Widget build(BuildContext context) {
    final isTransfer = plan.type == TripPlanType.transfer;
    final rides = plan.segments.where((s) => s.routeName != null).map((s) => s.routeName!).toSet();

    return AnimatedContainer(
      duration: ViaMotion.quick,
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: selected ? ViaColors.mintSoft : ViaColors.paperTint,
        borderRadius: BorderRadius.circular(ViaRadii.md),
        border: Border.all(
          color: selected ? ViaColors.mint.withValues(alpha: 0.55) : ViaColors.hairline,
          width: selected ? 1.4 : 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(ViaRadii.md),
          onTap: onSelect,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: (isTransfer ? ViaColors.violet : ViaColors.mint).withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        isTransfer ? 'Transbordo' : 'Directa',
                        style: TextStyle(
                          color: isTransfer ? ViaColors.violet : ViaColors.mint,
                          fontWeight: FontWeight.w800,
                          fontSize: 11,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '~${plan.totalDurationMinutes} min',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  rides.isEmpty ? 'Solo caminata' : rides.join(' · '),
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                ),
                const SizedBox(height: 4),
                Text(
                  'Caminata ~${plan.walkDistanceTotal.round()} m',
                  style: const TextStyle(color: ViaColors.textMuted, fontSize: 12),
                ),
                if (trackingLabel != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    trackingLabel!,
                    style: const TextStyle(
                      color: ViaColors.coral,
                      fontWeight: FontWeight.w800,
                      fontSize: 12.5,
                    ),
                  ),
                ],
                if (selected) ...[
                  const SizedBox(height: 12),
                  ViaTripTimeline(plan: plan),
                  const SizedBox(height: 10),
                  FilledButton.icon(
                    onPressed: tracking ? onStopTrack : onTrack,
                    icon: Icon(tracking ? Icons.stop_rounded : Icons.navigation_rounded, size: 18),
                    label: Text(tracking ? 'Detener seguimiento' : 'Seguir mi viaje'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
