import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
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

    return ViaGlass.wrap(
      Stack(
            children: [
              // Left color strip
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                child: Container(
                  width: 4,
                  decoration: BoxDecoration(
                    color: route.color,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(ViaRadii.lg - 1),
                      bottomLeft: Radius.circular(ViaRadii.lg - 1),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Header
                    Row(
                      children: [
                        // Color dot
                        Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: route.color,
                            shape: BoxShape.circle,
                            border:
                                Border.all(color: Colors.white, width: 2.5),
                            boxShadow: [
                              BoxShadow(
                                color: route.color.withValues(alpha: 0.4),
                                blurRadius: 6,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                route.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 15,
                                  color: ViaColors.ink,
                                  height: 1.15,
                                ),
                              ),
                              Text(
                                'Corredor · ${route.transportType ?? 'combi'}',
                                style: const TextStyle(
                                  color: ViaColors.textSecondary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => ctrl.clearSelectedRoute(),
                          icon: const Icon(Icons.close_rounded, size: 20),
                          style: IconButton.styleFrom(
                            backgroundColor: ViaColors.paperTint,
                            foregroundColor: ViaColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Direction chips with active indicator
                    _DirectionChips(
                      current: state.routeDirection,
                      onChanged: ctrl.setRouteDirection,
                    ),
                    const SizedBox(height: 12),

                    // Action buttons
                    Row(
                      children: [
                        _ActionBtn(
                          icon: fav
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded,
                          color: fav ? ViaColors.coral : ViaColors.textSecondary,
                          tooltip: 'Favorito',
                          active: fav,
                          onTap: () =>
                              ctrl.toggleFavoriteRoute(route.id),
                        ),
                        const SizedBox(width: 4),
                        _ActionBtn(
                          icon: Icons.ios_share_rounded,
                          color: ViaColors.textSecondary,
                          tooltip: 'Compartir',
                          onTap: () {
                            final text = '🚌 Ruta ${route.name} · ${route.display.corridorLabel}\n'
                                'Tipo: ${route.transportType ?? "ruta"}\n\n'
                                'Visto en ViaMorelia';
                            Share.share(text, subject: 'Ruta en ViaMorelia');
                          },
                        ),
                        const SizedBox(width: 4),
                        _ActionBtn(
                          icon: Icons.flag_outlined,
                          color: ViaColors.textSecondary,
                          tooltip: 'Reportar',
                          onTap: () {
                            showDialog(
                              context: context,
                              builder: (_) => const ReportRouteDialog(),
                            );
                          },
                        ),
                        const Spacer(),
                        FilledButton.tonalIcon(
                          onPressed: () => ctrl.setPanel(AppPanel.routes),
                          icon: const Icon(Icons.info_outline_rounded,
                              size: 16),
                          label: const Text('Detalles',
                              style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const ViaSuggestedStopBanner(),
                  ],
                ),
              ),
            ],
          ),
          radius: ViaRadii.lg,
          blur: 24,
        ).animate().fadeIn(
          duration: 300.ms,
          curve: Curves.easeOutCubic,
        ).slideY(
          begin: 0.08,
          end: 0,
          duration: 350.ms,
          curve: Curves.easeOutCubic,
        );
  }
}

class _DirectionChips extends StatelessWidget {
  final RouteDirectionFilter current;
  final ValueChanged<RouteDirectionFilter> onChanged;

  const _DirectionChips({
    required this.current,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _DirChip(
          label: 'Ambos',
          value: RouteDirectionFilter.both,
          current: current,
          accentColor: ViaColors.primary,
          onTap: onChanged,
        ),
        const SizedBox(width: 6),
        _DirChip(
          label: 'Ida',
          value: RouteDirectionFilter.ida,
          current: current,
          accentColor: ViaColors.walkToBoard,
          onTap: onChanged,
        ),
        const SizedBox(width: 6),
        _DirChip(
          label: 'Vuelta',
          value: RouteDirectionFilter.vuelta,
          current: current,
          accentColor: ViaColors.walkFromAlight,
          onTap: onChanged,
        ),
      ],
    );
  }
}

class _DirChip extends StatelessWidget {
  final String label;
  final RouteDirectionFilter value;
  final RouteDirectionFilter current;
  final Color accentColor;
  final ValueChanged<RouteDirectionFilter> onTap;

  const _DirChip({
    required this.label,
    required this.value,
    required this.current,
    required this.accentColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isActive = current == value;
    return ViaBounceable(
      onTap: () => onTap(value),
      child: AnimatedContainer(
        duration: ViaMotion.quick,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? accentColor.withValues(alpha: 0.12)
              : ViaColors.paperTint,
          borderRadius: BorderRadius.circular(ViaRadii.pill),
          border: Border.all(
            color: isActive
                ? accentColor.withValues(alpha: 0.55)
                : ViaColors.hairline,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: ViaMotion.quick,
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: isActive
                    ? accentColor
                    : ViaColors.textMuted.withValues(alpha: 0.4),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: isActive ? accentColor : ViaColors.textSecondary,
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String tooltip;
  final bool active;
  final VoidCallback onTap;

  const _ActionBtn({
    required this.icon,
    required this.color,
    required this.tooltip,
    this.active = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final btn = ViaBounceable(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: active
              ? color.withValues(alpha: 0.12)
              : ViaColors.paperTint,
          borderRadius: BorderRadius.circular(ViaRadii.sm),
        ),
        child: Icon(icon, color: color, size: 18),
      ),
    );
    final trimmed = tooltip.trim();
    return trimmed.isEmpty ? btn : ViaTooltip(message: trimmed, child: btn);
  }
}
