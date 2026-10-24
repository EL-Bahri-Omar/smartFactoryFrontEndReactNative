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
  MACHINE_READINGS: "/api/machines/:id/readings", // CONFIRMED Sprint 4 — GET paginated { content, ... } from SmartFactoryHistory, params from/to/sensorType/page/size/sort. Accepts Mongo id OR code (READINGS_READ or SENSOR_HISTORY_READ)
  MACHINE_READINGS_LATEST: "/api/machines/:id/readings/latest", // CONFIRMED Sprint 4 — GET full telemetry snapshot { machineId, machineCode, status, sensors: { temperature, vibration, current, rpm }, timestamp } (READINGS_READ)
  MACHINE_TIMESERIES: "/api/machines/:id/readings/timeseries", // CONFIRMED Sprint 4 — GET { machineId, machineCode, sensorType, from, to, period, totalPoints, points: [{ timestamp, value, unit, sensorType }] }. Params sensorType?, period=1h|24h|7d|30d, from/to, aggregate=avg, maxPoints (READINGS_READ). Alias: /charts
  MACHINE_CURRENT_TEMPERATURE: "/api/machines/:id/sensors/temperature/current", // CONFIRMED Sprint 4 — GET { machineId, machineCode, sensorType, value, unit, timestamp, status, thresholdBreached, severity, breachedThreshold, warningMin/Max, criticalMin/Max } (READINGS_READ)
  MACHINE_CURRENT_VIBRATION: "/api/machines/:id/sensors/vibration/current", // CONFIRMED Sprint 4 — same shape, VIBRATION
  MACHINE_CURRENT_CURRENT: "/api/machines/:id/sensors/current/current", // CONFIRMED Sprint 4 — same shape, CURRENT
  MACHINE_CURRENT_RPM: "/api/machines/:id/sensors/rpm/current", // CONFIRMED Sprint 4 — same shape, RPM. status ∈ OK | WARNING | CRITICAL | NO_DATA (severity NONE when no data)
  MACHINE_STATUS_INFO: "/api/machines/:id/status", // CONFIRMED Sprint 4 — GET { machineId, machineCode, name, status, lastSeen, isOnline } (MACHINE_READ); PUT { status } full update (MACHINE_WRITE)
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

  // --- Alerts (CONFIRMED — AlertController, Sprint 5 US37/38/39/41) ---
  // Alerts live on the `alerts` collection; rows also broadcast on STOMP
  // /topic/alerts (CONFIRMED). severity enum: INFO | WARNING | HIGH | CRITICAL;
  // status enum: ACTIVE | ACKNOWLEDGED | RESOLVED.
  ALERTS: "/api/alerts", // CONFIRMED — GET ?machineId=&severity=&status=&from=&to=&page=&size=&sort= → Page<Alert> (ALERT_READ legacy or ALERT:CONSULTER)
  ALERT_BY_ID: "/api/alerts/:id", // CONFIRMED — GET one
  ALERTS_ACKNOWLEDGE: "/api/alerts/:id/acknowledge", // CONFIRMED — POST { comment? } → updated Alert (ALERT_WRITE / ALERT:ACQUITTER)
  ALERTS_RESOLVE: "/api/alerts/:id/resolve", // CONFIRMED — POST { comment? } → updated Alert
  ALERTS_SUMMARY: "/api/alerts/summary", // CONFIRMED — GET counts summary Map

  // --- Notifications (CONFIRMED — NotificationController, Sprint 5 US40) ---
  // AppNotification: { id, userId, alertId?, machineId?, title, message,
  // type: ALERT_CRITICAL | ALERT_HIGH | ALERT_WARNING | MAINTENANCE_ASSIGNED | INFO,
  // isRead, createdAt }. REST + per-user STOMP topics
  // /topic/users/{userId}/notifications and /topic/users/{userId}/unread-count,
  // plus FCM push for closed-app delivery (mobile).
  NOTIFICATIONS: "/api/notifications", // CONFIRMED — GET ?page=&size= (default 20) → Page<AppNotification>, current user only
  NOTIFICATION_MARK_READ: "/api/notifications/:id/read", // CONFIRMED — PUT ?userId= → marked-read notification
  NOTIFICATION_MARK_ALL: "/api/notifications/mark-read", // CONFIRMED — PUT with NO body/id → marks ALL unread at once { message, unreadCount }
  NOTIFICATIONS_UNREAD_COUNT: "/api/notifications/unread-count", // CONFIRMED — GET ?userId= → { unreadCount }
  NOTIFICATION_TOKENS: "/api/notifications/tokens", // CONFIRMED — POST { token, deviceType } (native FCM registration)

  // --- Maintenance interventions (CONFIRMED — MaintenanceController, Sprint 6 US42-50) ---
  // MaintenanceIntervention: { id, machineId, machineCode, title, description,
  // type: CORRECTIVE|PREVENTIVE|IMPROVEMENT, preventiveSubtype: SYSTEMATIC|CONDITIONAL|null,
  // priority: LOW|MEDIUM|HIGH, status: PENDING|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED,
  // alertId?, anomalyId?, technicianId?, technicianName?, assignedBy?, assignedAt?,
  // diagnoses[], actions[], observations[], scheduledAt?, startedAt?, closedAt?,
  // closedBy?, closureNotes?, createdAt, updatedAt }
  INTERVENTIONS: "/api/maintenance", // CONFIRMED — GET ?machineId=&technicianId=&type=&subtype=&status=&from=&to=&page=&size=&sort= → Page; POST create
  INTERVENTION_BY_ID: "/api/maintenance/:id", // CONFIRMED — GET one
  INTERVENTION_ASSIGN: "/api/maintenance/:id/assign", // CONFIRMED — PUT { technicianId } (US43)
  // NOTE: the backend has NO dedicated /status route — status travels inside
  // InterventionUpdateRequest on `PUT /api/maintenance/:id` (see
  // interventionService.updateStatus).
  INTERVENTION_ANOMALY: "/api/maintenance/:id/anomaly", // CONFIRMED — GET anomaly + contextual readings Map (US44)
  INTERVENTION_DIAGNOSES: "/api/maintenance/:id/diagnoses", // CONFIRMED — POST { probableCause, details? } (US45)
  INTERVENTION_ACTIONS: "/api/maintenance/:id/actions", // CONFIRMED — POST { description, partsReplaced?, durationMinutes?, performedAt? } (US46)
  INTERVENTION_OBSERVATIONS: "/api/maintenance/:id/observations", // CONFIRMED — POST { content, category? SAFETY|PERFORMANCE|OPERATING_CONDITION|GENERAL } (US47)
  INTERVENTION_CLOSE: "/api/maintenance/:id/close", // CONFIRMED — PUT { closureNotes, restoreMachineStatus? } (US48)
  MAINTENANCE_RECOMMENDATIONS: "/api/maintenance/recommendations/:machineId", // CONFIRMED — GET List<Recommendation { machineId, machineCode, recommendedType, recommendedSubtype?, priority, title, justification, suggestedActions, status: RECOMMENDED|INSUFFICIENT_DATA|HEALTHY, generatedAt }> (US50)
  MAINTENANCE_RECOMMENDATION_APPLY: "/api/maintenance/recommendations/:machineId/apply", // CONFIRMED — POST ?index=&technicianId= → created intervention

  // --- Anomalies (CONFIRMED — AnomalyController) ---
  ANOMALIES: "/api/anomalies", // CONFIRMED — GET ?page=&size= → Page<Anomaly>
  ANOMALY_BY_ID: "/api/anomalies/:id", // CONFIRMED — GET one
  ANOMALY_MACHINE_SCORE: "/api/anomalies/machines/:machineId/score", // CONFIRMED — GET score result

  // --- Modules (CONFIRMED — FunctionalModuleController, dynamic functional modules) ---
  MODULES: "/api/modules", // CONFIRMED — GET array ModuleResponseDto { id, code, name, description, active, systemModule, privileges: [{ action, code, name, description }] }; POST create
  MODULE_BY_ID: "/api/modules/:id", // CONFIRMED — GET one; PUT update; DELETE (custom modules only)
  MODULE_PRIVILEGES: "/api/modules/:id/privileges", // CONFIRMED — POST add privilege to module

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

  // --- Roles (CONFIRMED — RoleController, dynamic roles in `roles` collection) ---
  ROLES: "/api/roles", // CONFIRMED — GET array RoleResponseDto (ROLE_ADMIN or ROLE_READ); POST { name (2-50 alphanum/_/-, unique), description?, privileges? } -> 201 (ROLE_ADMIN or ROLE_CREATE)
  ROLE_BY_NAME: "/api/roles/:name", // CONFIRMED — GET one by id or name (ROLE_ADMIN or ROLE_READ); PUT { description?, privileges? } (ROLE_ADMIN or ROLE_UPDATE); DELETE 204 custom roles only, blocked when system or in use (ROLE_ADMIN or ROLE_DELETE)
  ROLE_PRIVILEGES_CATALOG: "/api/roles/privileges", // CONFIRMED — GET array [{ code, name, description, category }] (ROLE_ADMIN or ROLE_READ)
  ROLE_PRIVILEGES: "/api/roles/:name/privileges", // CONFIRMED — GET string[] (ROLE_ADMIN or ROLE_READ); POST string[] merge (ROLE_ADMIN or ROLE_UPDATE)
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
