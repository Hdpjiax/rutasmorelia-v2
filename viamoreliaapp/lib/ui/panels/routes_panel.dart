import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
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
          // Glass search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
            child: ViaGlass.wrap(
              TextField(
                    onChanged: ctrl.setRouteQuery,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13.5,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Buscar ruta (amarilla, naranja…)',
                      hintStyle: const TextStyle(
                        color: ViaColors.textMuted,
                        fontSize: 13,
                      ),
                      prefixIcon: const Icon(
                        Icons.search_rounded,
                        size: 20,
                        color: ViaColors.textMuted,
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                  radius: ViaRadii.input,
                  blur: 24,
                ),
              ),

          // Filter chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                ViaChip(
                  label: 'Todas',
                  selected: state.transportFilter == 'all' &&
                      !state.onlyFavoriteRoutes,
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
                  onTap: () =>
                      ctrl.setOnlyFavoriteRoutes(!state.onlyFavoriteRoutes),
                ),
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: ViaColors.paperTint,
                    borderRadius: BorderRadius.circular(ViaRadii.pill),
                  ),
                  child: Text(
                    '${routes.length}',
                    style: const TextStyle(
                      color: ViaColors.textMuted,
                      fontWeight: FontWeight.w800,
                      fontSize: 11,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Route list
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
              itemCount: routes.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final r = routes[i];
                final fav = state.favoriteRouteIds.contains(r.id);
                final selected = state.selectedRoute?.id == r.id;
                return _RouteCard(
                  routeName: r.name,
                  color: r.color,
                  corridorLabel: r.display.corridorLabel,
                  transportType: r.transportType ?? 'ruta',
                  fav: fav,
                  selected: selected,
                  index: i,
                  onTap: () => ctrl.selectRoute(r),
                  onFav: () => ctrl.toggleFavoriteRoute(r.id),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  final String routeName;
  final Color? color;
  final String corridorLabel;
  final String transportType;
  final bool fav;
  final bool selected;
  final int index;
  final VoidCallback onTap;
  final VoidCallback onFav;

  const _RouteCard({
    required this.routeName,
    required this.color,
    required this.corridorLabel,
    required this.transportType,
    required this.fav,
    required this.selected,
    required this.index,
    required this.onTap,
    required this.onFav,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = color ?? ViaColors.primary;
    return Container(
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
          onTap: onTap,
          child: Stack(
            children: [
              // Left color bar
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                child: Container(
                  width: 4,
                  decoration: BoxDecoration(
                    color: accentColor,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(ViaRadii.card - 1),
                      bottomLeft: Radius.circular(ViaRadii.card - 1),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Large color dot with glow
                    Container(
                      margin: const EdgeInsets.only(top: 2),
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        color: accentColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2.5),
                        boxShadow: [
                          BoxShadow(
                            color: accentColor.withValues(alpha: 0.4),
                            blurRadius: 8,
                            spreadRadius: 0.5,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Info
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            routeName,
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 14.5,
                              color: ViaColors.ink,
                              height: 1.15,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 4,
                            runSpacing: 4,
                            children: [
                              _badge(
                                transportType == 'combi' ? 'Combi' : 'Autobús',
                                ViaColors.primary,
                              ),
                              _badge(
                                corridorLabel,
                                ViaColors.secondary,
                              ),
                              if (selected)
                                _badge(
                                  'En el mapa',
                                  ViaColors.sky,
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Animated favorite button
                    _FavoriteButton(
                      fav: fav,
                      onFav: onFav,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ).animate().fadeIn(
          duration: 300.ms,
          delay: (30 * index).ms,
          curve: Curves.easeOutCubic,
        ).slideX(
          begin: 0.04,
          end: 0,
          duration: 320.ms,
          delay: (30 * index).ms,
          curve: Curves.easeOutCubic,
        );
  }

  Widget _badge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 9,
        ),
      ),
    );
  }
}

class _FavoriteButton extends StatefulWidget {
  final bool fav;
  final VoidCallback onFav;

  const _FavoriteButton({required this.fav, required this.onFav});

  @override
  State<_FavoriteButton> createState() => _FavoriteButtonState();
}

class _FavoriteButtonState extends State<_FavoriteButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _scaleAnim = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.75), weight: 30),
      TweenSequenceItem(tween: Tween(begin: 0.75, end: 1.15), weight: 20),
      TweenSequenceItem(tween: Tween(begin: 1.15, end: 1.0), weight: 50),
    ]).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _onTap() {
    _ctrl.forward(from: 0);
    widget.onFav();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _scaleAnim,
      builder: (context, child) {
        return Transform.scale(
          scale: _scaleAnim.value,
          child: child,
        );
      },
      child: ViaBounceable(
        onTap: _onTap,
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: widget.fav
                ? ViaColors.mintSoft.withValues(alpha: 0.6)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(ViaRadii.sm),
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            transitionBuilder: (child, anim) {
              return ScaleTransition(scale: anim, child: child);
            },
            child: Icon(
              widget.fav
                  ? Icons.favorite_rounded
                  : Icons.favorite_border_rounded,
              key: ValueKey(widget.fav),
              color: widget.fav ? ViaColors.coral : ViaColors.textMuted,
              size: 18,
            ),
          ),
        ),
      ),
    );
  }
}
