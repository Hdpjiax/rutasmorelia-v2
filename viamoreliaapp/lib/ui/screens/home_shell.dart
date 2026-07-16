import 'package:flutter/material.dart';
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
        ViaToast.warn(
          context,
          'Te acercas al punto de bajada sugerido (~150 m). Prepárate para bajar.',
          title: 'Casi llegas',
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

          // Velo suave (no bloque sólido) para legibilidad del status bar
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
                      ViaColors.paper.withValues(alpha: 0.42),
                      ViaColors.paper.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ),

          if (state.bannerMessage != null || !state.online)
            Positioned(
              top: topPad + 4,
              left: 12,
              right: 12,
              child: ViaPanel(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                color: !state.online ? ViaColors.amberSoft : ViaColors.coralSoft,
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

          Positioned(
            top: topPad + (state.bannerMessage != null || !state.online ? 52 : 10),
            left: 12,
            right: 12,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Logo + nombre transparentes (sin ViaPanel / bloque blanco)
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
                              colors: [ViaColors.mint, ViaColors.coral],
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

          if (state.selectedRoute != null && state.panel == AppPanel.none)
            Positioned(
              left: 12,
              right: 12,
              bottom: bottomPad + 88,
              child: const SelectedRouteCard().animate().fadeIn().slideY(begin: 0.1, end: 0),
            ),

          Positioned(
            right: 12,
            bottom: bottomPad + 100,
            child: Column(
              children: [
                ViaRoundIconButton(
                  icon: Icons.add_rounded,
                  tooltip: 'Acercar',
                  onPressed: () {
                    final z = _map?.camera?.zoom ?? 13;
                    _map?.moveCamera(zoom: z + 0.6);
                  },
                ),
                const SizedBox(height: 8),
                ViaRoundIconButton(
                  icon: Icons.remove_rounded,
                  tooltip: 'Alejar',
                  onPressed: () {
                    final z = _map?.camera?.zoom ?? 13;
                    _map?.moveCamera(zoom: z - 0.6);
                  },
                ),
                const SizedBox(height: 8),
                ViaRoundIconButton(
                  icon: state.locating
                      ? Icons.hourglass_top_rounded
                      : (state.gpsLive ? Icons.gps_fixed_rounded : Icons.gps_not_fixed_rounded),
                  tooltip: 'GPS',
                  color: state.gpsLive ? ViaColors.mint : ViaColors.ink,
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
                ),
                const SizedBox(height: 8),
                ViaRoundIconButton(
                  icon: Icons.place_rounded,
                  tooltip: 'Fijar en mapa',
                  color: state.pinDropMode != PinDropMode.none ? ViaColors.coral : ViaColors.ink,
                  onPressed: () {
                    final next = state.pinDropMode == PinDropMode.none
                        ? (state.origin == null ? PinDropMode.origin : PinDropMode.destination)
                        : PinDropMode.none;
                    ctrl.setPinDropMode(next);
                  },
                ),
                const SizedBox(height: 8),
                ViaRoundIconButton(
                  icon: Icons.layers_clear_rounded,
                  tooltip: 'Limpiar',
                  onPressed: () => ctrl.clearSession(),
                ),
              ],
            ),
          ),

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
              onClear: () => ctrl.clearSession(),
              onMore: () => _openMoreMenu(context, ctrl),
            ).animate().fadeIn(delay: 120.ms).slideY(begin: 0.15, end: 0),
          ),

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
                          state.tracking ? Icons.navigation_rounded : Icons.expand_less_rounded,
                          color: state.tracking ? ViaColors.coral : ViaColors.mint,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            state.tracking
                                ? (state.trackingLabel ??
                                    'Seguimiento · ${_trackLabel(state.trackingSegment)}')
                                : 'Ruta activa · reabrir panel',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (state.tracking)
                          TextButton(
                            onPressed: () => ctrl.stopTracking(),
                            child: const Text('Parar'),
                          ),
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
                          color: ViaColors.mint,
                          backgroundColor: ViaColors.hairline,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),

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
        return 'camina a subir';
      case TrackingSegment.ride:
        return 'en combi/camión';
      case TrackingSegment.walkToDest:
        return 'camina al destino';
      case TrackingSegment.done:
        return 'llegaste';
    }
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
                leading: const Icon(Icons.favorite_rounded, color: ViaColors.coral),
                title: const Text('Favoritos', style: TextStyle(fontWeight: FontWeight.w800)),
                onTap: () {
                  Navigator.pop(ctx);
                  ctrl.setPanel(AppPanel.favorites);
                },
              ),
              ListTile(
                leading: const Icon(Icons.history_rounded, color: ViaColors.mint),
                title: const Text('Último viaje', style: TextStyle(fontWeight: FontWeight.w800)),
                onTap: () {
                  Navigator.pop(ctx);
                  ctrl.restoreLastTrip();
                },
              ),
              ListTile(
                leading: const Icon(Icons.gavel_rounded, color: ViaColors.inkSoft),
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

class _BottomDock extends StatelessWidget {
  final AppPanel active;
  final bool hasTrip;
  final bool tracking;
  final bool gpsLive;
  final VoidCallback onTrip;
  final VoidCallback onRoutes;
  final VoidCallback onGps;
  final VoidCallback onClear;
  final VoidCallback onMore;

  const _BottomDock({
    required this.active,
    required this.hasTrip,
    required this.tracking,
    required this.gpsLive,
    required this.onTrip,
    required this.onRoutes,
    required this.onGps,
    required this.onClear,
    required this.onMore,
  });

  @override
  Widget build(BuildContext context) {
    return ViaPanel(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      child: Row(
        children: [
          _DockItem(
            icon: Icons.directions_transit_filled_rounded,
            label: tracking ? 'En vivo' : 'Viaje',
            selected: active == AppPanel.trip,
            accent: tracking ? ViaColors.coral : ViaColors.mint,
            onTap: onTrip,
            badge: hasTrip,
          ),
          _DockItem(
            icon: Icons.map_rounded,
            label: 'Rutas',
            selected: active == AppPanel.routes,
            onTap: onRoutes,
          ),
          _DockItem(
            icon: gpsLive ? Icons.gps_fixed_rounded : Icons.my_location_rounded,
            label: 'GPS',
            selected: gpsLive,
            accent: ViaColors.sky,
            onTap: onGps,
          ),
          _DockItem(
            icon: Icons.layers_clear_rounded,
            label: 'Limpiar',
            selected: false,
            onTap: onClear,
          ),
          _DockItem(
            icon: Icons.more_horiz_rounded,
            label: 'Más',
            selected: active == AppPanel.favorites || active == AppPanel.legal,
            onTap: onMore,
          ),
        ],
      ),
    );
  }
}

class _DockItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color accent;
  final bool badge;

  const _DockItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.accent = ViaColors.mint,
    this.badge = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Material(
        color: selected ? accent.withValues(alpha: 0.12) : Colors.transparent,
        borderRadius: BorderRadius.circular(ViaRadii.md),
        child: InkWell(
          borderRadius: BorderRadius.circular(ViaRadii.md),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Icon(icon, color: selected ? accent : ViaColors.textSecondary, size: 21),
                    if (badge)
                      Positioned(
                        right: -4,
                        top: -2,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: ViaColors.coral,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: selected ? accent : ViaColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
