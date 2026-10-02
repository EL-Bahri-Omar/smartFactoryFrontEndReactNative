// src/constants/roles.js
// Single source of truth for every enum in the app.
// Freeze each so they cannot be mutated at runtime.

export const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  OPERATOR: "OPERATOR",
  TECHNICIAN: "TECHNICIAN",
  RESPONSABLE_INDUSTRIEL: "RESPONSABLE_INDUSTRIEL",
});

export const MACHINE_STATUS = Object.freeze({
  RUNNING: "RUNNING",
  IDLE: "IDLE",
  MAINTENANCE: "MAINTENANCE",
  FAILURE: "FAILURE",
  OFFLINE: "OFFLINE",
});

export const ALERT_SEVERITY = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
});

export const ALERT_STATUS = Object.freeze({
  OPEN: "OPEN",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  CLOSED: "CLOSED",
});

export const TICKET_STATUS = Object.freeze({
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_PART: "WAITING_PART",
  RESOLVED: "RESOLVED",
});

export const TICKET_PRIORITY = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
});

export const SENSOR_TYPE = Object.freeze({
  TEMPERATURE: "TEMPERATURE",
  VIBRATION: "VIBRATION",
  CURRENT: "CURRENT",
  RPM: "RPM",
});

export const SENSOR_UNIT = Object.freeze({
  TEMPERATURE: "°C",
  VIBRATION: "mm/s",
  CURRENT: "A",
  RPM: "rpm",
});

export const NOTIFICATION_TYPE = Object.freeze({
  ALERT: "ALERT",
  MAINTENANCE: "MAINTENANCE",
  SYSTEM: "SYSTEM",
  INFO: "INFO",
});

export const EVENT_TYPE = Object.freeze({
  STATUS_CHANGE: "STATUS_CHANGE",
  THRESHOLD_BREACH: "THRESHOLD_BREACH",
  MAINTENANCE_STARTED: "MAINTENANCE_STARTED",
  MAINTENANCE_COMPLETED: "MAINTENANCE_COMPLETED",
  SENSOR_OFFLINE: "SENSOR_OFFLINE",
  SENSOR_ONLINE: "SENSOR_ONLINE",
});

export const REPORT_RANGE = Object.freeze({
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  CUSTOM: "CUSTOM",
});
