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

// MEASURED on the running backend (2026-10-27, admin token, LAN):
//   GET /api/dashboard/overview         156–271 s
//   GET /api/dashboard/health-scores    151–196 s
//   every other /api route               15–33 ms
// Both loop computeMachineHealthScore() over every machine, and that helper
// reads back the WHOLE sensor-reading history for each threshold just to look
// at the newest row (DashboardService.java ~line 745). Full spec + fix in
// docs/api-contract.md.
//
// Until the backend ships that fix, this ceiling keeps the routes from
// holding a browser connection slot (6 per origin) open for minutes: the
// screen has already painted by the time these are asked for (phase 2), and a
// timeout renders the honest fallback instead of a spinner. 10 s is still 30×
// the median for a healthy endpoint, so it never cuts off a fixed backend.
const HEALTH_TIMEOUT_MS = 10000;

/**
 * SINGLE-FLIGHT. The dashboard card, the TopBar refresh and the Reports screen
 * all ask for the same slow route. Two concurrent callers used to mean two
 * 150 s computations racing the backend (measured: several at once degrade
 * every other route on this machine), so share one in-flight request.
 */
let healthInFlight = null;

export function getHealthScores() {
  if (!healthInFlight) {
    healthInFlight = api
      .get(ENDPOINTS.DASHBOARD_HEALTH_SCORES, { timeout: HEALTH_TIMEOUT_MS })
      .then((r) => r.data)
      .finally(() => {
        healthInFlight = null;
      });
  }
  return healthInFlight;
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
  const response = await api.get(`${ENDPOINTS.DASHBOARD_ZONE}/${zoneId}`, {
    timeout: HEALTH_TIMEOUT_MS,
  });
  return response.data;
}
// GET /api/dashboard/health-scores → getHealthScores() above (single-flight).
