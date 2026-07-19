
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

const Color _petro = ViaColors.petroleo;
const Color _dorado = ViaColors.dorado;
const Color _petroSoft = ViaColors.petroleoSoft;
const Color _doradoSoft = ViaColors.doradoSoft;

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
    ref.listen(appControllerProvider.select((s) => (s.panel, s.bottomCollapsed, s.tracking)), (prev, next) {
      final selectedPlan = ref.read(appControllerProvider).selectedPlan;
      if (selectedPlan != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _fitPlan(
            selectedPlan.boardingPoint,
            selectedPlan.alightingPoint,
            ref.read(appControllerProvider).origin?.coordinates,
            ref.read(appControllerProvider).destination?.coordinates,
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
    ref.listen(appControllerProvider.select((s) => s.selectedRoute), (prev, next) {
      if (next != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _fitRoute(next.id);
        });
      }
    });

    final topPad = MediaQuery.paddingOf(context).top;
    final bottomPad = MediaQuery.paddingOf(context).bottom;
    final isTablet = MediaQuery.sizeOf(context).width >= 600;
    final panelBottomOffset = isTablet ? 104.0 : 88.0;
    final hasPanel = state.panel != AppPanel.none && !state.bottomCollapsed;
    final double controlsBottom = hasPanel
        ? (isTablet ? 300.0 : 340.0) + bottomPad + 16
        : 110.0 + bottomPad;

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
                      HapticFeedback.mediumImpact();
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
              onLongPress: (p) {
                HapticFeedback.mediumImpact();
                ctrl.applyPinDrop(p);
              },
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
            top: topPad + (state.bannerMessage != null || !state.online ? (isTablet ? 56 : 52) : 10),
            left: 12,
            right: 12,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: EdgeInsets.only(top: isTablet ? 5 : 2, right: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Image.asset(
                        'assets/brand/icono-sin-fondo.png',
                        width: isTablet ? 46 : 36,
                        height: isTablet ? 46 : 36,
                        errorBuilder: (_, _, _) => Container(
                          width: isTablet ? 46 : 36,
                          height: isTablet ? 46 : 36,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            gradient: const LinearGradient(
                              colors: [_petro, _dorado],
                            ),
                          ),
                          child: Icon(Icons.route_rounded, size: isTablet ? 20 : 16, color: Colors.white),
                        ),
                      )
                          .animate(onPlay: (c) => c.repeat(reverse: true))
                          .scale(
                            begin: const Offset(0.96, 0.96),
                            end: const Offset(1.05, 1.05),
                            duration: 1600.ms,
                            curve: Curves.easeInOut,
                          ),
                      SizedBox(width: isTablet ? 8 : 6),
                      Image.asset(
                        'assets/brand/nombre-sin-fondo.png',
                        height: isTablet ? 28 : 22,
                        errorBuilder: (_, _, _) => Text(
                          'Vía Morelia',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: isTablet ? 18 : 14,
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

          // Map controls — LEFT side, elegant glass circles positioned lower & enlarged
          AnimatedPositioned(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOutExpo,
            bottom: controlsBottom,
            left: 12,
            child: Column(
              children: [
                ViaRoundIconButton(
                  size: 42,
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
                  size: 42,
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
                        width: 58,
                        height: 58,
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
                      size: 42,
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
                  size: 42,
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
            left: 0,
            right: 0,
            bottom: 0,
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
              onLegal: () => ctrl.togglePanel(AppPanel.legal),
              onClear: () {
                HapticFeedback.heavyImpact();
                ctrl.clearSession();
                ViaToast.success(context, 'Mapa y sesión limpiados.', title: 'Limpiar');
              },
            ),
          ),

          // Panel sheet
          if (state.panel != AppPanel.none && !state.bottomCollapsed)
            Positioned(
              left: 10,
              right: 10,
              bottom: bottomPad + panelBottomOffset,
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
              bottom: bottomPad + panelBottomOffset,
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



  void _fitPlan(LatLng a, LatLng b, LatLng? o, LatLng? d) {
    final pts = <Geographic>[
      Geographic(lon: a.longitude, lat: a.latitude),
      Geographic(lon: b.longitude, lat: b.latitude),
    ];
    if (o != null) pts.add(Geographic(lon: o.longitude, lat: o.latitude));
    if (d != null) pts.add(Geographic(lon: d.longitude, lat: d.latitude));
    if (pts.length < 2) return;

    final state = ref.read(appControllerProvider);
    final hasPanel = state.panel != AppPanel.none || state.tracking;
    final isTablet = MediaQuery.sizeOf(context).width >= 600;

    final double bottomPadding = hasPanel
        ? (isTablet ? 300.0 : 340.0)
        : 90.0;

    try {
      _map?.fitBounds(
        bounds: LngLatBounds.fromPoints(pts),
        padding: EdgeInsets.fromLTRB(48, 170, 48, bottomPadding),
      );
    } catch (_) {}
  }

  void _fitRoute(String routeId) {
    final shapes = ref.read(appControllerProvider).mapShapes;
    final pts = <Geographic>[];
    for (final s in shapes) {
      if (s.routeId == routeId) {
        for (final c in s.coordinates) {
          pts.add(Geographic(lon: c.longitude, lat: c.latitude));
        }
      }
    }
    if (pts.isEmpty) return;
    try {
      _map?.fitBounds(
        bounds: LngLatBounds.fromPoints(pts),
        padding: const EdgeInsets.fromLTRB(48, 120, 48, 220),
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
  final VoidCallback onLegal;
  final VoidCallback onClear;

  const _BottomDock({
    required this.active,
    required this.hasTrip,
    required this.tracking,
    required this.gpsLive,
    required this.onTrip,
    required this.onRoutes,
    required this.onFavorites,
    required this.onGps,
    required this.onLegal,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.paddingOf(context).bottom;

    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.fromLTRB(12, 10, 12, bottomPad + 8),
        decoration: BoxDecoration(
          color: ViaColors.paperElevated.withValues(alpha: 0.94),
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(28),
            topRight: Radius.circular(28),
          ),
          border: const Border(
            top: BorderSide(
              color: ViaColors.hairline,
              width: 1.5,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: ViaColors.ink.withValues(alpha: 0.08),
              blurRadius: 24,
              offset: const Offset(0, -8),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
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
              activeColor: _petro,
            ),
            _DockItem(
              index: 1,
              icon: Icons.map_rounded,
              label: 'Rutas',
              selected: active == AppPanel.routes,
              onTap: onRoutes,
              activeColor: _petro,
            ),
            _DockItem(
              index: 2,
              icon: Icons.favorite_rounded,
              label: 'Favoritos',
              selected: active == AppPanel.favorites,
              onTap: onFavorites,
              activeColor: _petro,
            ),
            _DockItem(
              index: 3,
              icon: gpsLive ? Icons.gps_fixed_rounded : Icons.my_location_rounded,
              label: 'GPS',
              selected: gpsLive,
              onTap: onGps,
              activeColor: _petro,
            ),
            _DockItem(
              index: 4,
              icon: Icons.gavel_rounded,
              label: 'Legales',
              selected: active == AppPanel.legal,
              onTap: onLegal,
              activeColor: _petro,
            ),
            _DockItem(
              index: 5,
              icon: Icons.layers_clear_rounded,
              label: 'Limpiar',
              selected: false,
              onTap: onClear,
              activeColor: _dorado,
            ),
          ],
        ),
      ),
    );
  }
}

/// Dock item with dynamic expand selection animation, drop indicator bubble, and scale.
class _DockItem extends StatefulWidget {
  final int index;
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool badge;
  final Color activeColor;

  const _DockItem({
    required this.index,
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge = false,
    this.activeColor = _petro,
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
      duration: const Duration(milliseconds: 300),
    );
    _selectAnim = CurvedAnimation(
      parent: _selectCtrl,
      curve: Curves.easeOutCubic,
    );
    if (widget.selected) _selectCtrl.value = 1.0;
    _triggerEntrance();
  }

  void _triggerEntrance() {
    Future.delayed(Duration(milliseconds: 50 * widget.index), () {
      if (mounted) setState(() => _entered = true);
    });
  }

  @override
  void didUpdateWidget(_DockItem old) {
    super.didUpdateWidget(old);
    if (widget.selected && !old.selected) {
      _selectCtrl.forward();
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
    final screenWidth = MediaQuery.sizeOf(context).width;
    final isTablet = screenWidth >= 600;

    final double iconSize = isTablet ? 22.0 : 19.0;
    final double fontSize = isTablet ? 11.0 : 9.0;
    final double badgeSize = isTablet ? 8.5 : 7.0;
    final double badgeOffset = isTablet ? -2.5 : -2.0;

    return Expanded(
      child: Opacity(
        opacity: _entered ? 1.0 : 0.0,
        child: ViaBounceable(
          onTap: widget.onTap,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedBuilder(
                animation: _selectAnim,
                builder: (context, child) {
                  final double translateY = -7.0 * _selectAnim.value;
                  final double scale = 0.95 + 0.05 * _selectAnim.value;

                  return Transform.translate(
                    offset: Offset(0, translateY),
                    child: Transform.scale(
                      scale: scale,
                      child: child,
                    ),
                  );
                },
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: widget.selected 
                            ? widget.activeColor.withValues(alpha: 0.12) 
                            : Colors.transparent,
                      ),
                      child: Icon(
                        widget.icon,
                        color: widget.selected ? widget.activeColor : ViaColors.textSecondary,
                        size: iconSize,
                      ),
                    ),
                    if (widget.badge)
                      Positioned(
                        right: badgeOffset,
                        top: badgeOffset,
                        child: Container(
                          width: badgeSize,
                          height: badgeSize,
                          decoration: const BoxDecoration(
                            color: _dorado,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 2),
              Text(
                widget.label,
                style: TextStyle(
                  color: widget.selected ? widget.activeColor : ViaColors.textMuted,
                  fontWeight: widget.selected ? FontWeight.w800 : FontWeight.w600,
                  fontSize: fontSize,
                  letterSpacing: -0.1,
                ),
                maxLines: 1,
                overflow: TextOverflow.fade,
                softWrap: false,
              ),
              const SizedBox(height: 2),
              SizedBox(
                height: 4,
                child: widget.selected
                    ? AnimatedBuilder(
                        animation: _selectAnim,
                        builder: (context, _) {
                          return Container(
                            width: 4.0 * _selectAnim.value,
                            height: 4.0 * _selectAnim.value,
                            decoration: BoxDecoration(
                              color: widget.activeColor,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: widget.activeColor.withValues(alpha: 0.4),
                                  blurRadius: 3,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                          );
                        },
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
