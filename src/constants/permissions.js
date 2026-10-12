// src/constants/permissions.js
//
// Granular permission catalog — mirrors backend `security/Permission.java`
// (codes must stay identical; UI labels are English).
// Role defaults mirror backend `security/Role.java` and are used ONLY as a
// fallback when the user payload has no `effectivePermissions` array
// (login / me / users list all include it).
//
// Effective rule (same as backend):
//   effective = (roleDefaults ∪ customGranted) − customRevoked

export const PERMISSIONS = Object.freeze({
  MACHINE_READ: "MACHINE_READ",
  MACHINE_WRITE: "MACHINE_WRITE",
  READINGS_READ: "READINGS_READ",
  THRESHOLD_READ: "THRESHOLD_READ",
  THRESHOLD_WRITE: "THRESHOLD_WRITE",
  ALERT_READ: "ALERT_READ",
  ALERT_ACKNOWLEDGE: "ALERT_ACKNOWLEDGE",
  USER_READ: "USER_READ",
  USER_WRITE: "USER_WRITE",
  USER_PERMISSIONS_MANAGE: "USER_PERMISSIONS_MANAGE",
  GROUP_READ: "GROUP_READ",
  GROUP_WRITE: "GROUP_WRITE",
  ZONE_READ: "ZONE_READ",
  ZONE_WRITE: "ZONE_WRITE",
});

export const PERMISSION_LIST = Object.freeze(Object.values(PERMISSIONS));

// UI labels (English). Backend descriptions are French — codes are the contract.
export const PERMISSION_LABELS = Object.freeze({
  MACHINE_READ: "View machines & sensors",
  MACHINE_WRITE: "Create, edit & delete machines",
  READINGS_READ: "View telemetry history & live data",
  THRESHOLD_READ: "View alert thresholds",
  THRESHOLD_WRITE: "Create, edit & delete thresholds",
  ALERT_READ: "View alerts",
  ALERT_ACKNOWLEDGE: "Acknowledge & resolve alerts",
  USER_READ: "View users",
  USER_WRITE: "Create, edit & delete users",
  USER_PERMISSIONS_MANAGE: "Manage user permissions",
  GROUP_READ: "View groups",
  GROUP_WRITE: "Create, edit & delete groups",
  ZONE_READ: "View zones",
  ZONE_WRITE: "Create, edit & delete zones",
});

export const PERMISSION_CATEGORIES = Object.freeze([
  "MACHINES",
  "READINGS",
  "THRESHOLDS",
  "ALERTS",
  "USERS",
  "GROUPS",
  "ZONES",
]);

// Backend category per permission (fallback when the catalog is unreachable).
export const PERMISSION_CATEGORY_OF = Object.freeze({
  MACHINE_READ: "MACHINES",
  MACHINE_WRITE: "MACHINES",
  READINGS_READ: "READINGS",
  THRESHOLD_READ: "THRESHOLDS",
  THRESHOLD_WRITE: "THRESHOLDS",
  ALERT_READ: "ALERTS",
  ALERT_ACKNOWLEDGE: "ALERTS",
  USER_READ: "USERS",
  USER_WRITE: "USERS",
  USER_PERMISSIONS_MANAGE: "USERS",
  GROUP_READ: "GROUPS",
  GROUP_WRITE: "GROUPS",
  ZONE_READ: "ZONES",
  ZONE_WRITE: "ZONES",
});

// Role defaults — mirror of backend Role.getDefaultPermissions().
const ALL = [...PERMISSION_LIST];
export const ROLE_DEFAULT_PERMISSIONS = Object.freeze({
  ADMIN: Object.freeze([...ALL]),
  OPERATOR: Object.freeze([
    "MACHINE_READ",
    "READINGS_READ",
    "ALERT_READ",
    "ZONE_READ",
    "GROUP_READ",
  ]),
  TECHNICIAN: Object.freeze([
    "MACHINE_READ",
    "READINGS_READ",
    "ALERT_READ",
    "ALERT_ACKNOWLEDGE",
    "THRESHOLD_READ",
    "ZONE_READ",
    "GROUP_READ",
  ]),
  RESPONSABLE_INDUSTRIEL: Object.freeze([
    "MACHINE_READ",
    "MACHINE_WRITE",
    "READINGS_READ",
    "THRESHOLD_READ",
    "THRESHOLD_WRITE",
    "ALERT_READ",
    "ALERT_ACKNOWLEDGE",
    "ZONE_READ",
    "GROUP_READ",
  ]),
});

/** Effective permission set for a user object (backend formula). */
export function effectivePermissions(user) {
  if (Array.isArray(user?.effectivePermissions)) return new Set(user.effectivePermissions);
  const defaults = new Set(ROLE_DEFAULT_PERMISSIONS[user?.role] || []);
  (user?.customGrantedPermissions || []).forEach((p) => defaults.add(p));
  (user?.customRevokedPermissions || []).forEach((p) => defaults.delete(p));
  return defaults;
}

/** True when the user effectively holds EVERY listed permission. */
export function hasPermission(user, ...perms) {
  if (!user) return false;
  const effective = effectivePermissions(user);
  return perms.every((p) => effective.has(p));
}

/** True when the user effectively holds AT LEAST ONE listed permission. */
export function hasAnyPermission(user, ...perms) {
  if (!user) return false;
  const effective = effectivePermissions(user);
  return perms.some((p) => effective.has(p));
}
