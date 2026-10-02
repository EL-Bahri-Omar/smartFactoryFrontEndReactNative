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

const ALERT_SEVERITY_MAP = {
  [ALERT_SEVERITY.HIGH]: { label: "High", color: COLORS.danger, dotColor: COLORS.danger },
  [ALERT_SEVERITY.MEDIUM]: { label: "Medium", color: COLORS.warning, dotColor: COLORS.warning },
  [ALERT_SEVERITY.LOW]: { label: "Low", color: COLORS.offline, dotColor: COLORS.offline },
};

export function getAlertSeverity(severity) {
  return ALERT_SEVERITY_MAP[severity] || { label: severity, color: COLORS.offline, dotColor: COLORS.offline };
}

// ── Alert status ────────────────────────────────────────────────────────

const ALERT_STATUS_MAP = {
  [ALERT_STATUS.OPEN]: { label: "Open", color: COLORS.danger },
  [ALERT_STATUS.ACKNOWLEDGED]: { label: "Acknowledged", color: COLORS.warning },
  [ALERT_STATUS.CLOSED]: { label: "Closed", color: COLORS.offline },
};

export function getAlertStatus(status) {
  return ALERT_STATUS_MAP[status] || { label: status, color: COLORS.offline };
}

// ── Ticket status ───────────────────────────────────────────────────────

const TICKET_STATUS_MAP = {
  [TICKET_STATUS.OPEN]: { label: "Open", color: COLORS.danger },
  [TICKET_STATUS.ASSIGNED]: { label: "Assigned", color: COLORS.primary },
  [TICKET_STATUS.IN_PROGRESS]: { label: "In Progress", color: COLORS.warning },
  [TICKET_STATUS.WAITING_PART]: { label: "Waiting Part", color: COLORS.idle },
  [TICKET_STATUS.RESOLVED]: { label: "Resolved", color: COLORS.success },
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
