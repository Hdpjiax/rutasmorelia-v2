import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:share_plus/share_plus.dart';
import '../models/place_model.dart';
import '../models/route_model.dart';
import '../models/segment_model.dart';
import '../models/trip_plan_model.dart';
import '../services/api_client.dart';
import '../services/connectivity_service.dart';
import '../services/deep_link_service.dart';
import '../services/favorites_store.dart';
import '../services/location_service.dart';
import '../services/place_search_service.dart';
import '../services/planner_isolate.dart';
import '../services/routing_engine.dart';
import '../services/shape_index_service.dart';
import '../gis/walk_navigation.dart';
import '../services/share_service.dart';
import '../services/speech_service.dart';
import '../services/transport_classify.dart';
import '../services/walk_route_service.dart';
import '../services/tile_server.dart';
import '../services/local_db_service.dart';
import '../services/voice_guide_service.dart';

enum AppPanel { none, trip, routes, favorites, legal, search }

enum LegalTab { terms, privacy }

enum PlanFilter { all, direct, transfer }

enum PlanSort { time, walk, transfers }

enum RouteDirectionFilter { both, ida, vuelta }

enum PinDropMode { none, origin, destination }

enum TrackingSegment { walkToBoard, ride, walkToDest, done }

@immutable
class AppUiState {
  final bool bootstrapped;
  final double loadProgress;
  final String? loadError;
  final bool showWelcome;
  final bool searchCollapsed;
  final bool bottomCollapsed;
  final AppPanel panel;
  final LegalTab legalTab;
  final PlaceModel? origin;
  final PlaceModel? destination;
  final LatLng? userPosition;
  final bool gpsLive;
  final bool locating;
  final String? gpsMessage;
  final List<TripPlanModel> plans;
  final bool planning;
  final double planningProgress;
  final String? planningError;
  final int selectedPlanIndex;
  final PlanFilter planFilter;
  final PlanSort planSort;
  final RouteMetaModel? selectedRoute;
  final RouteDirectionFilter routeDirection;
  final String routeQuery;
  final String transportFilter; // all | combi | autobus
  final bool onlyFavoriteRoutes;
  final List<PlaceModel> favoritePlaces;
  final List<String> favoriteRouteIds;
  final List<PlaceModel> recentPlaces;
  final PlaceModel? home;
  final PlaceModel? work;
  final bool tracking;
  final bool nearAlight;
  final bool followCamera;
  final TrackingSegment trackingSegment;
  /// 0–1 avance estimado en el tramo actual (caminata o ride).
  final double trackingProgress;
  /// Metros al siguiente hito (subida, bajada o destino).
  final double metersToNext;
  final String? trackingLabel;
  /// Punto proyectado sobre la polyline del ride (seguimiento).
  final LatLng? projectedOnRoute;
  final List<WalkNavStep>? walkNavSteps;
  final WalkNavStep? currentNavStep;
  final double navStepProgress;
  final List<RouteShapeModel> mapShapes;
  final bool online;
  final PinDropMode pinDropMode;
  final String? bannerMessage;
  final int tileServerPort;
  final int tileServerMaxZoom;
  final String mapStyleUri;

  const AppUiState({
    this.bootstrapped = false,
    this.loadProgress = 0,
    this.loadError,
    this.showWelcome = false,
    this.searchCollapsed = false,
    this.bottomCollapsed = false,
    this.panel = AppPanel.none,
    this.legalTab = LegalTab.privacy,
    this.origin,
    this.destination,
    this.userPosition,
    this.gpsLive = false,
    this.locating = false,
    this.gpsMessage,
    this.plans = const [],
    this.planning = false,
    this.planningProgress = 0,
    this.planningError,
    this.selectedPlanIndex = 0,
    this.planFilter = PlanFilter.all,
    this.planSort = PlanSort.time,
    this.selectedRoute,
    this.routeDirection = RouteDirectionFilter.both,
    this.routeQuery = '',
    this.transportFilter = 'all',
    this.onlyFavoriteRoutes = false,
    this.favoritePlaces = const [],
    this.favoriteRouteIds = const [],
    this.recentPlaces = const [],
    this.home,
    this.work,
    this.tracking = false,
    this.nearAlight = false,
    this.followCamera = true,
    this.trackingSegment = TrackingSegment.walkToBoard,
    this.trackingProgress = 0,
    this.metersToNext = 0,
    this.trackingLabel,
    this.projectedOnRoute,
    this.walkNavSteps,
    this.currentNavStep,
    this.navStepProgress = 0,
    this.mapShapes = const [],
    this.online = true,
    this.pinDropMode = PinDropMode.none,
    this.bannerMessage,
    this.tileServerPort = 0,
    this.tileServerMaxZoom = 14,
    this.mapStyleUri = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  });

  TripPlanModel? get selectedPlan {
    if (plans.isEmpty || selectedPlanIndex < 0 || selectedPlanIndex >= plans.length) {
      return null;
    }
    return plans[selectedPlanIndex];
  }

  List<TripPlanModel> get filteredPlans {
    var list = plans.toList();
    if (planFilter == PlanFilter.direct) {
      list = list.where((p) => p.type == TripPlanType.direct).toList();
    } else if (planFilter == PlanFilter.transfer) {
      list = list.where((p) => p.type == TripPlanType.transfer).toList();
    }
    list = _sortTripPlans(list, planSort);
    return list;
  }

  static List<TripPlanModel> _sortTripPlans(List<TripPlanModel> plans, PlanSort mode) {
    final copy = [...plans];
    int xfer(TripPlanModel p) =>
        (p.segments.where((s) => s.type == SegmentType.ride).length - 1).clamp(0, 99);

    copy.sort((a, b) {
      if (mode == PlanSort.walk) {
        if ((a.walkDistanceTotal - b.walkDistanceTotal).abs() > 25) {
          return a.walkDistanceTotal.compareTo(b.walkDistanceTotal);
        }
        return a.totalDuration.compareTo(b.totalDuration);
      }
      if (mode == PlanSort.transfers) {
        final ta = xfer(a);
        final tb = xfer(b);
        if (ta != tb) return ta.compareTo(tb);
        if ((a.walkDistanceTotal - b.walkDistanceTotal).abs() > 40) {
          return a.walkDistanceTotal.compareTo(b.walkDistanceTotal);
        }
        return a.totalDuration.compareTo(b.totalDuration);
      }
      if ((a.totalDuration - b.totalDuration).abs() > 45) {
        return a.totalDuration.compareTo(b.totalDuration);
      }
      if (xfer(a) != xfer(b)) return xfer(a).compareTo(xfer(b));
      return a.walkDistanceTotal.compareTo(b.walkDistanceTotal);
    });
    return copy;
  }

  AppUiState copyWith({
    bool? bootstrapped,
    double? loadProgress,
    String? loadError,
    bool clearLoadError = false,
    bool? showWelcome,
    bool? searchCollapsed,
    bool? bottomCollapsed,
    AppPanel? panel,
    LegalTab? legalTab,
    PlaceModel? origin,
    PlaceModel? destination,
    bool clearOrigin = false,
    bool clearDestination = false,
    LatLng? userPosition,
    bool? gpsLive,
    bool? locating,
    String? gpsMessage,
    bool clearGpsMessage = false,
    List<TripPlanModel>? plans,
    bool? planning,
    double? planningProgress,
    String? planningError,
    bool clearPlanningError = false,
    int? selectedPlanIndex,
    PlanFilter? planFilter,
    PlanSort? planSort,
    RouteMetaModel? selectedRoute,
    bool clearSelectedRoute = false,
    RouteDirectionFilter? routeDirection,
    String? routeQuery,
    String? transportFilter,
    bool? onlyFavoriteRoutes,
    List<PlaceModel>? favoritePlaces,
    List<String>? favoriteRouteIds,
    List<PlaceModel>? recentPlaces,
    PlaceModel? home,
    PlaceModel? work,
    bool clearHome = false,
    bool clearWork = false,
    bool? tracking,
    bool? nearAlight,
    bool? followCamera,
    TrackingSegment? trackingSegment,
    double? trackingProgress,
    double? metersToNext,
    String? trackingLabel,
    bool clearTrackingLabel = false,
    LatLng? projectedOnRoute,
    bool clearProjected = false,
    List<WalkNavStep>? walkNavSteps,
    bool clearWalkNavSteps = false,
    WalkNavStep? currentNavStep,
    double? navStepProgress,
    List<RouteShapeModel>? mapShapes,
    bool? online,
    PinDropMode? pinDropMode,
    String? bannerMessage,
    bool clearBanner = false,
    int? tileServerPort,
    int? tileServerMaxZoom,
    String? mapStyleUri,
  }) {
    return AppUiState(
      bootstrapped: bootstrapped ?? this.bootstrapped,
      loadProgress: loadProgress ?? this.loadProgress,
      loadError: clearLoadError ? null : (loadError ?? this.loadError),
      showWelcome: showWelcome ?? this.showWelcome,
      searchCollapsed: searchCollapsed ?? this.searchCollapsed,
      bottomCollapsed: bottomCollapsed ?? this.bottomCollapsed,
      panel: panel ?? this.panel,
      legalTab: legalTab ?? this.legalTab,
      origin: clearOrigin ? null : (origin ?? this.origin),
      destination: clearDestination ? null : (destination ?? this.destination),
      userPosition: userPosition ?? this.userPosition,
      gpsLive: gpsLive ?? this.gpsLive,
      locating: locating ?? this.locating,
      gpsMessage: clearGpsMessage ? null : (gpsMessage ?? this.gpsMessage),
      plans: plans ?? this.plans,
      planning: planning ?? this.planning,
      planningProgress: planningProgress ?? this.planningProgress,
      planningError: clearPlanningError ? null : (planningError ?? this.planningError),
      selectedPlanIndex: selectedPlanIndex ?? this.selectedPlanIndex,
      planFilter: planFilter ?? this.planFilter,
      planSort: planSort ?? this.planSort,
      selectedRoute: clearSelectedRoute ? null : (selectedRoute ?? this.selectedRoute),
      routeDirection: routeDirection ?? this.routeDirection,
      routeQuery: routeQuery ?? this.routeQuery,
      transportFilter: transportFilter ?? this.transportFilter,
      onlyFavoriteRoutes: onlyFavoriteRoutes ?? this.onlyFavoriteRoutes,
      favoritePlaces: favoritePlaces ?? this.favoritePlaces,
      favoriteRouteIds: favoriteRouteIds ?? this.favoriteRouteIds,
      recentPlaces: recentPlaces ?? this.recentPlaces,
      home: clearHome ? null : (home ?? this.home),
      work: clearWork ? null : (work ?? this.work),
      tracking: tracking ?? this.tracking,
      nearAlight: nearAlight ?? this.nearAlight,
      followCamera: followCamera ?? this.followCamera,
      trackingSegment: trackingSegment ?? this.trackingSegment,
      trackingProgress: trackingProgress ?? this.trackingProgress,
      metersToNext: metersToNext ?? this.metersToNext,
      trackingLabel: clearTrackingLabel ? null : (trackingLabel ?? this.trackingLabel),
      projectedOnRoute: clearProjected ? null : (projectedOnRoute ?? this.projectedOnRoute),
      walkNavSteps: clearWalkNavSteps ? null : (walkNavSteps ?? this.walkNavSteps),
      currentNavStep: currentNavStep ?? this.currentNavStep,
      navStepProgress: navStepProgress ?? this.navStepProgress,
      mapShapes: mapShapes ?? this.mapShapes,
      online: online ?? this.online,
      pinDropMode: pinDropMode ?? this.pinDropMode,
      bannerMessage: clearBanner ? null : (bannerMessage ?? this.bannerMessage),
      tileServerPort: tileServerPort ?? this.tileServerPort,
      tileServerMaxZoom: tileServerMaxZoom ?? this.tileServerMaxZoom,
      mapStyleUri: mapStyleUri ?? this.mapStyleUri,
    );
  }
}

final apiClientProvider = Provider((ref) => ApiClient());
final shapeIndexProvider = Provider((ref) => ShapeIndexService(api: ref.watch(apiClientProvider)));
final locationServiceProvider = Provider((ref) => LocationService());
final placeSearchProvider = Provider((ref) => PlaceSearchService(api: ref.watch(apiClientProvider)));
final routingEngineProvider = Provider((ref) => RoutingEngine());
final walkRouteProvider = Provider((ref) => WalkRouteService(api: ref.watch(apiClientProvider)));
final favoritesStoreProvider = Provider((ref) => FavoritesStore());
final speechServiceProvider = Provider((ref) => SpeechService());
final shareServiceProvider = Provider((ref) => ShareService());
final connectivityProvider = Provider((ref) => ConnectivityService());
final deepLinkServiceProvider = Provider((ref) => DeepLinkService());

final appControllerProvider =
    StateNotifierProvider<AppController, AppUiState>((ref) => AppController(ref));

class AppController extends StateNotifier<AppUiState> {
  AppController(this._ref) : super(const AppUiState());

  final Ref _ref;
  StreamSubscription<LatLng>? _gpsSub;
  StreamSubscription<bool>? _netSub;
  StreamSubscription<TripDeepLink>? _linkSub;
  int _planToken = 0;
  DateTime _lastCameraMove = DateTime.fromMillisecondsSinceEpoch(0);
  DateTime _lastGpsUiPush = DateTime.fromMillisecondsSinceEpoch(0);
  LatLng? _pendingGps;
  TileServer? _tileServer;

  ShapeIndexService get _index => _ref.read(shapeIndexProvider);
  LocationService get _location => _ref.read(locationServiceProvider);
  PlaceSearchService get _search => _ref.read(placeSearchProvider);
  RoutingEngine get _engine => _ref.read(routingEngineProvider);
  WalkRouteService get _walk => _ref.read(walkRouteProvider);
  FavoritesStore get _favs => _ref.read(favoritesStoreProvider);
  ShareService get _share => _ref.read(shareServiceProvider);
  ApiClient get _api => _ref.read(apiClientProvider);
  ConnectivityService get _net => _ref.read(connectivityProvider);
  DeepLinkService get _deep => _ref.read(deepLinkServiceProvider);

  Future<void> bootstrap() async {
    final welcomeSeen = await _favs.getWelcomeSeen();
    final favoritePlaces = await _favs.getFavoriteLocations();
    final favoriteRoutes = await _favs.getFavoriteRouteIds();
    final recent = await _favs.getRecentPlaces();
    final home = await _favs.getHome();
    final work = await _favs.getWork();

    await _net.start();
    _netSub = _net.onlineStream.listen((online) async {
      String styleUri = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
      if (!online && _tileServer != null && _tileServer!.port > 0) {
        try {
          final localDb = LocalDbService();
          final basemapPmtilesPath = await localDb.getLocalBasemapPmtilesPath();
          final basemapFile = File(basemapPmtilesPath);
          if (await basemapFile.exists()) {
            final rawStyle = await rootBundle.loadString('assets/map/local_style.json');
            final filledStyle = rawStyle.replaceAll('{{PORT}}', _tileServer!.port.toString());
            final base64Style = base64Encode(utf8.encode(filledStyle));
            styleUri = 'data:application/json;base64,$base64Style';
          }
        } catch (e) {
          debugPrint('Error actualizando estilo offline en red callback: $e');
        }
      }

      state = state.copyWith(
        online: online,
        bannerMessage: online ? null : 'Sin conexión · catálogo local y geocode limitados',
        clearBanner: online,
        mapStyleUri: styleUri,
      );
      _api.telemetry(online ? 'online' : 'offline');
    });

    state = state.copyWith(
      showWelcome: !welcomeSeen,
      favoritePlaces: favoritePlaces,
      favoriteRouteIds: favoriteRoutes,
      recentPlaces: recent,
      home: home,
      work: work,
      online: _net.isOnline,
      loadProgress: 0.2,
    );

    // Verify assets version and clear cache if changed BEFORE copying PMTiles
    try {
      final localDb = LocalDbService();
      final assetIndexJson = await rootBundle.loadString('assets/routes/index.json');
      final assetHash = ShapeIndexService.generateSimpleHash(assetIndexJson);
      final cachedHash = await localDb.getCachedAssetsVersion();
      if (cachedHash != assetHash) {
        await localDb.clearCache();
        await localDb.setCachedAssetsVersion(assetHash);
      }
    } catch (e) {
      debugPrint('Error verifying assets version on bootstrap: $e');
    }

    // Extract PMTiles and start local TileServer
    try {
      final localDb = LocalDbService();
      final routesPmtilesPath = await localDb.getLocalPmtilesPath();
      final basemapPmtilesPath = await localDb.getLocalBasemapPmtilesPath();
      _tileServer = TileServer(
        routesPmtilesPath: routesPmtilesPath,
        basemapPmtilesPath: basemapPmtilesPath,
      );
      await _tileServer!.start();

      final port = _tileServer!.port;
      String styleUri = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

      if (!_net.isOnline && port > 0) {
        try {
          final basemapFile = File(basemapPmtilesPath);
          if (await basemapFile.exists()) {
            final rawStyle = await rootBundle.loadString('assets/map/local_style.json');
            final filledStyle = rawStyle.replaceAll('{{PORT}}', port.toString());
            final base64Style = base64Encode(utf8.encode(filledStyle));
            styleUri = 'data:application/json;base64,$base64Style';
          }
        } catch (e) {
          debugPrint('Error preparando estilo offline al inicio: $e');
        }
      }

      state = state.copyWith(
        tileServerPort: port,
        tileServerMaxZoom: _tileServer!.maxZoom,
        mapStyleUri: styleUri,
      );
    } catch (e) {
      debugPrint('Failed to extract or start TileServer: $e');
    }

    // Catálogo rápido (sin shapes) → mapa usable al instante
    await _index.initialize(onProgress: (p) {
      state = state.copyWith(loadProgress: 0.2 + p * 0.6);
    });

    state = state.copyWith(
      bootstrapped: true,
      loadProgress: 1,
      loadError: _index.error,
    );

    unawaited(_api.telemetry('app_open'));
    unawaited(_index.precacheSubset(favoriteRoutes, sample: 8));

    // Deep links
    final initial = await _deep.getInitial();
    if (initial != null && initial.hasTrip) {
      await applyDeepLink(initial);
    } else {
      // Restaurar último viaje solo si no hay deep link
      final last = await _favs.getLastTrip();
      if (last != null && !welcomeSeen) {
        // silent restore only metadata in recents; no auto-plan on every open
      }
    }

    _linkSub = _deep.listen().listen((link) {
      unawaited(applyDeepLink(link));
    });

    unawaited(requestGps(setAsOrigin: true, startLive: true));
  }

  Future<void> applyDeepLink(TripDeepLink link) async {
    await dismissWelcome();

    // Viaje compartido (OD): NO abrir explorador de ruta suelta antes de planear.
    final hasOd = link.origin != null && link.destination != null;

    if (link.origin != null) {
      await setOrigin(
        PlaceModel(
          id: 'dl-origin',
          name: link.originLabel ?? 'Origen compartido',
          category: 'share',
          coordinates: link.origin!,
          source: PlaceSource.geocode,
        ),
        plan: false,
      );
    }
    if (link.destination != null) {
      await setDestination(
        PlaceModel(
          id: 'dl-dest',
          name: link.destinationLabel ?? 'Destino compartido',
          category: 'share',
          coordinates: link.destination!,
          source: PlaceSource.geocode,
        ),
        plan: false,
      );
    }

    if (hasOd) {
      await replan(
        preferredPlanIndex: link.planIndex,
        preferredRouteId: link.routeId,
        preferredFingerprint: link.routesFingerprint,
      );
    } else if (link.routeId != null) {
      final meta = catalog.where((r) => r.id == link.routeId).toList();
      if (meta.isNotEmpty) await selectRoute(meta.first);
    }
    unawaited(_api.telemetry('deep_link_open'));
  }

  Future<void> dismissWelcome() async {
    await _favs.setWelcomeSeen(true);
    state = state.copyWith(showWelcome: false);
  }

  void setPanel(AppPanel panel) {
    state = state.copyWith(
      panel: panel,
      routeQuery: panel == AppPanel.routes ? '' : null,
      searchCollapsed: panel == AppPanel.none ? false : null,
    );
  }
  void togglePanel(AppPanel panel) {
    final opening = state.panel != panel;
    state = state.copyWith(
      panel: state.panel == panel ? AppPanel.none : panel,
      routeQuery: opening && panel == AppPanel.routes ? '' : null,
      searchCollapsed: !opening ? false : null,
    );
  }
  void setSearchCollapsed(bool v) => state = state.copyWith(searchCollapsed: v);
  void setBottomCollapsed(bool v) => state = state.copyWith(bottomCollapsed: v);
  void setLegalTab(LegalTab t) => state = state.copyWith(legalTab: t, panel: AppPanel.legal);
  void setRouteQuery(String q) => state = state.copyWith(routeQuery: q);
  void setTransportFilter(String f) => state = state.copyWith(transportFilter: f);
  void setOnlyFavoriteRoutes(bool v) => state = state.copyWith(onlyFavoriteRoutes: v);
  void setPlanFilter(PlanFilter f) => state = state.copyWith(planFilter: f);
  void setPlanSort(PlanSort s) => state = state.copyWith(planSort: s);
  void setRouteDirection(RouteDirectionFilter d) {
    state = state.copyWith(routeDirection: d);
    _refreshMapShapesForExplorer();
  }

  void setPinDropMode(PinDropMode m) => state = state.copyWith(pinDropMode: m);

  void applyPinDrop(LatLng point) {
    final place = PlaceModel(
      id: 'pin-${point.latitude}-${point.longitude}',
      name: '${point.latitude.toStringAsFixed(5)}, ${point.longitude.toStringAsFixed(5)}',
      description: 'Punto en el mapa',
      category: 'pin',
      coordinates: point,
      source: PlaceSource.geocode,
    );
    if (state.pinDropMode == PinDropMode.origin ||
        (state.pinDropMode == PinDropMode.none && state.origin == null)) {
      setOrigin(place);
      state = state.copyWith(pinDropMode: PinDropMode.none);
    } else {
      setDestination(place);
      state = state.copyWith(pinDropMode: PinDropMode.none);
    }
  }

  Future<void> requestGps({bool setAsOrigin = false, bool startLive = false}) async {
    state = state.copyWith(locating: true, clearGpsMessage: true);
    final result = await _location.getCurrentLocation();
    state = state.copyWith(
      locating: false,
      userPosition: result.coordinates,
      gpsMessage: result.errorMessage,
    );
    if (result.fromDevice && setAsOrigin) {
      await setOrigin(
        PlaceModel(
          id: 'gps-live',
          name: 'Mi ubicación',
          description: 'GPS actual',
          category: 'gps',
          coordinates: result.coordinates,
          source: PlaceSource.gps,
        ),
        plan: state.destination != null,
      );
    }
    if (startLive && result.fromDevice) startLiveGps();
    unawaited(_api.telemetry('gps_request', {'ok': result.fromDevice}));
  }

  void startLiveGps() {
    _gpsSub?.cancel();
    state = state.copyWith(gpsLive: true);
    // Throttle: el stream de GPS puede llegar a 1 Hz+, pero no hace falta
    // reconstruir toda la UI en cada tick.
    _gpsSub = _location.getPositionStream().listen((pos) {
      final now = DateTime.now();
      _pendingGps = pos;

      final minMs = state.tracking ? 700 : 1200;
      if (now.difference(_lastGpsUiPush).inMilliseconds < minMs) {
        return;
      }
      _lastGpsUiPush = now;
      final p = _pendingGps ?? pos;

      if (state.tracking && state.selectedPlan != null) {
        _updateTrackingProgress(p, state.selectedPlan!);
      } else {
        state = state.copyWith(userPosition: p);
      }

      if (state.tracking &&
          state.followCamera &&
          now.difference(_lastCameraMove).inMilliseconds > 1200) {
        _lastCameraMove = now;
      }
    });
  }

  void _updateTrackingProgress(LatLng pos, TripPlanModel plan) {
    final board = plan.boardingPoint;
    final alight = plan.alightingPoint;
    final dest = state.destination?.coordinates ?? alight;
    final origin = state.origin?.coordinates ?? board;
    final dBoard = _engine.getHaversineDistance(pos, board);
    final dAlight = _engine.getHaversineDistance(pos, alight);
    final dDest = _engine.getHaversineDistance(pos, dest);

    TrackingSegment seg = TrackingSegment.walkToBoard;
    if (dBoard < 90) seg = TrackingSegment.ride;
    // Si ya pasó la subida y se alejó del origen hacia alight
    if (dBoard > 120 && dAlight < dBoard * 3) seg = TrackingSegment.ride;
    if (dAlight < 120) seg = TrackingSegment.walkToDest;
    if (dDest < 60) seg = TrackingSegment.done;

    double metersToNext = dBoard;
    double progress = 0;
    String label = 'Camina al punto de subida';
    LatLng? projected;

    final ride = plan.segments.where((s) => s.type == SegmentType.ride).toList();
    final rideSeg = ride.isNotEmpty ? ride.first : null;
    final rideName = rideSeg?.routeName ?? 'ruta';
    final rideDir = rideSeg?.direction == 'vuelta' ? 'Vuelta' : 'Ida';

    // Walk nav computation
    List<WalkNavStep>? navSteps;
    WalkNavStep? curStep;
    double stepProg = 0;

    if (seg == TrackingSegment.walkToBoard) {
      metersToNext = dBoard;
      final total = _engine.getHaversineDistance(origin, board).clamp(1.0, 1e9);
      progress = (1 - (dBoard / total)).clamp(0.0, 1.0);
      label = 'Camina a subir · ${metersToNext.round()} m';

      for (final s in plan.segments) {
        if (s.type == SegmentType.walk && s.walkKind == WalkKind.toBoard && s.walkPath != null && s.walkPath!.length >= 2) {
          final path = s.walkPath!;
          navSteps = computeWalkNavSteps(path);
          if (navSteps.isNotEmpty) {
            final frac = _engine.projectPointOntoLineString(path, pos).fraction;
            for (var i = navSteps.length - 1; i >= 0; i--) {
              final stepFrac = navSteps[i].startIndex / (path.length - 1);
              if (frac >= stepFrac) {
                curStep = navSteps[i];
                if (i < navSteps.length - 1) {
                  final nextFrac = navSteps[i + 1].startIndex / (path.length - 1);
                  stepProg = ((frac - stepFrac) / (nextFrac - stepFrac)).clamp(0.0, 1.0);
                } else {
                  stepProg = 1.0;
                }
                break;
              }
            }
            if (curStep != null) {
              label = '${curStep.instruction} · ${curStep.distance.round()} m';
            }
          }
          break;
        }
      }
    } else if (seg == TrackingSegment.ride) {
      metersToNext = dAlight;
      // Proyectar sobre corredor del ride
      final shape = state.mapShapes.cast<RouteShapeModel?>().firstWhere(
            (s) =>
                s != null &&
                s.routeId == rideSeg?.routeId &&
                (rideSeg?.direction == null || s.direction == rideSeg!.direction),
            orElse: () => null,
          );
      if (shape != null && shape.coordinates.length >= 2) {
        try {
          final proj = _engine.projectPointOntoLineString(shape.coordinates, pos);
          projected = proj.closest;
          progress = proj.fraction.clamp(0.0, 1.0);
        } catch (_) {
          projected = pos;
        }
      }
      label = 'En $rideName ($rideDir) · ${metersToNext.round()} m a la bajada';
    } else if (seg == TrackingSegment.walkToDest) {
      metersToNext = dDest;
      final total = _engine.getHaversineDistance(alight, dest).clamp(1.0, 1e9);
      progress = (1 - (dDest / total)).clamp(0.0, 1.0);
      label = 'Camina al destino · ${metersToNext.round()} m';

      for (final s in plan.segments) {
        if (s.type == SegmentType.walk && s.walkKind == WalkKind.fromAlight && s.walkPath != null && s.walkPath!.length >= 2) {
          final path = s.walkPath!;
          navSteps = computeWalkNavSteps(path);
          if (navSteps.isNotEmpty) {
            final frac = _engine.projectPointOntoLineString(path, pos).fraction;
            for (var i = navSteps.length - 1; i >= 0; i--) {
              final stepFrac = navSteps[i].startIndex / (path.length - 1);
              if (frac >= stepFrac) {
                curStep = navSteps[i];
                if (i < navSteps.length - 1) {
                  final nextFrac = navSteps[i + 1].startIndex / (path.length - 1);
                  stepProg = ((frac - stepFrac) / (nextFrac - stepFrac)).clamp(0.0, 1.0);
                } else {
                  stepProg = 1.0;
                }
                break;
              }
            }
            if (curStep != null) {
              label = '${curStep.instruction} · ${curStep.distance.round()} m';
            }
          }
          break;
        }
      }
    } else {
      metersToNext = 0;
      progress = 1;
      label = 'Llegaste a tu destino';
    }

    final near = dAlight <= 150 && seg != TrackingSegment.walkToBoard;
    final bool isWalk = seg == TrackingSegment.walkToBoard || seg == TrackingSegment.walkToDest;
    final bool clearNav = !isWalk || navSteps == null;
    state = state.copyWith(
      trackingSegment: seg,
      nearAlight: near,
      trackingProgress: progress,
      metersToNext: metersToNext,
      trackingLabel: label,
      projectedOnRoute: projected,
      userPosition: pos,
      walkNavSteps: navSteps,
      clearWalkNavSteps: clearNav,
      currentNavStep: isWalk ? curStep : null,
      navStepProgress: isWalk ? stepProg : 0,
    );

    VoiceGuideService.instance.onTrackingUpdate(
      trackingSegment: seg.name,
      navInstruction: _navInstructionForSegment(seg, projected, dAlight, dBoard, dDest),
      metersToNext: metersToNext,
      nearAlight: near,
      routeName: rideSeg?.routeName,
      routeDirection: rideDir,
    );
  }

  String? _navInstructionForSegment(TrackingSegment seg, LatLng? projected, double dAlight, double dBoard, double dDest) {
    if ((seg == TrackingSegment.walkToBoard || seg == TrackingSegment.walkToDest) &&
        state.currentNavStep != null) {
      return state.currentNavStep!.instruction;
    }
    return null;
  }

  void stopLiveGps() {
    _gpsSub?.cancel();
    _gpsSub = null;
    state = state.copyWith(gpsLive: false, tracking: false, nearAlight: false);
  }

  Future<void> setOrigin(PlaceModel place, {bool plan = true}) async {
    state = state.copyWith(origin: place, clearSelectedRoute: true);
    await _pushRecent(place);
    if (plan) await replan();
  }

  Future<void> setDestination(PlaceModel place, {bool plan = true}) async {
    state = state.copyWith(destination: place, clearSelectedRoute: true);
    await _pushRecent(place);
    if (plan) await replan();
  }

  Future<void> swapOd() async {
    final o = state.origin;
    final d = state.destination;
    state = state.copyWith(
      origin: d,
      destination: o,
      clearOrigin: d == null,
      clearDestination: o == null,
    );
    await replan();
  }

  Future<void> clearSession() async {
    stopTracking();
    state = state.copyWith(
      clearOrigin: true,
      clearDestination: true,
      plans: const [],
      selectedPlanIndex: 0,
      clearSelectedRoute: true,
      mapShapes: const [],
      clearPlanningError: true,
      panel: AppPanel.none,
      bottomCollapsed: false,
      pinDropMode: PinDropMode.none,
    );
    unawaited(_api.telemetry('clear_session'));
  }

  Future<void> replan({
    int? preferredPlanIndex,
    String? preferredRouteId,
    String? preferredFingerprint,
  }) async {
    final o = state.origin;
    final d = state.destination;
    if (o == null || d == null) {
      state = state.copyWith(plans: const [], planning: false, mapShapes: const []);
      return;
    }
    if (!_index.isReady) {
      state = state.copyWith(planningError: 'Catálogo aún cargando…', planning: true);
      return;
    }

    final token = ++_planToken;
    state = state.copyWith(
      planning: true,
      planningProgress: 0.05,
      clearPlanningError: true,
      panel: AppPanel.trip,
      bottomCollapsed: false,
      clearSelectedRoute: true,
    );

    try {
      final shapes = await _index.loadShapesNearTrip(
        o.coordinates,
        d.coordinates,
        onProgress: (p) {
          if (token == _planToken) {
            state = state.copyWith(planningProgress: 0.05 + p * 0.45);
          }
        },
      );
      if (token != _planToken) return;

      state = state.copyWith(planningProgress: 0.55);
      final quick = await PlannerIsolate.plan(
        origin: o.coordinates,
        destination: d.coordinates,
        shapes: shapes,
      );
      if (token != _planToken) return;

      // Enrich with fare estimates
      final enriched = _enrichPlansWithFares(quick);

      final pick = ShareService.matchPlanIndex(
        enriched,
        fingerprint: preferredFingerprint,
        routeId: preferredRouteId,
        fallbackIndex: preferredPlanIndex ?? 0,
      );

      // Instant show (walks still straight)
      state = state.copyWith(
        plans: enriched,
        planning: false,
        planningProgress: 1,
        selectedPlanIndex: pick,
        mapShapes: _shapesForPlans(quick, shapes),
      );
      await _favs.saveLastTrip(o, d);
      unawaited(_api.telemetry('plan_ok', {'n': quick.length, 'pick': pick}));

      // OSRM: primero el plan elegido (rápido), luego el resto en background
      unawaited(_hydrateWalksAsync(token, enriched, shapes, priorityIndex: pick));
    } catch (e) {
      if (token != _planToken) return;
      state = state.copyWith(
        planning: false,
        planningError: 'No se pudieron calcular opciones: $e',
        plans: const [],
      );
      unawaited(_api.telemetry('plan_error'));
    }
  }

  Future<TripPlanModel> _hydrateOnePlan(TripPlanModel plan) async {
    final walkPairs = <(LatLng, LatLng)>[];
    final walkIdx = <int>[];
    for (var i = 0; i < plan.segments.length; i++) {
      final s = plan.segments[i];
      if (s.type == SegmentType.walk && s.walkFrom != null && s.walkTo != null) {
        walkPairs.add((s.walkFrom!, s.walkTo!));
        walkIdx.add(i);
      }
    }
    final paths = walkPairs.isEmpty
        ? <List<LatLng>>[]
        : await _walk.fetchMany(walkPairs, online: state.online);

    final segs = <TravelSegmentModel>[];
    var wi = 0;
    for (var i = 0; i < plan.segments.length; i++) {
      final s = plan.segments[i];
      if (wi < walkIdx.length && walkIdx[wi] == i) {
        segs.add(TravelSegmentModel(
          type: s.type,
          instruction: s.instruction,
          distance: s.distance,
          duration: s.duration,
          walkFrom: s.walkFrom,
          walkTo: s.walkTo,
          walkKind: s.walkKind,
          walkPath: paths[wi],
        ));
        wi++;
      } else {
        segs.add(s);
      }
    }
    final totalFare = segs.fold<double?>(null, (sum, s) {
      if (s.fare == null) return sum;
      return (sum ?? 0) + s.fare!;
    });

    return TripPlanModel(
      type: plan.type,
      segments: segs,
      boardingPoint: plan.boardingPoint,
      alightingPoint: plan.alightingPoint,
      totalDistance: plan.totalDistance,
      totalDuration: plan.totalDuration,
      walkDistanceTotal: plan.walkDistanceTotal,
      totalFare: totalFare,
    );
  }

  Future<void> _hydrateWalksAsync(
    int token,
    List<TripPlanModel> plans,
    List<RouteShapeModel> shapes, {
    int priorityIndex = 0,
  }) async {
    if (plans.isEmpty) return;
    final pi = priorityIndex.clamp(0, plans.length - 1);

    // 1) Prioridad: plan seleccionado (UI inmediata)
    final first = await _hydrateOnePlan(plans[pi]);
    if (token != _planToken) return;
    final mid = [...plans];
    mid[pi] = first;
    state = state.copyWith(
      plans: mid,
      mapShapes: _shapesForPlans(mid, shapes),
    );

    // 2) Resto en paralelo por plan (caché evita re-fetch)
    final restIdx = <int>[];
    for (var i = 0; i < plans.length; i++) {
      if (i != pi) restIdx.add(i);
    }
    final rest = await Future.wait(restIdx.map((i) => _hydrateOnePlan(plans[i])));
    if (token != _planToken) return;
    final full = [...mid];
    for (var j = 0; j < restIdx.length; j++) {
      full[restIdx[j]] = rest[j];
    }
    state = state.copyWith(
      plans: full,
      mapShapes: _shapesForPlans(full, shapes),
    );
  }

  List<RouteShapeModel> _shapesForPlans(
    List<TripPlanModel> plans,
    List<RouteShapeModel> pool,
  ) {
    final ids = <String>{};
    for (final p in plans) {
      for (final s in p.segments) {
        if (s.routeId != null) ids.add(s.routeId!);
      }
    }
    return pool.where((s) => ids.contains(s.routeId)).toList();
  }

  double _estimateFare(String? transportType) {
    return 10.0;
  }

  String? _transportTypeForRoute(String? routeId) {
    if (routeId == null) return null;
    try {
      return _index.catalog.firstWhere((r) => r.id == routeId).transportType;
    } catch (_) {
      return null;
    }
  }

  List<TripPlanModel> _enrichPlansWithFares(List<TripPlanModel> plans) {
    return plans.map((plan) {
      final segs = plan.segments.map((s) {
        if (s.type == SegmentType.ride) {
          final tt = _transportTypeForRoute(s.routeId);
          final fare = _estimateFare(tt);
          return TravelSegmentModel(
            type: s.type,
            instruction: s.instruction,
            distance: s.distance,
            duration: s.duration,
            routeId: s.routeId,
            routeName: s.routeName,
            color: s.color,
            direction: s.direction,
            boardingPoint: s.boardingPoint,
            alightingPoint: s.alightingPoint,
            walkFrom: s.walkFrom,
            walkTo: s.walkTo,
            walkKind: s.walkKind,
            walkPath: s.walkPath,
            fare: fare,
          );
        }
        return s;
      }).toList();

      final totalFare = segs.fold<double?>(null, (sum, s) {
        if (s.fare == null) return sum;
        return (sum ?? 0) + s.fare!;
      });

      return TripPlanModel(
        type: plan.type,
        segments: segs,
        boardingPoint: plan.boardingPoint,
        alightingPoint: plan.alightingPoint,
        totalDistance: plan.totalDistance,
        totalDuration: plan.totalDuration,
        walkDistanceTotal: plan.walkDistanceTotal,
        totalFare: totalFare,
      );
    }).toList();
  }

  void selectPlan(int index) {
    if (index < 0 || index >= state.plans.length) return;
    state = state.copyWith(
      selectedPlanIndex: index,
      bottomCollapsed: true,
      clearSelectedRoute: true,
      panel: AppPanel.none,
      searchCollapsed: true,
    );
    unawaited(_api.telemetry('select_plan', {'i': index}));
  }

  Future<void> selectRoute(RouteMetaModel meta) async {
    final shapes = await _index.ensureShapesForRoute(meta.id);
    state = state.copyWith(
      selectedRoute: meta,
      mapShapes: shapes,
      plans: const [],
      panel: AppPanel.none,
      bottomCollapsed: false,
      searchCollapsed: true,
    );
    unawaited(_api.telemetry('select_route', {'id': meta.id}));
  }

  void _refreshMapShapesForExplorer() {
    final id = state.selectedRoute?.id;
    if (id == null) return;
    // Shapes raw; el canvas aplica toCorridorDisplay + filtro de dirección.
    state = state.copyWith(mapShapes: _index.shapesForRoute(id));
  }

  void clearSelectedRoute() {
    state = state.copyWith(
      clearSelectedRoute: true,
      mapShapes: state.selectedPlan != null
          ? _shapesForPlans([state.selectedPlan!], state.mapShapes)
          : const [],
    );
  }

  Future<List<PlaceModel>> searchPlaces(String query) async {
    try {
      return await _search.search(
        query,
        online: state.online,
        favorites: state.favoritePlaces,
      );
    } on ApiException catch (e) {
      state = state.copyWith(bannerMessage: e.message);
      return _search.search(query, online: false, favorites: state.favoritePlaces);
    }
  }

  Future<void> toggleFavoritePlace(PlaceModel place) async {
    final key = _placeKey(place);
    final list = [...state.favoritePlaces];
    final idx = list.indexWhere((p) => _placeKey(p) == key);
    if (idx >= 0) {
      list.removeAt(idx);
    } else {
      list.insert(0, place.copyWith(isFavorite: true, source: PlaceSource.favorite));
    }
    state = state.copyWith(favoritePlaces: list);
    await _favs.saveFavoriteLocations(list);
  }

  Future<void> toggleFavoriteRoute(String routeId) async {
    final list = [...state.favoriteRouteIds];
    if (list.contains(routeId)) {
      list.remove(routeId);
    } else {
      list.add(routeId);
    }
    state = state.copyWith(favoriteRouteIds: list);
    await _favs.saveFavoriteRouteIds(list);
    unawaited(_index.precacheSubset(list, sample: 0));
  }

  Future<void> setHome(PlaceModel? place) async {
    state = state.copyWith(home: place, clearHome: place == null);
    await _favs.setHome(place);
  }

  Future<void> setWork(PlaceModel? place) async {
    state = state.copyWith(work: place, clearWork: place == null);
    await _favs.setWork(place);
  }

  Future<void> _pushRecent(PlaceModel place) async {
    if (place.source == PlaceSource.gps) return;
    final list = [
      place,
      ...state.recentPlaces.where((p) => _placeKey(p) != _placeKey(place)),
    ].take(12).toList();
    state = state.copyWith(recentPlaces: list);
    await _favs.saveRecentPlaces(list);
  }

  String _placeKey(PlaceModel p) =>
      '${p.name.toLowerCase()}|${p.coordinates.latitude.toStringAsFixed(4)}|${p.coordinates.longitude.toStringAsFixed(4)}';

  void startTracking() {
    if (state.selectedPlan == null) return;
    VoiceGuideService.instance.reset();
    if (!state.gpsLive) startLiveGps();
    state = state.copyWith(
      tracking: true,
      nearAlight: false,
      bottomCollapsed: true,
      followCamera: true,
      trackingSegment: TrackingSegment.walkToBoard,
      trackingProgress: 0,
      metersToNext: 0,
      trackingLabel: 'Iniciando seguimiento…',
      walkNavSteps: null,
      clearWalkNavSteps: true,
      currentNavStep: null,
      navStepProgress: 0,
    );
    final pos = state.userPosition;
    if (pos != null) _updateTrackingProgress(pos, state.selectedPlan!);
    unawaited(_api.telemetry('track_start'));
  }

  void stopTracking() {
    VoiceGuideService.instance.reset();
    state = state.copyWith(
      tracking: false,
      nearAlight: false,
      trackingProgress: 0,
      metersToNext: 0,
      clearTrackingLabel: true,
      clearProjected: true,
      clearWalkNavSteps: true,
      currentNavStep: null,
      navStepProgress: 0,
    );
  }

  Future<void> shareCurrentTrip() async {
    final plan = state.selectedPlan;
    final fp = plan != null ? ShareService.fingerprintForPlan(plan) : null;
    final rid = plan != null ? ShareService.primaryRouteId(plan) : null;
    await _share.shareTrip(
      origin: state.origin,
      destination: state.destination,
      planIndex: state.selectedPlanIndex,
      routeId: rid,
      routesFingerprint: fp,
    );
    unawaited(_api.telemetry('share_trip', {
      'plan': state.selectedPlanIndex,
      'routes': fp,
    }));
  }

  Future<void> shareTrip() async {
    final plan = state.selectedPlan;
    final origin = state.origin;
    final dest = state.destination;
    if (plan == null || origin == null || dest == null) return;

    final routeNames = plan.segments
      .where((s) => s.type == SegmentType.ride && s.routeName != null)
      .map((s) => s.routeName!)
      .toList();

    final text = '🚌 ViaMorelia\n\n'
        'De: ${origin.name}\n'
        'A: ${dest.name}\n'
        'Ruta(s): ${routeNames.join(" → ")}\n'
        'Duración: ${plan.totalDurationMinutes} min\n'
        'Distancia: ${(plan.totalDistance / 1000).toStringAsFixed(1)} km\n\n'
        'Planeado con ViaMorelia — transporte público en Morelia, sin paradas oficiales.';

    await Share.share(text, subject: 'Mi viaje en ViaMorelia');
  }

  Future<bool> reportRoute(String reason, {String? note}) async {
    final id = state.selectedRoute?.id ??
        state.selectedPlan?.segments
            .where((s) => s.routeId != null)
            .map((s) => s.routeId!)
            .firstOrNull;
    if (id == null) return false;
    final name = state.selectedRoute?.name ??
        state.selectedPlan?.segments
            .where((s) => s.routeName != null)
            .map((s) => s.routeName!)
            .firstOrNull;
    final ok = await _api.reportRoute(
      routeId: id,
      routeName: name,
      reason: reason,
      note: note,
    );
    unawaited(_api.telemetry('report_route', {'ok': ok, 'reason': reason}));
    return ok;
  }

  List<RouteMetaModel> get catalog => _index.catalog;

  List<RouteMetaModel> get filteredCatalog {
    final q = _normalizeRouteText(state.routeQuery);
    final list = _index.catalog.where((r) {
      // Solo rutas publicables (paridad web approved)
      if (!r.isPublished) return false;
      if (state.onlyFavoriteRoutes && !state.favoriteRouteIds.contains(r.id)) {
        return false;
      }
      final cls = TransportClassify.normalize(
        r.transportType,
        routeId: r.id,
        routeName: r.name,
      );
      if (state.transportFilter == 'combi' && cls != 'combi') return false;
      if (state.transportFilter == 'autobus' && cls != 'autobus') return false;
      return true;
    }).toList();

    if (q.isEmpty) return list;

    final scored = list.map((r) {
      final name = _normalizeRouteText(r.name);
      final id = _normalizeRouteText(r.id);
      final blob = _normalizeRouteText(r.display.searchBlob);

      double score = 0.0;
      if (name == q || id == q) {
        score += 500;
      } else if (name.startsWith(q) || id.startsWith(q)) {
        score += 320;
      } else if (name.contains(q) || id.contains(q) || blob.contains(q)) {
        score += 150;
      }

      final qTokens = q.split(RegExp(r'\s+')).where((w) => w.length >= 2);
      final nameTokens = name.split(RegExp(r'\s+')).where((w) => w.length >= 2);
      for (final qt in qTokens) {
        if (nameTokens.any((nt) => nt.startsWith(qt) || nt.contains(qt))) {
          score += 60;
        } else if (blob.contains(qt)) {
          score += 30;
        }
      }

      return MapEntry(r, score);
    }).where((e) => e.value > 0).toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return scored.map((e) => e.key).toList();
  }

  String _normalizeRouteText(String s) {
    return s
        .toLowerCase()
        .replaceAll(RegExp(r'[áàäâ]'), 'a')
        .replaceAll(RegExp(r'[éèëê]'), 'e')
        .replaceAll(RegExp(r'[íìïî]'), 'i')
        .replaceAll(RegExp(r'[óòöô]'), 'o')
        .replaceAll(RegExp(r'[úùüû]'), 'u')
        .replaceAll(RegExp(r'[ñ]'), 'n')
        .trim();
  }

  Future<void> restoreLastTrip() async {
    final last = await _favs.getLastTrip();
    if (last == null) return;
    await setOrigin(last.origin, plan: false);
    await setDestination(last.destination, plan: true);
  }

  @override
  void dispose() {
    _gpsSub?.cancel();
    _netSub?.cancel();
    _linkSub?.cancel();
    _tileServer?.stop();
    try {
      _ref.read(connectivityProvider).dispose();
    } catch (_) {}
    try {
      _ref.read(deepLinkServiceProvider).dispose();
    } catch (_) {}
    super.dispose();
  }
}
