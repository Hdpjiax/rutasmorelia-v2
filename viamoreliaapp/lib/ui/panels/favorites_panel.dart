import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/via_theme.dart';
import '../../models/place_model.dart';
import '../../models/route_model.dart';
import '../../services/transport_classify.dart';
import '../../state/app_controller.dart';
import '../micro/via_panel.dart';

class FavoritesPanel extends ConsumerStatefulWidget {
  const FavoritesPanel({super.key});

  @override
  ConsumerState<FavoritesPanel> createState() => _FavoritesPanelState();
}

class _FavoritesPanelState extends ConsumerState<FavoritesPanel> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final ctrl = ref.read(appControllerProvider.notifier);

    final favoriteRoutes = state.favoriteRouteIds.map((id) {
      final matches = ctrl.catalog.where((r) => r.id == id).toList();
      return (id: id, route: matches.isNotEmpty ? matches.first : null);
    }).toList();

    final filtered = _searchQuery.isEmpty
        ? favoriteRoutes
        : favoriteRoutes.where((fr) {
            final q = _searchQuery.toLowerCase();
            final name = fr.route?.name.toLowerCase() ?? '';
            return name.contains(q) || fr.id.toLowerCase().contains(q);
          }).toList();

    final isLoading = !state.bootstrapped;

    return ViaSheetScaffold(
      title: 'Favoritos',
      subtitle: 'Guardados en este dispositivo',
      onClose: () => ctrl.setPanel(AppPanel.none),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
        children: [
          _SearchBar(
            controller: _searchCtrl,
            onChanged: (v) => setState(() => _searchQuery = v),
          ),
          const SizedBox(height: 12),

          _slotCard(
            icon: Icons.home_rounded,
            title: 'Casa',
            place: state.home,
            color: ViaColors.primary,
            accentColor: ViaColors.emeraldLight,
            onUseAsDest: state.home == null ? null : () => ctrl.setDestination(state.home!),
            onSetFromOrigin: state.origin == null
                ? null
                : () => ctrl.setHome(state.origin!.copyWith(source: PlaceSource.favorite)),
          ),
          const SizedBox(height: 8),
          _slotCard(
            icon: Icons.work_rounded,
            title: 'Trabajo',
            place: state.work,
            color: ViaColors.secondary,
            accentColor: ViaColors.violetSoft,
            onUseAsDest: state.work == null ? null : () => ctrl.setDestination(state.work!),
            onSetFromOrigin: state.origin == null
                ? null
                : () => ctrl.setWork(state.origin!.copyWith(source: PlaceSource.favorite)),
          ),
          const SizedBox(height: 16),

          _sectionHeader('Lugares', Icons.place_rounded),
          const SizedBox(height: 8),
          if (state.favoritePlaces.isEmpty)
            _emptyState('Marca corazones en resultados de búsqueda para guardarlos aquí.')
          else
            ...state.favoritePlaces.map((p) => _placeTile(
                  context,
                  name: p.name,
                  subtitle: p.description ?? p.category,
                  trailing: IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18),
                    onPressed: () => ctrl.toggleFavoritePlace(p),
                  ),
                  onTap: () => ctrl.setDestination(p),
                )),
          const SizedBox(height: 16),

          _sectionHeader('Recientes', Icons.history_rounded),
          const SizedBox(height: 8),
          if (state.recentPlaces.isEmpty)
            _emptyState('Aún no hay búsquedas recientes.')
          else
            ...state.recentPlaces.map((p) => _placeTile(
                  context,
                  name: p.name,
                  subtitle: null,
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
                  onTap: () => ctrl.setDestination(p),
                )),
          const SizedBox(height: 16),

          _sectionHeader('Rutas favoritas', Icons.alt_route_rounded),
          const SizedBox(height: 8),
          if (isLoading)
            ...List.generate(3, (_) => const _SkeletonCard())
          else if (filtered.isEmpty)
            _EmptyFavorites(
              hasSearch: _searchQuery.isNotEmpty,
              onExplore: () => ctrl.setPanel(AppPanel.routes),
            )
          else
            ...filtered.asMap().entries.map((entry) {
              final i = entry.key;
              final fr = entry.value;
              final route = fr.route;
              return _FavoriteRouteCard(
                index: i,
                route: route,
                routeId: fr.id,
                isFavorite: state.favoriteRouteIds.contains(fr.id),
                onTap: route == null ? null : () => ctrl.selectRoute(route),
                onToggleFavorite: () => ctrl.toggleFavoriteRoute(fr.id),
              );
            }),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 16, color: ViaColors.textSecondary),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 14,
            color: ViaColors.ink,
          ),
        ),
      ],
    );
  }

  Widget _emptyState(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ViaColors.paperTint,
        borderRadius: BorderRadius.circular(ViaRadii.sm),
        border: Border.all(color: ViaColors.hairline.withValues(alpha: 0.5), style: BorderStyle.solid),
      ),
      child: Text(
        message,
        style: const TextStyle(color: ViaColors.textMuted, fontSize: 13),
      ),
    );
  }

  Widget _placeTile(
    BuildContext context, {
    required String name,
    String? subtitle,
    Widget? trailing,
    Widget? leading,
    VoidCallback? onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: ViaColors.paperElevated.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(ViaRadii.sm),
        border: Border.all(color: ViaColors.hairline.withValues(alpha: 0.6)),
      ),
      child: ListTile(
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10),
        leading: leading ??
            const Icon(Icons.favorite_rounded, color: ViaColors.coral, size: 20),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
        subtitle: subtitle == null
            ? null
            : Text(subtitle, style: const TextStyle(color: ViaColors.textMuted, fontSize: 12)),
        trailing: trailing,
        onTap: onTap,
      ),
    );
  }

  Widget _slotCard({
    required IconData icon,
    required String title,
    required PlaceModel? place,
    required Color color,
    required Color accentColor,
    VoidCallback? onUseAsDest,
    VoidCallback? onSetFromOrigin,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ViaColors.paperElevated.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(ViaRadii.md),
        border: Border.all(color: ViaColors.hairline.withValues(alpha: 0.7)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: accentColor,
              borderRadius: BorderRadius.circular(ViaRadii.sm),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                Text(
                  place?.name ?? 'Sin definir',
                  style: const TextStyle(color: ViaColors.textMuted, fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          if (onSetFromOrigin != null)
            _smallBtn('Fijar', onSetFromOrigin),
          if (onUseAsDest != null)
            _smallBtn('Ir', onUseAsDest),
        ],
      ),
    );
  }

  Widget _smallBtn(String label, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: TextButton(
        onPressed: onTap,
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: Text(label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
      ),
    );
  }
}

class _SearchBar extends StatefulWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  const _SearchBar({
    required this.controller,
    required this.onChanged,
  });

  @override
  State<_SearchBar> createState() => _SearchBarState();
}

class _SearchBarState extends State<_SearchBar> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onListen);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onListen);
    super.dispose();
  }

  void _onListen() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final hasText = widget.controller.text.isNotEmpty;
    return SizedBox(
      height: 40,
      child: TextField(
        controller: widget.controller,
        onChanged: widget.onChanged,
        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          hintText: 'Buscar en favoritos…',
          prefixIcon: const Icon(Icons.search_rounded, size: 20),
          suffixIcon: hasText
              ? IconButton(
                  icon: const Icon(Icons.clear_rounded, size: 18),
                  onPressed: () {
                    widget.controller.clear();
                    widget.onChanged('');
                  },
                )
              : null,
          contentPadding: const EdgeInsets.symmetric(vertical: 0),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ViaRadii.input),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ViaRadii.input),
            borderSide: const BorderSide(color: ViaColors.hairline),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(ViaRadii.input),
            borderSide: const BorderSide(color: ViaColors.terracotta, width: 1.5),
          ),
          filled: true,
          fillColor: ViaColors.paperTint,
        ),
      ),
    );
  }
}

class _FavoriteRouteCard extends StatelessWidget {
  final int index;
  final RouteMetaModel? route;
  final String routeId;
  final bool isFavorite;
  final VoidCallback? onTap;
  final VoidCallback onToggleFavorite;

  const _FavoriteRouteCard({
    required this.index,
    required this.route,
    required this.routeId,
    required this.isFavorite,
    this.onTap,
    required this.onToggleFavorite,
  });

  @override
  Widget build(BuildContext context) {
    final color = route?.color ?? ViaColors.primary;
    final type = route != null
        ? TransportClassify.normalize(
            route!.transportType,
            routeId: route!.id,
            routeName: route!.name,
          )
        : 'combi';
    final display = route?.display;
    final corridorLabel = display?.corridorLabel;

    final card = Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: ViaBounceable(
        onTap: onTap ?? () {},
        child: Container(
          decoration: BoxDecoration(
            color: ViaColors.paperElevated.withValues(alpha: 0.9),
            borderRadius: BorderRadius.circular(ViaRadii.md),
            border: Border.all(color: ViaColors.hairline.withValues(alpha: 0.6)),
            boxShadow: ViaShadow.sm,
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(ViaRadii.md),
            child: IntrinsicHeight(
              child: Row(
                children: [
                  Container(
                    width: 3,
                    decoration: BoxDecoration(color: color),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 12, 8, 12),
                      child: Row(
                        children: [
                          Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: color.withValues(alpha: 0.35),
                                  blurRadius: 6,
                                  spreadRadius: 0,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  route?.name ?? routeId,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14,
                                    color: ViaColors.ink,
                                    height: 1.15,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    _SmallChip(
                                      label: type == 'autobus' ? 'Autobús' : 'Combi',
                                      color: type == 'autobus'
                                          ? ViaColors.magenta
                                          : ViaColors.teal,
                                    ),
                                    if (corridorLabel != null) ...[
                                      const SizedBox(width: 6),
                                      Flexible(
                                        child: Text(
                                          corridorLabel,
                                          style: const TextStyle(
                                            color: ViaColors.textMuted,
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ),
                          ),
                          _FavoriteStar(
                            isFavorite: isFavorite,
                            onTap: onToggleFavorite,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    return card.animate().fadeIn(
      duration: 350.ms,
      curve: Curves.easeOutCubic,
      delay: (index * 80).ms,
    ).slideX(
      begin: 0.12,
      end: 0,
      duration: 350.ms,
      curve: Curves.easeOutCubic,
      delay: (index * 80).ms,
    );
  }
}

class _SmallChip extends StatelessWidget {
  final String label;
  final Color color;

  const _SmallChip({
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: color,
          height: 1.2,
        ),
      ),
    );
  }
}

class _FavoriteStar extends StatefulWidget {
  final bool isFavorite;
  final VoidCallback onTap;

  const _FavoriteStar({
    required this.isFavorite,
    required this.onTap,
  });

  @override
  State<_FavoriteStar> createState() => _FavoriteStarState();
}

class _FavoriteStarState extends State<_FavoriteStar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;
  bool _prevFav = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(duration: 400.ms, vsync: this);
    _anim = Tween<double>(begin: 1.0, end: 1.3).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack),
    );
    _prevFav = widget.isFavorite;
  }

  @override
  void didUpdateWidget(_FavoriteStar old) {
    super.didUpdateWidget(old);
    if (widget.isFavorite != _prevFav) {
      _ctrl.forward().then((_) {
        if (mounted) _ctrl.reverse();
      });
    }
    _prevFav = widget.isFavorite;
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _handleTap() {
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return ViaBounceable(
      onTap: _handleTap,
      child: ScaleTransition(
        scale: _anim,
        child: AnimatedContainer(
          duration: ViaMotion.quick,
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(ViaRadii.sm),
            color: widget.isFavorite
                ? ViaColors.goldSoft
                : Colors.transparent,
          ),
          child: Icon(
            widget.isFavorite ? Icons.star_rounded : Icons.star_border_rounded,
            color: widget.isFavorite ? ViaColors.gold : ViaColors.textMuted,
            size: 22,
          ),
        ),
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        height: 76,
        decoration: BoxDecoration(
          color: ViaColors.paperElevated.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(ViaRadii.md),
          border: Border.all(color: ViaColors.hairline.withValues(alpha: 0.6)),
        ),
        child: Row(
          children: [
            Container(
              width: 3,
              decoration: BoxDecoration(
                color: ViaColors.hairline,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(ViaRadii.md - 1),
                  bottomLeft: Radius.circular(ViaRadii.md - 1),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Container(
              width: 12,
              height: 12,
              decoration: const BoxDecoration(
                color: ViaColors.hairline,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 140,
                    height: 12,
                    decoration: BoxDecoration(
                      color: ViaColors.hairline,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: 90,
                    height: 10,
                    decoration: BoxDecoration(
                      color: ViaColors.hairline.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 40),
          ],
        ),
      ),
    ).animate(onPlay: (c) => c.repeat()).shimmer(
      duration: 1500.ms,
      color: ViaColors.paperElevated.withValues(alpha: 0.5),
    );
  }
}

class _EmptyFavorites extends StatelessWidget {
  final bool hasSearch;
  final VoidCallback onExplore;

  const _EmptyFavorites({
    required this.hasSearch,
    required this.onExplore,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
      child: Column(
        children: [
          Icon(
            hasSearch ? Icons.search_off_rounded : Icons.favorite_border_rounded,
            size: 56,
            color: ViaColors.textMuted.withValues(alpha: 0.35),
          ),
          const SizedBox(height: 16),
          Text(
            hasSearch ? 'Sin resultados' : 'Aún sin favoritos',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: ViaColors.ink,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            hasSearch
                ? 'Intenta con otro nombre o ID de ruta'
                : 'Agrega rutas a tus favoritos para verlas aquí',
            style: const TextStyle(
              fontSize: 13,
              color: ViaColors.textMuted,
              height: 1.3,
            ),
            textAlign: TextAlign.center,
          ),
          if (!hasSearch) ...[
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onExplore,
              icon: const Icon(Icons.explore_rounded, size: 18),
              label: const Text('Explorar rutas'),
            ),
          ],
        ],
      ),
    );
  }
}
