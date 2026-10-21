// src/lib/status.js
// Maps machine status, alert severity, ticket status/priority to
// { label, color, dotColor } using constants/roles.js and constants/colors.js.
// Single source of truth for all status presentation logic.

import { COLORS } from "../constants/colors";
import {
  MACHINE_STATUS,
  ALERT_SEVERITY,
  ALERT_STATUS,
  TICKET_STATUS,
  TICKET_PRIORITY,
} from "../constants/roles";

// ── Machine status ──────────────────────────────────────────────────────

const MACHINE_STATUS_MAP = {
  [MACHINE_STATUS.RUNNING]: { label: "Running", color: COLORS.success, dotColor: COLORS.success },
  [MACHINE_STATUS.IDLE]: { label: "Idle", color: COLORS.idle, dotColor: COLORS.idle },
  [MACHINE_STATUS.MAINTENANCE]: { label: "Maintenance", color: COLORS.warning, dotColor: COLORS.warning },
  [MACHINE_STATUS.FAILURE]: { label: "Failure", color: COLORS.danger, dotColor: COLORS.danger },
  [MACHINE_STATUS.OFFLINE]: { label: "Offline", color: COLORS.offline, dotColor: COLORS.offline },
};

export function getMachineStatus(status) {
  return MACHINE_STATUS_MAP[status] || { label: status, color: COLORS.offline, dotColor: COLORS.offline };
}

// ── Alert severity ──────────────────────────────────────────────────────
//
// Backend Alert entity (CONFIRMED — AlertController): severity enum
// INFO | WARNING | HIGH | CRITICAL. The UI has a chip per level:
// Critical (danger) / High (orange-600) / Medium (warning) / Low (offline).

const ALERT_SEVERITY_MAP = {
  // Backend values directly (CONFIRMED Sprint 5)
  CRITICAL: { label: "Critical", color: COLORS.danger, dotColor: COLORS.danger },
  HIGH: { label: "High", color: "#EA580C", dotColor: "#EA580C" }, // orange-600: between warning and danger
  WARNING: { label: "Medium", color: COLORS.warning, dotColor: COLORS.warning },
  INFO: { label: "Low", color: COLORS.offline, dotColor: COLORS.offline },
  // UI scale aliases kept for backwards compatibility
  [ALERT_SEVERITY.MEDIUM]: { label: "Medium", color: COLORS.warning, dotColor: COLORS.warning },
  [ALERT_SEVERITY.LOW]: { label: "Low", color: COLORS.offline, dotColor: COLORS.offline },
};

export function getAlertSeverity(severity) {
  return ALERT_SEVERITY_MAP[severity] || { label: severity, color: COLORS.offline, dotColor: COLORS.offline };
}

/**
 * Normalize any severity source onto the UI chip scale
 * CRITICAL | HIGH | MEDIUM | LOW. Unknown values fall through to LOW.
 * Backend WARNING -> MEDIUM chip; INFO -> LOW chip.
 */
export function normalizeAlertSeverity(severity) {
  switch (String(severity || "").toUpperCase()) {
    case "CRITICAL":
      return ALERT_SEVERITY.CRITICAL;
    case "HIGH":
      return ALERT_SEVERITY.HIGH;
    case "MEDIUM":
    case "WARNING":
      return ALERT_SEVERITY.MEDIUM;
    case "LOW":
    case "INFO":
      return ALERT_SEVERITY.LOW;
    default:
      return ALERT_SEVERITY.LOW;
  }
}

/**
 * Inverse lookup used by REST queries and Ticket priority prefill: which
 * backend severity values match a UI chip key.
 * CRITICAL -> ["CRITICAL"], HIGH -> ["HIGH"],
 * MEDIUM -> ["MEDIUM", "WARNING"] (backend WARNING shown as Medium),
 * LOW -> ["LOW", "INFO"].
 */
export function alertSeverityFilterValues(displaySeverity) {
  switch (displaySeverity) {
    case ALERT_SEVERITY.CRITICAL:
      return ["CRITICAL"];
    case ALERT_SEVERITY.HIGH:
      return ["HIGH"];
    case ALERT_SEVERITY.MEDIUM:
      return ["MEDIUM", "WARNING"];
    case ALERT_SEVERITY.LOW:
      return ["LOW", "INFO"];
    default:
      return [];
  }
}

// ── Alert status ────────────────────────────────────────────────────────
//
// Backend Alert entity (CONFIRMED): ACTIVE | ACKNOWLEDGED | RESOLVED.
// The older OPEN/CLOSED UI enum is kept for compatibility.

const ALERT_STATUS_MAP = {
  [ALERT_STATUS.OPEN]: { label: "Active", color: COLORS.danger },
  [ALERT_STATUS.ACKNOWLEDGED]: { label: "Acknowledged", color: COLORS.warning },
  [ALERT_STATUS.CLOSED]: { label: "Resolved", color: COLORS.success },
  // Backend values
  ACTIVE: { label: "Active", color: COLORS.danger },
  RESOLVED: { label: "Resolved", color: COLORS.success },
};

export function getAlertStatus(status) {
  return ALERT_STATUS_MAP[status] || { label: status, color: COLORS.offline };
}

/** Map any alert status source onto the backend enum ACTIVE | ACKNOWLEDGED | RESOLVED. */
export function normalizeAlertStatus(status) {
  switch (String(status || "").toUpperCase()) {
    case "ACTIVE":
    case "OPEN":
      return "ACTIVE";
    case "ACKNOWLEDGED":
      return "ACKNOWLEDGED";
    case "RESOLVED":
    case "CLOSED":
      return "RESOLVED";
    default:
      return "ACTIVE";
  }
}

// ── Sensor status (Sprint 3 — backend SensorStatus) ─────────────────────

const SENSOR_STATUS_MAP = {
  ONLINE: { label: "Online", color: COLORS.success, dotColor: COLORS.success },
  OFFLINE: { label: "Offline", color: COLORS.offline, dotColor: COLORS.offline },
  MAINTENANCE: { label: "Maintenance", color: COLORS.warning, dotColor: COLORS.warning },
};

export function getSensorStatus(status) {
  return SENSOR_STATUS_MAP[status] || { label: status, color: COLORS.offline, dotColor: COLORS.offline };
}

// ── Ticket status ───────────────────────────────────────────────────────

// ── Intervention status (CONFIRMED backend InterventionStatus) ──────────

const TICKET_STATUS_MAP = {
  [TICKET_STATUS.PENDING]: { label: "Pending", color: COLORS.idle },
  [TICKET_STATUS.ASSIGNED]: { label: "Assigned", color: COLORS.primary },
  [TICKET_STATUS.IN_PROGRESS]: { label: "In Progress", color: COLORS.warning },
  [TICKET_STATUS.COMPLETED]: { label: "Completed", color: COLORS.success },
  [TICKET_STATUS.CANCELLED]: { label: "Cancelled", color: COLORS.offline },
};

export function getTicketStatus(status) {
  return TICKET_STATUS_MAP[status] || { label: status, color: COLORS.offline };
}

// ── Ticket priority ─────────────────────────────────────────────────────

const TICKET_PRIORITY_MAP = {
  [TICKET_PRIORITY.HIGH]: { label: "High", color: COLORS.danger },
  [TICKET_PRIORITY.MEDIUM]: { label: "Medium", color: COLORS.warning },
  [TICKET_PRIORITY.LOW]: { label: "Low", color: COLORS.offline },
};

export function getTicketPriority(priority) {
  return TICKET_PRIORITY_MAP[priority] || { label: priority, color: COLORS.offline };
}

// ── Maintenance type & preventive subtype (CONFIRMED backend enums) ─────

export const INTERVENTION_TYPE_LABELS = Object.freeze({
  CORRECTIVE: "Corrective",
  PREVENTIVE: "Preventive",
  IMPROVEMENT: "Improvement",
});

export const PREVENTIVE_SUBTYPE_LABELS = Object.freeze({
  SYSTEMATIC: "Systematic",
  CONDITIONAL: "Conditional",
});

export const OBSERVATION_CATEGORY_LABELS = Object.freeze({
  SAFETY: "Safety",
  PERFORMANCE: "Performance",
  OPERATING_CONDITION: "Operating Condition",
  GENERAL: "General",
});
