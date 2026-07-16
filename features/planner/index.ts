export {
  planTrip,
  type Coordinate,
  type TripPlan,
  type TravelSegment,
  type PlannerPreferences,
} from '@/lib/routing/planner';
export {
  loadPublishedRoutes,
  loadPublishedShapes,
  loadShapesForRouteIds,
  loadShapesNearTrip,
  prefetchAllShapesInBackground,
  type PublishedShape,
  type PublishedRouteMeta,
} from '@/lib/routing/load-published-shapes';
export { bboxFromOriginDest, filterShapesByBBox } from '@/lib/routing/bbox';
export {
  sortTripPlans,
  formatDurationSec,
  formatWalkMeters,
  planSummaryLabel,
  transferCount,
  type PlanSortMode,
  WALK_SPEED_MPS,
  TRANSIT_SPEED_MPS,
} from '@/lib/trip/format';
export {
  buildTripShareUrl,
  clearTripShareParamsFromLocation,
  hasTripShareParams,
  readTripUrlState,
  shareOrCopyTripUrl,
  parseCoordParam,
  copyTextToClipboard,
  fingerprintForPlan,
  primaryRouteIdFromPlan,
  matchPlanIndex,
  type TripUrlState,
} from '@/lib/trip/url-state';
export {
  applyDeepLink,
  normalizeDeepLinkToPath,
  parseDeepLink,
  subscribeNativeDeepLinks,
  DEEP_LINK_EVENT,
  type DeepLinkDetail,
} from '@/lib/trip/deep-link';
