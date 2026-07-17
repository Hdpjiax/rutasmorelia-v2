import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:maplibre/maplibre.dart';
import '../../core/theme/via_theme.dart';
import '../../state/app_controller.dart';
import '../map/via_map_canvas.dart';
import '../micro/via_panel.dart';
import '../micro/via_toast.dart';
import '../panels/favorites_panel.dart';
import '../panels/legal_panel.dart';
import '../panels/od_search_bar.dart';
import '../panels/routes_panel.dart';
import '../panels/selected_route_card.dart';
import '../panels/trip_panel.dart';
import '../panels/welcome_overlay.dart';

const Color _petro = Color(0xFF005B57);
const Color _dorado = Color(0xFFF5B719);
const Color _petroSoft = Color(0xFFE0F3F1);
const Color _doradoSoft = Color(0xFFFFF8E1);

const LinearGradient _petroDorado = LinearGradient(
  colors: [_petro, Color(0xFF00897B), _dorado],
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  MapController? _map;
  bool _fittedPlan = false;

  String get _dirFilter {
    final d = ref.read(appControllerProvider).routeDirection;
    return switch (d) {
      RouteDirectionFilter.ida => 'ida',
      RouteDirectionFilter.vuelta => 'vuelta',
      RouteDirectionFilter.both => 'both',
    };
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(appControllerProvider);
    final ctrl = ref.read(appControllerProvider.notifier);

    ref.listen(appControllerProvider.select((s) => s.selectedPlanIndex), (_, _) {
      _fittedPlan = false;
    });
    ref.listen(appControllerProvider.select((s) => s.selectedPlan), (prev, next) {
      if (next != null && !_fittedPlan) {
        _fittedPlan = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _fitPlan(
            next.boardingPoint,
            next.alightingPoint,
            state.origin?.coordinates,
            state.destination?.coordinates,
          );
        });
      }
    });
    ref.listen(appControllerProvider.select((s) => s.nearAlight), (prev, next) {
      if (next == true && prev != true && mounted) {
        HapticFeedback.heavyImpact();
        ViaToast.warn(
          context,
          'Te acercas al punto de bajada sugerido (~150 m). ¡Prepárate para bajar!',
          title: '⬇️ Casi llegas',
        );
      }
    });
    ref.listen(appControllerProvider.select((s) => s.gpsMessage), (prev, next) {
      if (next != null && next != prev && mounted) {
        ViaToast.show(context, message: next, kind: ViaToastKind.gps, title: 'GPS');
      }
    });
    ref.listen(appControllerProvider.select((s) => s.online), (prev, next) {
      if (prev == true && next == false && mounted) {
        ViaToast.show(
          context,
          message: 'Catálogo local activo. Algunas búsquedas pueden limitarse.',
          kind: ViaToastKind.offline,
        );
      } else if (prev == false && next == true && mounted) {
        ViaToast.success(context, 'Conexión restaurada.', title: 'En línea');
      }
    });
    ref.listen(appControllerProvider.select((s) => (s.bannerMessage, s.online)), (prev, next) {
      final msg = next.$1;
      if (msg != null && msg != prev?.$1 && next.$2 && mounted) {
        ViaToast.warn(context, msg, title: 'Aviso');
      }
    });
    ref.listen(appControllerProvider.select((s) => s.plans.length), (prev, next) {
      if ((prev ?? 0) == 0 && next > 0 && mounted) {
        ViaToast.success(
          context,
          next == 1 ? 'Encontramos 1 opción de viaje.' : 'Encontramos $next opciones de viaje.',
          title: 'Rutas listas',
        );
      }
    });

    final topPad = MediaQuery.paddingOf(context).top;
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Scaffold(
      backgroundColor: ViaColors.paper,
      body: Stack(
        children: [
          Positioned.fill(
            child: ViaMapCanvas(
              origin: state.origin,
              destination: state.destination,
              userPosition: state.userPosition,
              activePlan: state.selectedPlan,
              selectedRoute: state.selectedRoute,
              shapes: state.mapShapes,
              tracking: state.tracking,
              pinDropActive: state.pinDropMode != PinDropMode.none,
              routeDirectionFilter: _dirFilter,
              projectedOnRoute: state.projectedOnRoute,
              onMapCreated: (c) => _map = c,
              onTap: state.pinDropMode != PinDropMode.none
                  ? (p) {
                      final mode = state.pinDropMode;
                      ctrl.applyPinDrop(p);
                      ViaToast.show(
                        context,
                        message: mode == PinDropMode.origin
                            ? 'Origen fijado en el mapa'
                            : 'Destino fijado en el mapa',
                        kind: ViaToastKind.pin,
                        title: mode == PinDropMode.origin ? 'Origen' : 'Destino',
                      );
                    }
                  : null,
              onLongPress: (p) => ctrl.applyPinDrop(p),
            ),
          ),

          // Gradient top veil
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 72,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      ViaColors.paper.withValues(alpha: 0.45),
                      ViaColors.paper.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // Banner
          if (state.bannerMessage != null || !state.online)
            Positioned(
              top: topPad + 4,
              left: 12,
              right: 12,
              child: ViaPanel(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                color: !state.online ? ViaColors.amberSoft : _doradoSoft,
                child: Row(
                  children: [
                    Icon(
                      !state.online ? Icons.wifi_off_rounded : Icons.info_outline_rounded,
                      size: 18,
                      color: ViaColors.ink,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        state.bannerMessage ?? 'Sin conexión',
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn().slideY(begin: -0.2, end: 0),
            ),

          // Logo + Search
          Positioned(
            top: topPad + (state.bannerMessage != null || !state.online ? 52 : 10),
            left: 12,
            right: 12,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 2, right: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Image.asset(
                        'assets/brand/icono-sin-fondo.png',
                        width: 36,
                        height: 36,
                        errorBuilder: (_, _, _) => Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            gradient: const LinearGradient(
                              colors: [_petro, _dorado],
                            ),
                          ),
                          child: const Icon(Icons.route_rounded, size: 16, color: Colors.white),
                        ),
                      )
                          .animate(onPlay: (c) => c.repeat(reverse: true))
                          .scale(
                            begin: const Offset(0.96, 0.96),
                            end: const Offset(1.05, 1.05),
                            duration: 1600.ms,
                            curve: Curves.easeInOut,
                          ),
                      const SizedBox(width: 6),
                      Image.asset(
                        'assets/brand/nombre-sin-fondo.png',
                        height: 22,
                        errorBuilder: (_, _, _) => Text(
                          'Vía Morelia',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 14,
                            color: ViaColors.ink,
                            shadows: [
                              Shadow(
                                color: Colors.white.withValues(alpha: 0.95),
                                blurRadius: 8,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(duration: 400.ms).slideX(begin: -0.08, end: 0, curve: Curves.easeOutBack),
                const SizedBox(width: 8),
                Expanded(
                  child: Align(
                    alignment: Alignment.topRight,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 360),
                      child: OdSearchBar(
                        collapsed: state.searchCollapsed,
                        onToggleCollapse: () => ctrl.setSearchCollapsed(!state.searchCollapsed),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Pin drop banner
          if (state.pinDropMode != PinDropMode.none)
            Positioned(
              top: topPad + 120,
              left: 16,
              right: 16,
              child: ViaPanel(
                color: state.pinDropMode == PinDropMode.origin
                    ? ViaColors.skySoft
                    : ViaColors.coralSoft,
                child: Row(
                  children: [
                    Icon(
                      state.pinDropMode == PinDropMode.origin
                          ? Icons.trip_origin_rounded
                          : Icons.flag_rounded,
                      color: state.pinDropMode == PinDropMode.origin
                          ? ViaColors.origin
                          : ViaColors.destination,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        state.pinDropMode == PinDropMode.origin
                            ? 'Toca el mapa para fijar el origen'
                            : 'Toca el mapa para fijar el destino',
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                      ),
                    ),
                    TextButton(
                      onPressed: () => ctrl.setPinDropMode(PinDropMode.none),
                      child: const Text('Cancelar'),
                    ),
                  ],
                ),
              ),
            ),

          // Selected route card
          if (state.selectedRoute != null && state.panel == AppPanel.none)
            Positioned(
              left: 12,
              right: 12,
              bottom: bottomPad + 88,
              child: const SelectedRouteCard(),
            ),

          // Map controls — LEFT side, elegant glass circles with staggered entrance
          Positioned(
            top: topPad + 80,
            left: 12,
            child: Column(
              children: [
                ViaRoundIconButton(
                  size: 36,
                  icon: Icons.add_rounded,
                  tooltip: 'Acercar',
                  onPressed: () {
                    final z = _map?.camera?.zoom ?? 13;
                    _map?.moveCamera(zoom: z + 0.6);
                  },
                ).animate().fadeIn(delay: 80.ms, duration: 300.ms).slideX(
                  begin: -0.25,
                  end: 0,
                  curve: Curves.easeOutCubic,
                ),
                const SizedBox(height: 6),
                ViaRoundIconButton(
                  size: 36,
                  icon: Icons.remove_rounded,
                  tooltip: 'Alejar',
                  onPressed: () {
                    final z = _map?.camera?.zoom ?? 13;
                    _map?.moveCamera(zoom: z - 0.6);
                  },
                ).animate().fadeIn(delay: 160.ms, duration: 300.ms).slideX(
                  begin: -0.25,
                  end: 0,
                  curve: Curves.easeOutCubic,
                ),
                const SizedBox(height: 6),
                // GPS button with pulsing glow ring when active
                Stack(
                  alignment: Alignment.center,
                  children: [
                    if (state.gpsLive)
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _petro.withValues(alpha: 0.08),
                        ),
                      ).animate(onPlay: (c) => c.repeat(reverse: true))
                       .scale(
                         begin: const Offset(0.82, 0.82),
                         end: const Offset(1.18, 1.18),
                         duration: 1200.ms,
                         curve: Curves.easeInOut,
                       ),
                    ViaRoundIconButton(
                      size: 36,
                      icon: state.locating
                          ? Icons.hourglass_top_rounded
                          : (state.gpsLive ? Icons.gps_fixed_rounded : Icons.gps_not_fixed_rounded),
                      tooltip: 'GPS',
                      color: state.gpsLive ? _petro : ViaColors.ink,
                      background: state.gpsLive
                          ? _petroSoft.withValues(alpha: 0.85)
                          : null,
                      onPressed: () async {
                        await ctrl.requestGps(setAsOrigin: false, startLive: true);
                        final pos = ref.read(appControllerProvider).userPosition;
                        if (pos != null) {
                          _map?.moveCamera(
                            center: Geographic(lon: pos.longitude, lat: pos.latitude),
                            zoom: 15.2,
                          );
                        }
                      },
                    ).animate().fadeIn(delay: 240.ms, duration: 300.ms).slideX(
                      begin: -0.25,
                      end: 0,
                      curve: Curves.easeOutCubic,
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ViaRoundIconButton(
                  size: 36,
                  icon: Icons.place_rounded,
                  tooltip: 'Fijar en mapa',
                  color: state.pinDropMode != PinDropMode.none ? ViaColors.coral : ViaColors.ink,
                  background: state.pinDropMode != PinDropMode.none
                      ? ViaColors.coralSoft.withValues(alpha: 0.85)
                      : null,
                  onPressed: () {
                    final next = state.pinDropMode == PinDropMode.none
                        ? (state.origin == null ? PinDropMode.origin : PinDropMode.destination)
                        : PinDropMode.none;
                    ctrl.setPinDropMode(next);
                  },
                ).animate().fadeIn(delay: 320.ms, duration: 300.ms).slideX(
                  begin: -0.25,
                  end: 0,
                  curve: Curves.easeOutCubic,
                ),
              ],
            ),
          ),

          // Premium Bottom Dock — floating glass pill
          Positioned(
            left: 12,
            right: 12,
            bottom: bottomPad + 12,
            child: _BottomDock(
              active: state.panel,
              hasTrip: state.plans.isNotEmpty ||
                  (state.origin != null && state.destination != null),
              tracking: state.tracking,
              gpsLive: state.gpsLive,
              onTrip: () => ctrl.togglePanel(AppPanel.trip),
              onRoutes: () => ctrl.togglePanel(AppPanel.routes),
              onFavorites: () => ctrl.togglePanel(AppPanel.favorites),
              onGps: () async {
                await ctrl.requestGps(setAsOrigin: true, startLive: true);
                final pos = ref.read(appControllerProvider).userPosition;
                if (pos != null) {
                  _map?.moveCamera(
                    center: Geographic(lon: pos.longitude, lat: pos.latitude),
                    zoom: 15.2,
                  );
                }
              },
              onMore: () => _openMoreMenu(context, ctrl),
            ),
          ),

          // Panel sheet
          if (state.panel != AppPanel.none && !state.bottomCollapsed)
            Positioned(
              left: 10,
              right: 10,
              bottom: bottomPad + 78,
              child: AnimatedSwitcher(
                duration: ViaMotion.normal,
                child: KeyedSubtree(
                  key: ValueKey(state.panel),
                  child: switch (state.panel) {
                    AppPanel.trip => const TripPanel(),
                    AppPanel.routes => const RoutesPanel(),
                    AppPanel.favorites => const FavoritesPanel(),
                    AppPanel.legal => const LegalPanel(),
                    AppPanel.search || AppPanel.none => const SizedBox.shrink(),
                  },
                ),
              ),
            ),

          // Bottom collapsed tracking bar
          if (state.bottomCollapsed && state.selectedPlan != null)
            Positioned(
              left: 12,
              right: 12,
              bottom: bottomPad + 78,
              child: ViaPanel(
                padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Icon(
                          state.tracking
                              ? (state.trackingSegment == TrackingSegment.ride
                                  ? Icons.directions_bus_rounded
                                  : (state.currentNavStep != null
                                      ? _navIcon(state.currentNavStep!.instruction)
                                      : Icons.navigation_rounded))
                              : Icons.expand_less_rounded,
                          color: state.nearAlight ? ViaColors.coral : _dorado,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: state.tracking && state.currentNavStep != null
                              ? Row(
                                  children: [
                                    Flexible(
                                      child: Text(
                                        state.trackingLabel ?? '',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 13,
                                          color: state.nearAlight ? ViaColors.coral : ViaColors.ink,
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                )
                              : Text(
                                  state.tracking
                                      ? (state.trackingLabel ??
                                          'Seguimiento · ${_trackLabel(state.trackingSegment)}')
                                      : 'Ruta activa · reabrir panel',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                    color: state.nearAlight ? ViaColors.coral : ViaColors.ink,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                        ),
                        if (state.tracking) ...[
                          if (state.nearAlight)
                            const Padding(
                              padding: EdgeInsets.only(right: 6),
                              child: Icon(Icons.notifications_active_rounded,
                                  color: ViaColors.coral, size: 20),
                            ),
                          TextButton(
                            onPressed: () => ctrl.stopTracking(),
                            child: const Text('Parar'),
                          ),
                        ],
                        TextButton(
                          onPressed: () {
                            ctrl.setBottomCollapsed(false);
                            ctrl.setPanel(AppPanel.trip);
                          },
                          child: const Text('Abrir'),
                        ),
                      ],
                    ),
                    if (state.tracking) ...[
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          value: state.trackingProgress.clamp(0.02, 1),
                          minHeight: 5,
                          color: state.nearAlight ? ViaColors.coral : _petro,
                          backgroundColor: ViaColors.hairline,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),

          // Welcome overlay
          if (state.showWelcome)
            Positioned.fill(
              child: WelcomeOverlay(
                onStart: () => ctrl.dismissWelcome(),
                onExploreRoutes: () {
                  ctrl.dismissWelcome();
                  ctrl.setPanel(AppPanel.routes);
                },
                onLegal: () {
                  ctrl.dismissWelcome();
                  ctrl.setPanel(AppPanel.legal);
                },
                onRestoreLast: () async {
                  await ctrl.dismissWelcome();
                  await ctrl.restoreLastTrip();
                },
              ).animate().fadeIn(duration: 320.ms),
            ),
        ],
      ),
    );
  }

  String _trackLabel(TrackingSegment s) {
    switch (s) {
      case TrackingSegment.walkToBoard:
        return '🚶 camina a subir';
      case TrackingSegment.ride:
        return '🚌 en ruta';
      case TrackingSegment.walkToDest:
        return '🚶 camina al destino';
      case TrackingSegment.done:
        return '✅ llegaste';
    }
  }

  IconData _navIcon(String instruction) {
    if (instruction.contains('derecha')) return Icons.turn_right_rounded;
    if (instruction.contains('izquierda')) return Icons.turn_left_rounded;
    if (instruction.contains('Continúa') || instruction.contains('recto')) return Icons.north_rounded;
    if (instruction.contains('llegado')) return Icons.check_circle_rounded;
    return Icons.navigation_rounded;
  }

  void _openMoreMenu(BuildContext context, AppController ctrl) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return ViaPanel(
          radius: ViaRadii.xl,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.history_rounded, color: _petro),
                title: const Text('Último viaje', style: TextStyle(fontWeight: FontWeight.w800)),
                onTap: () {
                  Navigator.pop(ctx);
                  ctrl.restoreLastTrip();
                },
              ),
              ListTile(
                leading: const Icon(Icons.layers_clear_rounded, color: _dorado),
                title: const Text('Limpiar mapa', style: TextStyle(fontWeight: FontWeight.w800)),
                onTap: () {
                  Navigator.pop(ctx);
                  ctrl.clearSession();
                },
              ),
              ListTile(
                leading: const Icon(Icons.gavel_rounded, color: _petro),
                title: const Text('Avisos legales', style: TextStyle(fontWeight: FontWeight.w800)),
                onTap: () {
                  Navigator.pop(ctx);
                  ctrl.setPanel(AppPanel.legal);
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  void _fitPlan(LatLng a, LatLng b, LatLng? o, LatLng? d) {
    final pts = <Geographic>[
      Geographic(lon: a.longitude, lat: a.latitude),
      Geographic(lon: b.longitude, lat: b.latitude),
    ];
    if (o != null) pts.add(Geographic(lon: o.longitude, lat: o.latitude));
    if (d != null) pts.add(Geographic(lon: d.longitude, lat: d.latitude));
    if (pts.length < 2) return;
    try {
      _map?.fitBounds(
        bounds: LngLatBounds.fromPoints(pts),
        padding: const EdgeInsets.fromLTRB(48, 170, 48, 210),
      );
    } catch (_) {}
  }
}

/// Floating glass pill dock with petroleum/dorado brand language.
class _BottomDock extends StatelessWidget {
  final AppPanel active;
  final bool hasTrip;
  final bool tracking;
  final bool gpsLive;
  final VoidCallback onTrip;
  final VoidCallback onRoutes;
  final VoidCallback onFavorites;
  final VoidCallback onGps;
  final VoidCallback onMore;

  const _BottomDock({
    required this.active,
    required this.hasTrip,
    required this.tracking,
    required this.gpsLive,
    required this.onTrip,
    required this.onRoutes,
    required this.onFavorites,
    required this.onGps,
    required this.onMore,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 340),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ViaRadii.xl + 4),
          boxShadow: [
            BoxShadow(
              color: _petro.withValues(alpha: 0.08),
              blurRadius: 28,
              spreadRadius: 3,
              offset: const Offset(0, 0),
            ),
            BoxShadow(
              color: _dorado.withValues(alpha: 0.05),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
            BoxShadow(
              color: const Color(0xFF142033).withValues(alpha: 0.08),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(ViaRadii.xl),
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              decoration: BoxDecoration(
                color: ViaColors.paperElevated.withValues(alpha: 0.72),
                borderRadius: BorderRadius.circular(ViaRadii.xl),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.55),
                  width: 1.2,
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 5),
              child: Row(
                children: [
                  _DockItem(
                    index: 0,
                    icon: tracking
                        ? Icons.navigation_rounded
                        : Icons.directions_transit_filled_rounded,
                    label: tracking ? 'En vivo' : 'Viaje',
                    selected: active == AppPanel.trip,
                    onTap: onTrip,
                    badge: hasTrip,
                  ),
                  _DockItem(
                    index: 1,
                    icon: Icons.map_rounded,
                    label: 'Rutas',
                    selected: active == AppPanel.routes,
                    onTap: onRoutes,
                  ),
                  _DockItem(
                    index: 2,
                    icon: Icons.favorite_rounded,
                    label: 'Favoritos',
                    selected: active == AppPanel.favorites,
                    onTap: onFavorites,
                  ),
                  _DockItem(
                    index: 3,
                    icon: gpsLive ? Icons.gps_fixed_rounded : Icons.my_location_rounded,
                    label: 'GPS',
                    selected: gpsLive,
                    onTap: onGps,
                  ),
                  _DockItem(
                    index: 4,
                    icon: Icons.more_horiz_rounded,
                    label: 'Más',
                    selected: active == AppPanel.legal,
                    onTap: onMore,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Dock item with gradient glow icon container, small label, pulsing dorado dot,
/// premium selection animation (bounce scale + fade), and staggered entrance.
class _DockItem extends StatefulWidget {
  final int index;
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool badge;

  const _DockItem({
    required this.index,
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge = false,
  });

  @override
  State<_DockItem> createState() => _DockItemState();
}

class _DockItemState extends State<_DockItem> with SingleTickerProviderStateMixin {
  late final AnimationController _selectCtrl;
  late final Animation<double> _selectAnim;
  bool _entered = false;

  @override
  void initState() {
    super.initState();
    _selectCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _selectAnim = CurvedAnimation(
      parent: _selectCtrl,
      curve: Curves.easeOutBack,
    );
    if (widget.selected) _selectCtrl.value = 1.0;
    _triggerEntrance();
  }

  void _triggerEntrance() {
    Future.delayed(Duration(milliseconds: 80 * widget.index), () {
      if (mounted) setState(() => _entered = true);
    });
  }

  @override
  void didUpdateWidget(_DockItem old) {
    super.didUpdateWidget(old);
    if (widget.selected && !old.selected) {
      _selectCtrl.forward(from: 0.0);
    } else if (!widget.selected && old.selected) {
      _selectCtrl.reverse();
    }
  }

  @override
  void dispose() {
    _selectCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: ViaBounceable(
        onTap: widget.onTap,
        child: AnimatedBuilder(
          animation: _selectAnim,
          builder: (context, child) {
            final scale = widget.selected
                ? (0.4 + 0.6 * _selectAnim.value)
                : (0.6 + 0.4 * _selectAnim.value);
            final opacity = widget.selected
                ? (0.3 + 0.7 * _selectAnim.value)
                : 0.7;
            return Opacity(
              opacity: _entered ? opacity : 0.0,
              child: Transform.translate(
                offset: Offset(0, _entered ? 0 : 14),
                child: Transform.scale(
                  scale: scale,
                  child: child,
                ),
              ),
            );
          },
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  AnimatedContainer(
                    duration: ViaMotion.quick,
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: widget.selected ? _petroDorado : null,
                      color: widget.selected ? null : Colors.transparent,
                      boxShadow: widget.selected
                          ? [
                              BoxShadow(
                                color: _petro.withValues(alpha: 0.25),
                                blurRadius: 8,
                                spreadRadius: 1,
                              ),
                              BoxShadow(
                                color: _dorado.withValues(alpha: 0.15),
                                blurRadius: 12,
                                spreadRadius: -2,
                              ),
                            ]
                          : null,
                    ),
                    child: Icon(
                      widget.icon,
                      color: widget.selected ? Colors.white : ViaColors.textSecondary,
                      size: 17,
                    ),
                  ),
                  if (widget.badge)
                    Positioned(
                      right: -2,
                      top: -1,
                      child: Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: _dorado,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: _dorado.withValues(alpha: 0.5),
                              blurRadius: 3,
                              spreadRadius: 1,
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 3),
              Text(
                widget.label,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: widget.selected ? _petro : ViaColors.textMuted,
                  letterSpacing: 0.1,
                ),
              ),
              const SizedBox(height: 2),
              SizedBox(
                height: 4,
                child: widget.selected
                    ? Center(
                        child: Container(
                          width: 4,
                          height: 4,
                          decoration: BoxDecoration(
                            color: _dorado,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: _dorado.withValues(alpha: 0.6),
                                blurRadius: 4,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                        ).animate(onPlay: (c) => c.repeat(reverse: true))
                         .scale(
                           begin: const Offset(0.75, 0.75),
                           end: const Offset(1.4, 1.4),
                           duration: 800.ms,
                           curve: Curves.easeInOut,
                         ),
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
