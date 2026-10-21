// src/store/services/alertService.js
//
// Sprint 5 — Alerts. ALL CONFIRMED against the real AlertController:
//   GET  /api/alerts?machineId=&severity=&status=&from=&to=&page=&size=&sort=
//   GET  /api/alerts/:id
//   GET  /api/alerts/summary
//   POST /api/alerts/:id/acknowledge  { comment? }
//   POST /api/alerts/:id/resolve      { comment? }
// There is NO batch "mark all" endpoint — acknowledging every ACTIVE alert
// is done one by one by the slice.
//
// Alert row (MongoDB `alerts`): { id, machineId, sensorId, sensorType,
// machineCode, anomalyId?, severity: INFO|WARNING|HIGH|CRITICAL, value?,
// threshold?, status: ACTIVE|ACKNOWLEDGED|RESOLVED, message,
// acknowledgedBy?, acknowledgedAt?, resolvedBy?, resolvedAt?, comment?,
// timestamp, createdAt }. The same shapes arrive live on STOMP /topic/alerts.

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/alerts — paginated envelope (Spring Page). */
export async function getAll({
  machineId,
  severity,
  status,
  from,
  to,
  page = 0,
  size = 100,
  sort = "timestamp,desc",
} = {}) {
  const response = await api.get(ENDPOINTS.ALERTS, {
    params: {
      machineId: machineId || undefined,
      severity: severity || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      size,
      sort,
    },
  });
  const data = response.data || {};
  const list = normalizeAlerts(data);
  return {
    list,
    page: data.number ?? data.page ?? page,
    size: data.size ?? size,
    totalElements: data.totalElements ?? list.length,
    totalPages: data.totalPages ?? 1,
  };
}

/** GET /api/alerts/:id (CONFIRMED). */
export async function getById(id) {
  const url = buildUrl(ENDPOINTS.ALERT_BY_ID, { id });
  const response = await api.get(url);
  return normalizeAlert(response.data);
}

/** GET /api/alerts/summary (CONFIRMED) → counts Map. */
export async function getSummary() {
  const response = await api.get(ENDPOINTS.ALERTS_SUMMARY);
  return response.data;
}

/**
 * POST /api/alerts/:id/acknowledge (CONFIRMED) — body { comment? }.
 * Returns the updated alert { ..., status: "ACKNOWLEDGED",
 * acknowledgedBy, acknowledgedAt, comment }.
 */
export async function acknowledge(id, comment) {
  const url = buildUrl(ENDPOINTS.ALERTS_ACKNOWLEDGE, { id });
  const response = await api.post(url, { comment: comment || undefined });
  return normalizeAlert(response.data) || { id, status: "ACKNOWLEDGED" };
}

/**
 * POST /api/alerts/:id/resolve (CONFIRMED) — body { comment? }.
 * Returns the updated alert { ..., status: "RESOLVED", resolvedBy, resolvedAt }.
 */
export async function resolve(id, comment) {
  const url = buildUrl(ENDPOINTS.ALERTS_RESOLVE, { id });
  const response = await api.post(url, { comment: comment || undefined });
  return normalizeAlert(response.data) || { id, status: "RESOLVED" };
}

/** Normalize an array or a Spring Page envelope to alert rows. */
export function normalizeAlerts(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(normalizeAlert).filter(Boolean);
  if (Array.isArray(data.content)) return data.content.map(normalizeAlert).filter(Boolean);
  if (Array.isArray(data.alerts)) return data.alerts.map(normalizeAlert).filter(Boolean);
  const one = normalizeAlert(data);
  return one ? [one] : [];
}

/**
 * Normalize a REST row or a STOMP /topic/alerts payload into the app shape.
 * STOMP payload field order: eventType, id, machineId, machineCode, sensorId,
 * sensorType, severity, value, threshold, message, status, timestamp, ...
 */
export function normalizeAlert(row) {
  if (!row || typeof row !== "object") return null;
  const id = row.id ?? row.alertId;
  if (!id && !row.message) return null;
  return {
    id,
    machineId: row.machineId ?? null,
    machineCode: row.machineCode ?? null,
    sensorId: row.sensorId ?? null,
    sensorType: row.sensorType ?? row.type ?? null,
    // Keep the raw backend value (CRITICAL|HIGH|WARNING|INFO); UI resolves labels.
    severity: row.severity ?? null,
    value: row.value ?? null,
    threshold: row.threshold ?? null,
    anomalyId: row.anomalyId ?? null,
    message: row.message || buildDefaultMessage(row),
    status: row.status || "ACTIVE",
    comment: row.comment ?? null,
    acknowledgedBy: row.acknowledgedBy ?? null,
    acknowledgedAt: row.acknowledgedAt ?? null,
    resolvedBy: row.resolvedBy ?? null,
    resolvedAt: row.resolvedAt ?? null,
    timestamp: row.timestamp || row.createdAt || new Date().toISOString(),
  };
}

function buildDefaultMessage(row) {
  const type = row.sensorType || row.type;
  const code = row.machineCode || row.machineId || "Machine";
  return `${type || "Sensor"} alert on ${code}`;
}
