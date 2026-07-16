import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../state/app_controller.dart';
import '../micro/via_panel.dart';
import 'report_route_dialog.dart';

class SelectedRouteCard extends ConsumerWidget {
  const SelectedRouteCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appControllerProvider);
    final route = state.selectedRoute;
    if (route == null) return const SizedBox.shrink();
    final ctrl = ref.read(appControllerProvider.notifier);
    final fav = state.favoriteRouteIds.contains(route.id);

    return ViaPanel(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 12,
                height: 32,
                decoration: BoxDecoration(
                  color: route.color,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: Colors.black26),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(route.name, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
                    Text(
                      '${route.display.terminalIda} ↔ ${route.display.terminalVuelta}',
                      style: const TextStyle(color: ViaColors.textMuted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => ctrl.clearSelectedRoute(),
                icon: const Icon(Icons.close_rounded, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              ViaChip(
                label: 'Ambos',
                selected: state.routeDirection == RouteDirectionFilter.both,
                onTap: () => ctrl.setRouteDirection(RouteDirectionFilter.both),
              ),
              ViaChip(
                label: 'Ida',
                selected: state.routeDirection == RouteDirectionFilter.ida,
                onTap: () => ctrl.setRouteDirection(RouteDirectionFilter.ida),
              ),
              ViaChip(
                label: 'Vuelta',
                selected: state.routeDirection == RouteDirectionFilter.vuelta,
                onTap: () => ctrl.setRouteDirection(RouteDirectionFilter.vuelta),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              IconButton(
                tooltip: 'Favorito',
                onPressed: () => ctrl.toggleFavoriteRoute(route.id),
                icon: Icon(
                  fav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: fav ? ViaColors.coral : ViaColors.textMuted,
                ),
              ),
              IconButton(
                tooltip: 'Compartir',
                onPressed: () => ctrl.shareCurrentTrip(),
                icon: const Icon(Icons.ios_share_rounded, color: ViaColors.inkSoft),
              ),
              IconButton(
                tooltip: 'Reportar',
                onPressed: () {
                  showDialog(context: context, builder: (_) => const ReportRouteDialog());
                },
                icon: const Icon(Icons.flag_outlined, color: ViaColors.inkSoft),
              ),
            ],
          ),
          const Text(
            'Puntos de la ruta son corredores, no paradas oficiales.',
            style: TextStyle(color: ViaColors.textMuted, fontSize: 11.5, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
