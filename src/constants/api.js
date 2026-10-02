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

  // --- Machines (CONFIRMED Sprint 1 — MachineController) ---
  MACHINES: "/api/machines", // CONFIRMED — GET paginated { content, page, size, totalElements, totalPages }, params zoneId/status/search/page/size/sort
  MACHINE_BY_ID: "/api/machines/:id", // CONFIRMED — GET one; PUT update (ADMIN); DELETE 204 (ADMIN)
  MACHINE_SENSORS: "/api/machines/:id/sensors", // CONFIRMED — Sprint 1 returns [] (sensors ship in Sprint 2)
  MACHINE_READINGS: "/api/machines/:id/readings", // ASSUMED — no backend yet (Sprint 4)

  // --- Zones (CONFIRMED Sprint 1 — ZoneController) ---
  ZONES: "/api/zones", // CONFIRMED — GET returns array [{ id, name, machineCount, ... }]
  ZONE_BY_ID: "/api/zones/:id", // CONFIRMED — GET one; PUT update (ADMIN); DELETE 204 (ADMIN)
  ZONE_MACHINES: "/api/zones/:id/machines", // CONFIRMED — machines in a zone

  // --- Sensors ---
  SENSORS: "/api/sensors", // ASSUMED — confirm with backend
  SENSOR_BY_ID: "/api/sensors/:id", // ASSUMED — confirm with backend

  // --- Readings ---
  READINGS: "/api/readings", // ASSUMED — confirm with backend
  READINGS_BY_SENSOR: "/api/readings/sensor/:sensorId", // ASSUMED — confirm with backend

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

  // --- Users (CONFIRMED Sprint 1 — UserController, ADMIN only) ---
  USERS: "/api/users", // CONFIRMED — GET paginated, params search/page/size/sort; POST create (ADMIN)
  USER_BY_ID: "/api/users/:id", // CONFIRMED — GET one; PUT update (ADMIN); DELETE 204 (ADMIN). NEVER widened: no self-check, anyone could edit anyone.
  USER_PASSWORD: "/api/users/change-password/:id", // CONFIRMED — PUT ?newPassword=&oldPassword= -> 204 (ADMIN role required server-side)
  // --- Self-service profile (CONFIRMED — UserController /me methods) ---
  // Identity comes from the JWT: no :id to tamper with. Backend reuses
  // UpdateUserRequest (role/status validated but ignored) and query params
  // for the password route, like the legacy change-password endpoint.
  USER_ME: "/api/users/me", // CONFIRMED — PUT { firstName, lastName, email, role, status } -> user (any role)
  USER_ME_PASSWORD: "/api/users/me/password", // CONFIRMED — PUT ?newPassword=&oldPassword= -> 204 (any role)
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
