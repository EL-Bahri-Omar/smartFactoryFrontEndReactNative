// src/store/services/reportService.js
//
// Reports — rewritten (review: "the reports screen does not show any data,
// fix everything about it, you have everything you need in the backend").
//
// The old version called GET /api/reports/{downtime,performance,generate}.
// Those routes were never implemented (there is no Report* controller in
// smartFactoryBackEndSpringBoot), so every request 404'd and the screen sat
// on "No data for this range" forever.
//
// The report is now COMPOSED from CONFIRMED endpoints that really exist:
//
//   GET /api/maintenance?page=0&size=1000&sort=createdAt,desc
//   GET /api/alerts?page=0&size=1000&sort=timestamp,desc
//   GET /api/machines?page=0&size=1000
//   GET /api/dashboard/health-scores        (slow — 90 s budget, per machine)
//
// Date windows are applied CLIENT-SIDE from `createdAt` / `timestamp`, which
// sidesteps the backend's strict ISO-8601 `from`/`to` parsing and lets the
// previous window be compared for real deltas. The page size is 1000 rows; a
// factory past that would need a server-side aggregate (documented in
// docs/api-contract.md).

import api from "../../lib/axios";
import { ENDPOINTS } from "../../constants/api";
import { getHealthScores as _getHealthScores } from "./dashboardService";

const PAGE_SIZE = 1000;

/** Spring `Page<T>` → `content`, tolerating a bare array too. */
function rowsOf(res) {
  const data = res?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.list)) return data.list;
  return [];
}

/** All interventions in one page (raw rows — we need `durationMinutes`). */
export async function getMaintenance() {
  const res = await api.get(ENDPOINTS.INTERVENTIONS, {
    params: { page: 0, size: PAGE_SIZE, sort: "createdAt,desc" },
  });
  return rowsOf(res);
}

/** All alerts in one page. */
export async function getAlerts() {
  const res = await api.get(ENDPOINTS.ALERTS, {
    params: { page: 0, size: PAGE_SIZE, sort: "timestamp,desc" },
  });
  return rowsOf(res);
}

/** All machines in one page. */
export async function getMachines() {
  const res = await api.get(ENDPOINTS.MACHINES, {
    params: { page: 0, size: PAGE_SIZE, sort: "code,asc" },
  });
  return rowsOf(res);
}

/**
 * GET /api/dashboard/health-scores → `{ totalMachines, averageScore,
 * distribution, machines: [{ machineCode, score, grade }] }`.
 * Shared with the dashboard (same 90 s timeout, same route).
 */
export async function getHealthScores() {
  return _getHealthScores();
}
