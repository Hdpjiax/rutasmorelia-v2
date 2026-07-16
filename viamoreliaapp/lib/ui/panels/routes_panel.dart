import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../state/app_controller.dart';
import '../micro/via_panel.dart';

class RoutesPanel extends ConsumerWidget {
  const RoutesPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appControllerProvider);
    final ctrl = ref.read(appControllerProvider.notifier);
    final routes = ctrl.filteredCatalog;

    return ViaSheetScaffold(
      title: 'Rutas publicadas',
      subtitle: '${routes.length} corredores · ida y vuelta',
      onClose: () => ctrl.setPanel(AppPanel.none),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: TextField(
              onChanged: ctrl.setRouteQuery,
              decoration: const InputDecoration(
                hintText: 'Buscar ruta (amarilla, naranja…)',
                prefixIcon: Icon(Icons.search_rounded, size: 20),
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                ViaChip(
                  label: 'Todas',
                  selected: state.transportFilter == 'all' && !state.onlyFavoriteRoutes,
                  onTap: () {
                    ctrl.setOnlyFavoriteRoutes(false);
                    ctrl.setTransportFilter('all');
                  },
                ),
                const SizedBox(width: 6),
                ViaChip(
                  label: 'Combi',
                  selected: state.transportFilter == 'combi',
                  onTap: () => ctrl.setTransportFilter('combi'),
                ),
                const SizedBox(width: 6),
                ViaChip(
                  label: 'Autobús',
                  selected: state.transportFilter == 'autobus',
                  onTap: () => ctrl.setTransportFilter('autobus'),
                ),
                const SizedBox(width: 6),
                ViaChip(
                  label: 'Favoritas',
                  selected: state.onlyFavoriteRoutes,
                  icon: Icons.favorite_rounded,
                  selectedColor: ViaColors.coral,
                  onTap: () => ctrl.setOnlyFavoriteRoutes(!state.onlyFavoriteRoutes),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
              itemCount: routes.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final r = routes[i];
                final fav = state.favoriteRouteIds.contains(r.id);
                final selected = state.selectedRoute?.id == r.id;
                return Material(
                  color: selected ? ViaColors.mintSoft : ViaColors.paperTint,
                  borderRadius: BorderRadius.circular(ViaRadii.md),
                  child: ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(ViaRadii.md),
                      side: BorderSide(
                        color: selected ? ViaColors.mint.withValues(alpha: 0.5) : ViaColors.hairline,
                      ),
                    ),
                    leading: Container(
                      width: 14,
                      height: 36,
                      decoration: BoxDecoration(
                        color: r.color,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: Colors.black26),
                      ),
                    ),
                    title: Text(r.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    subtitle: Text(
                      '${r.display.corridorLabel} · ${r.transportType ?? 'ruta'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: ViaColors.textMuted, fontSize: 12),
                    ),
                    trailing: IconButton(
                      icon: Icon(
                        fav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        color: fav ? ViaColors.coral : ViaColors.textMuted,
                      ),
                      onPressed: () => ctrl.toggleFavoriteRoute(r.id),
                    ),
                    onTap: () => ctrl.selectRoute(r),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
