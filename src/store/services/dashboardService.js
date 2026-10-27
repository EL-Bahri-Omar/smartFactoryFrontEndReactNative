// src/store/services/dashboardService.js
//
// Sprint 7 — CONFIRMED against smartFactoryBackEndSpringBoot
// (controller/DashboardController.java + service/DashboardService.java).
// Nothing here is assumed any more: the four ASSUMED guesses from the
// pre-Sprint-7 dashboard (`/summary`, `/kpi`, `/kpis`, `/oee`) are gone —
// `/api/dashboard/oee` never shipped and must not be re-invented (the backend
// declares OEE `UNAVAILABLE` by business rule in DashboardService.getKpis).
//
// Every route is guarded by SecurityConfig.java:119
// (`/api/dashboard/**` → ADMIN | RESPONSABLE_INDUSTRIEL | TECHNICIAN), so an
// OPERATOR caller receives a 403 — the screen must handle that as
// "blocked for this role", not as a broken factory.
//
// Do NOT add a fallback/mock response here — an empty result must reach the
// screen as an empty result.

import api from "../../lib/axios";
import { ENDPOINTS } from "../../constants/api";

/**
 * GET /api/dashboard/overview
 * `{ factoryStatus, totalMachines, machinesByStatus: {RUNNING, IDLE, …},
 *    activeAlertsCount, activeAlertsBySeverity, activeAnomaliesCount,
 *    overallHealthScore, lastUpdated }`
 * @returns {Promise<Object>} raw payload
 */
export async function getOverview() {
  const response = await api.get(ENDPOINTS.DASHBOARD_OVERVIEW);
  return response.data;
}

/**
 * GET /api/dashboard/kpis?period=&machineId=
 * Availability %, MTBF (h), MTTR (min) and the OEE block, which the backend
 * always answers as `{ status: "UNAVAILABLE", value: null, reason, … }`.
 * @param {{ period?: "day"|"week"|"month", machineId?: string }} [params]
 * @returns {Promise<Object>} raw payload
 */
export async function getKpis(params = {}) {
  const response = await api.get(ENDPOINTS.DASHBOARD_KPIS, { params });
  return response.data;
}

/**
 * GET /api/dashboard/kpis/history?period=&points=&machineId=
 * Returns a LIST (not a wrapper):
 * `[{ timestamp, availability, failuresCount, downtimeMinutes }]`
 * @param {{ period?: string, points?: number, machineId?: string }} [params]
 * @returns {Promise<Array>} raw series
 */
export async function getKpisHistory(params = {}) {
  const response = await api.get(ENDPOINTS.DASHBOARD_KPIS_HISTORY, { params });
  return response.data;
}

/**
 * GET /api/dashboard/factory-state
 * Per-zone aggregation used by the Map & Zones machine view.
 * @returns {Promise<Object>} raw payload
 */
export async function getFactoryState() {
  const response = await api.get(ENDPOINTS.DASHBOARD_FACTORY_STATE);
  return response.data;
}

/**
 * GET /api/dashboard/zones/{zoneId}
 * Zone detail incl. every machine with `healthScore` / `healthGrade` — the
 * data behind the health-score ring on each machine row (map&zones.png).
 * @param {string} zoneId
 * @returns {Promise<Object>} raw payload
 */
export async function getZoneDetails(zoneId) {
  const response = await api.get(`${ENDPOINTS.DASHBOARD_ZONE}/${zoneId}`);
  return response.data;
}

/**
 * GET /api/dashboard/health-scores
 * `{ totalMachines, averageScore, distribution: {excellent, good, warning,
 *    critical, insufficientData}, machines: [...] }`
 * @returns {Promise<Object>} raw payload
 */
export async function getHealthScores() {
  const response = await api.get(ENDPOINTS.DASHBOARD_HEALTH_SCORES);
  return response.data;
}
