// src/constants/api.js
// API base URLs from environment, and every endpoint path in the app.
// Sprint 1 paths are CONFIRMED against smartFactoryBackEndSpringBoot controllers.
// Anything still marked ASSUMED belongs to a later sprint.

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL;

/**
 * Endpoint path constants, grouped by resource.
 * Screens and hooks never hardcode paths — they come from here.
 */
export const ENDPOINTS = Object.freeze({
  // --- Auth (CONFIRMED Sprint 1 — AuthController) ---
  AUTH_LOGIN: "/api/auth/login", // CONFIRMED — returns { token, user }, no refresh token
  AUTH_REGISTER: "/api/auth/register", // CONFIRMED — 201 { message }, role defaults OPERATOR
  AUTH_VERIFY_EMAIL: "/api/auth/verify-email", // CONFIRMED — body { email, otp }
  AUTH_RESEND_VERIFICATION: "/api/auth/resend-verification", // CONFIRMED — body { email }
  AUTH_FORGOT_PASSWORD: "/api/auth/forgot-password", // CONFIRMED — always 200, body { email }
  AUTH_VERIFY_RESET_OTP: "/api/auth/verify-reset-otp", // CONFIRMED — body { email, otp } -> { message, resetToken }
  AUTH_RESET_PASSWORD: "/api/auth/reset-password", // CONFIRMED — body { email, resetToken, newPassword }
  AUTH_ME: "/api/auth/me", // CONFIRMED — requires Bearer token
  AUTH_LOGOUT: "/api/auth/logout", // CONFIRMED — stateless, returns { message }
  // NOTE: no /api/auth/refresh on the backend (stateless JWT, 24h expiry).
  // The app keeps the access token until it expires; a 401 forces re-login.

  // --- Machines (CONFIRMED — MachineController, permission-guarded) ---
  MACHINES: "/api/machines", // CONFIRMED — GET paginated { content, page, size, totalElements, totalPages }, params zoneId/status/search/page/size/sort (MACHINE_READ)
  MACHINE_BY_ID: "/api/machines/:id", // CONFIRMED — GET one (MACHINE_READ); PUT update / DELETE 204 (MACHINE_WRITE)
  MACHINE_SENSORS: "/api/machines/:id/sensors", // CONFIRMED Sprint 3 — GET array [{ id, machineId, type, unit, status, lastSeen, ... }]. NOTE: resolve with the Mongo id, not the code
  MACHINE_READINGS: "/api/machines/:id/readings", // CONFIRMED Sprint 3 — GET paginated { content, ... }, params from/to/sensorType/page/size/sort. Accepts Mongo id OR code (READINGS_READ)
  MACHINE_THRESHOLDS: "/api/machines/:id/thresholds", // CONFIRMED — GET array (THRESHOLD_READ); POST upsert body (THRESHOLD_WRITE) -> 201
  MACHINE_THRESHOLD_BY_TYPE: "/api/machines/:id/thresholds/:sensorType", // CONFIRMED — GET one / PUT upsert / DELETE 204. machineId accepts id OR code

  // --- Zones (CONFIRMED — ZoneController, permission-guarded) ---
  ZONES: "/api/zones", // CONFIRMED — GET returns array (ZONE_READ)
  ZONE_BY_ID: "/api/zones/:id", // CONFIRMED — GET one (ZONE_READ); PUT update / DELETE 204 (ZONE_WRITE)
  ZONE_MACHINES: "/api/zones/:id/machines", // CONFIRMED — machines in a zone (ZONE_READ)

  // --- Groups (CONFIRMED — GroupController, permission-guarded) ---
  GROUPS: "/api/groups", // CONFIRMED — GET paginated (?search=&page=&size=&sort=, GROUP_READ); POST (GROUP_WRITE) { name, operators?, supervisorId? }
  GROUP_BY_ID: "/api/groups/:id", // CONFIRMED — GET one (GROUP_READ); PUT / DELETE 204 (GROUP_WRITE)
  GROUP_OPERATORS: "/api/groups/:groupId/operators", // CONFIRMED — GET members (GROUP_READ)
  GROUP_OPERATOR: "/api/groups/:groupId/operators/:userId", // CONFIRMED — POST add / DELETE remove (GROUP_WRITE). Backend validates OPERATOR role, dedupes, clears supervisor if removed
  GROUP_SUPERVISOR: "/api/groups/:groupId/supervisor", // CONFIRMED — GET supervisor (GROUP_READ, 204 if none); PUT { supervisorId } (GROUP_WRITE, OPERATOR or RESPONSABLE_INDUSTRIEL)

  // NOTE: no /api/sensors or /api/readings top-level routes on the backend.
  // Sensors and readings are always addressed through their machine:
  // MACHINE_SENSORS and MACHINE_READINGS above. No per-machine seuil
  // endpoints exist either — thresholds are hardcoded server-side (Sprint 3).

  // --- Alerts ---
  ALERTS: "/api/alerts", // ASSUMED — confirm with backend
  ALERT_BY_ID: "/api/alerts/:id", // ASSUMED — confirm with backend

  // --- Notifications ---
  NOTIFICATIONS: "/api/notifications", // ASSUMED — confirm with backend
  NOTIFICATION_BY_ID: "/api/notifications/:id", // ASSUMED — confirm with backend
  NOTIFICATIONS_MARK_READ: "/api/notifications/mark-read", // ASSUMED — confirm with backend

  // --- Tickets ---
  TICKETS: "/api/tickets", // ASSUMED — confirm with backend
  TICKET_BY_ID: "/api/tickets/:id", // ASSUMED — confirm with backend

  // --- Maintenance ---
  MAINTENANCE_RECORDS: "/api/maintenance", // ASSUMED — confirm with backend
  MAINTENANCE_BY_ID: "/api/maintenance/:id", // ASSUMED — confirm with backend

  // --- Events ---
  EVENTS: "/api/events", // ASSUMED — confirm with backend
  EVENT_BY_ID: "/api/events/:id", // ASSUMED — confirm with backend

  // --- Dashboard ---
  DASHBOARD_SUMMARY: "/api/dashboard/summary", // ASSUMED — confirm with backend
  DASHBOARD_KPI: "/api/dashboard/kpi", // ASSUMED — confirm with backend

  // --- Analytics ---
  ANALYTICS_TRENDS: "/api/analytics/trends", // ASSUMED — confirm with backend
  ANALYTICS_COMPARISON: "/api/analytics/comparison", // ASSUMED — confirm with backend

  // --- Reports ---
  REPORTS: "/api/reports", // ASSUMED — confirm with backend
  REPORT_BY_ID: "/api/reports/:id", // ASSUMED — confirm with backend
  REPORT_GENERATE: "/api/reports/generate", // ASSUMED — confirm with backend

  // --- Users (CONFIRMED — UserController, permission-guarded) ---
  USERS: "/api/users", // CONFIRMED — GET paginated (?search=&role=&page=&size=&sort=, USER_READ); POST create (USER_WRITE)
  USER_BY_ID: "/api/users/:id", // CONFIRMED — GET one (USER_READ); PUT update (USER_WRITE); DELETE 204 (USER_WRITE)
  USER_PASSWORD: "/api/users/change-password/:id", // CONFIRMED — PUT ?newPassword=&oldPassword= -> 204 (USER_WRITE)
  USER_PERMISSIONS_CATALOG: "/api/users/permissions/catalog", // CONFIRMED — GET { permissions: [{code,description,category}], roles: {...} } (any authenticated role)
  // --- Self-service profile (CONFIRMED — UserController /me methods) ---
  // Identity comes from the JWT: no :id to tamper with. Backend reuses
  // UpdateUserRequest (role/status validated but ignored) and query params
  // for the password route, like the legacy change-password endpoint.
  USER_ME: "/api/users/me", // CONFIRMED — PUT { firstName, lastName, email, role, status } -> user (any role)
  USER_ME_PASSWORD: "/api/users/me/password", // CONFIRMED — PUT ?newPassword=&oldPassword= -> 204 (any role)
  USER_PERMISSIONS: "/api/users/:id/permissions", // CONFIRMED — GET UserPermissionsDto (USER_READ); PUT { permissions: [...] } -> UserPermissionsDto (USER_PERMISSIONS_MANAGE)
  // NOTE: no /api/users/me, no change-password endpoint in Sprint 1.
  // Profile reads GET /api/auth/me; self-edit goes through PUT /api/users/:id (ADMIN only).

  // --- Settings ---
  SETTINGS: "/api/settings", // ASSUMED — confirm with backend

  // --- AI ---
  AI_PREDICT: "/api/ai/predict", // ASSUMED — confirm with backend
  AI_RECOMMENDATIONS: "/api/ai/recommendations", // ASSUMED — confirm with backend
});

/**
 * Replace :param placeholders in an endpoint path.
 * e.g. buildUrl(ENDPOINTS.MACHINE_BY_ID, { id: '123' }) -> '/api/machines/123'
 */
export function buildUrl(template, params = {}) {
  let url = template;
  for (const [key, value] of Object.entries(params)) {
    url = url.replace(`:${key}`, encodeURIComponent(value));
  }
  return url;
}
