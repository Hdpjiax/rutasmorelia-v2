import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../models/place_model.dart';
import '../../state/app_controller.dart';
import '../micro/via_panel.dart';

class FavoritesPanel extends ConsumerWidget {
  const FavoritesPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(appControllerProvider);
    final ctrl = ref.read(appControllerProvider.notifier);

    return ViaSheetScaffold(
      title: 'Favoritos',
      subtitle: 'Guardados en este dispositivo',
      onClose: () => ctrl.setPanel(AppPanel.none),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
        children: [
          _slot(
            context,
            icon: Icons.home_rounded,
            title: 'Casa',
            place: state.home,
            color: ViaColors.mint,
            onUseAsDest: state.home == null ? null : () => ctrl.setDestination(state.home!),
            onSetFromOrigin: state.origin == null
                ? null
                : () => ctrl.setHome(state.origin!.copyWith(source: PlaceSource.favorite)),
          ),
          const SizedBox(height: 8),
          _slot(
            context,
            icon: Icons.work_rounded,
            title: 'Trabajo',
            place: state.work,
            color: ViaColors.violet,
            onUseAsDest: state.work == null ? null : () => ctrl.setDestination(state.work!),
            onSetFromOrigin: state.origin == null
                ? null
                : () => ctrl.setWork(state.origin!.copyWith(source: PlaceSource.favorite)),
          ),
          const SizedBox(height: 16),
          const Text('Lugares', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 8),
          if (state.favoritePlaces.isEmpty)
            const Text(
              'Marca corazones en resultados de búsqueda para guardarlos aquí.',
              style: TextStyle(color: ViaColors.textMuted, fontSize: 13),
            )
          else
            ...state.favoritePlaces.map((p) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.favorite_rounded, color: ViaColors.coral),
                  title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(p.description ?? p.category,
                      style: const TextStyle(color: ViaColors.textMuted, fontSize: 12)),
                  trailing: IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18),
                    onPressed: () => ctrl.toggleFavoritePlace(p),
                  ),
                  onTap: () => ctrl.setDestination(p),
                )),
          const SizedBox(height: 16),
          const Text('Recientes', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 8),
          if (state.recentPlaces.isEmpty)
            const Text('Aún no hay búsquedas recientes.',
                style: TextStyle(color: ViaColors.textMuted, fontSize: 13))
          else
            ...state.recentPlaces.map((p) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.history_rounded, color: ViaColors.textSecondary),
                  title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                  onTap: () => ctrl.setDestination(p),
                  trailing: IconButton(
                    icon: Icon(
                      state.favoritePlaces.any((f) => f.name == p.name)
                          ? Icons.favorite_rounded
                          : Icons.favorite_border_rounded,
                      color: ViaColors.coral,
                      size: 20,
                    ),
                    onPressed: () => ctrl.toggleFavoritePlace(p),
                  ),
                )),
          const SizedBox(height: 16),
          const Text('Rutas favoritas', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 8),
          if (state.favoriteRouteIds.isEmpty)
            const Text('Guarda rutas desde el explorador.',
                style: TextStyle(color: ViaColors.textMuted, fontSize: 13))
          else
            ...state.favoriteRouteIds.map((id) {
              final matches = ctrl.catalog.where((r) => r.id == id).toList();
              final name = matches.isEmpty ? id : matches.first.name;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.alt_route_rounded, color: ViaColors.mint),
                title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700)),
                onTap: matches.isEmpty ? null : () => ctrl.selectRoute(matches.first),
              );
            }),
        ],
      ),
    );
  }

  Widget _slot(
    BuildContext context, {
    required IconData icon,
    required String title,
    required PlaceModel? place,
    required Color color,
    VoidCallback? onUseAsDest,
    VoidCallback? onSetFromOrigin,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ViaColors.paperTint,
        borderRadius: BorderRadius.circular(ViaRadii.md),
        border: Border.all(color: ViaColors.hairline),
      ),
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                Text(
                  place?.name ?? 'Sin definir — usa origen actual',
                  style: const TextStyle(color: ViaColors.textMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          if (onSetFromOrigin != null)
            TextButton(onPressed: onSetFromOrigin, child: const Text('Fijar')),
          if (onUseAsDest != null)
            TextButton(onPressed: onUseAsDest, child: const Text('Ir')),
        ],
      ),
    );
  }
}
