// src/lib/sensorAlerts.js
//
// Shared "one row per sensor state" rules for the Alerts screen AND the
// Notifications screen (alert notifications). Backend truth (AlertService):
//   - One alert document per machine·sensor episode.
//   - NORMAL → WARNING/CRITICAL: create ONE alert (Rule A).
//   - WARNING → CRITICAL: mutate the SAME alert (Rule B) — the id stays, the
//     severity changes, and the WARNING notification is marked read.
//   - WARNING/CRITICAL → NORMAL: resolve the same alert (Rule D).
// The UI therefore shows at most ONE warning row + ONE critical row per
// sensor for the fetched window, and the live dot sits only on the row that
// matches the sensor's CURRENT state (it moves warning → critical and turns
// green once the alert is resolved).

import { getAlertSeverity, normalizeAlertSeverity } from "./status";

export const NORMAL_DOT_COLOR = "#16A34A";
export const UNKNOWN_DOT_COLOR = "#94A3B8";

/** Newest-first ordering by a timestamp field (missing timestamps sink). */
export function byNewest(a, b, field = "timestamp") {
  const ta = a?.[field] ? Date.parse(a[field]) : 0;
  const tb = b?.[field] ? Date.parse(b[field]) : 0;
  return tb - ta;
}

/** machine + sensor identity (ignores state) — used for the live dot. */
export function sensorKey(a) {
  const machine = a?.machineId || a?.machineCode || "machine";
  const sensor = a?.sensorType || a?.sensorId || "sensor";
  return `${machine}|${sensor}`;
}

/** Stable identity for "the same incident": machine + sensor + state. */
export function alertStateKey(a) {
  return `${sensorKey(a)}|${normalizeAlertSeverity(a?.severity)}`;
}

/**
 * Collapse the fetched alert list:
 *  1. copies of the same alert id (severity mutated server-side) → newest;
 *  2. one row per machine·sensor·state → newest value/time.
 * Then order newest-first. Result: at most one WARNING row and one CRITICAL
 * row per sensor, even if the backend/STOMP delivered duplicates.
 */
export function dedupeSensorAlerts(list = []) {
  const byId = new Map();
  for (const alert of list) {
    if (!alert) continue;
    const idKey = alert.id ? `id:${alert.id}` : `state:${alertStateKey(alert)}`;
    const prev = byId.get(idKey);
    if (!prev || byNewest(alert, prev) < 0) byId.set(idKey, alert);
  }

  const byState = new Map();
  for (const alert of byId.values()) {
    const key = alertStateKey(alert);
    const prev = byState.get(key);
    if (!prev || byNewest(alert, prev) < 0) byState.set(key, alert);
  }

  return [...byState.values()].sort(byNewest);
}

/** Human label for the live dot (backend WARNING → "Warning", not "Medium"). */
export function severityLabel(severity) {
  const normalized = normalizeAlertSeverity(severity);
  if (normalized === "CRITICAL") return "Critical";
  if (normalized === "HIGH") return "High";
  if (normalized === "MEDIUM") return "Warning";
  return "Low";
}

/**
 * Current state per machine·sensor, derived from the NEWEST alert for that
 * pair. Drives the live dot and moves from warning → critical → normal.
 */
export function buildSensorStates(list = []) {
  const newest = new Map();
  for (const alert of list) {
    if (!alert) continue;
    const key = sensorKey(alert);
    const prev = newest.get(key);
    if (!prev || byNewest(alert, prev) < 0) newest.set(key, alert);
  }

  const states = new Map();
  for (const [key, alert] of newest) {
    const resolved = alert.status === "RESOLVED";
    const color = resolved ? NORMAL_DOT_COLOR : getAlertSeverity(alert.severity).color;
    states.set(key, {
      id: alert.id ?? null,
      severity: alert.severity ?? null,
      status: alert.status ?? null,
      resolved,
      color,
      label: resolved ? "Normal" : severityLabel(alert.severity),
    });
  }
  return states;
}

/**
 * True when this alert row is the one that carries the sensor's live dot.
 * Prefer the alert id (partial state transitions keep the id); fall back to
 * the normalized severity when the id is not available.
 */
export function isLiveAlertRow(alert, liveState) {
  if (!alert || !liveState) return false;
  if (liveState.id && alert.id) return alert.id === liveState.id;
  return normalizeAlertSeverity(alert.severity) === normalizeAlertSeverity(liveState.severity);
}

/** Row-specific dot: only the row matching the sensor's current state. */
export function liveDotFor(alert, liveState) {
  if (!isLiveAlertRow(alert, liveState)) return null;
  return { color: liveState.color, label: liveState.label };
}

/** Severity carried by an AppNotification type (ALERT_WARNING/HIGH/CRITICAL). */
export function severityFromNotificationType(type) {
  const value = String(type || "").toUpperCase();
  if (!value.startsWith("ALERT_")) return null;
  const suffix = value.slice("ALERT_".length);
  if (suffix === "WARNING" || suffix === "MEDIUM") return "WARNING";
  if (suffix === "HIGH") return "HIGH";
  if (suffix === "CRITICAL") return "CRITICAL";
  if (suffix === "INFO" || suffix === "LOW") return "INFO";
  return null;
}

/** True for every backend alert notification type (ALERT_*). */
export function isAlertNotificationType(type) {
  return String(type || "").toUpperCase().startsWith("ALERT_");
}
