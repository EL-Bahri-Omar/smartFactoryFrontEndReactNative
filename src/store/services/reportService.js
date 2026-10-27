// src/store/services/reportService.js
//
// Sprint 7 (docs/prompts/13-reports.md). ALL THREE endpoints are ASSUMED —
// there is no Report*/Dashboard* controller in the backend yet. A 404/500 is
// expected until the coworker ships Sprint 7 and must surface as the chart's
// empty/error state, never as fabricated data.

import api from "../../lib/axios";
import { ENDPOINTS } from "../../constants/api";

/**
 * GET /api/reports/downtime?from=&to= — ASSUMED.
 * Expected shape (tolerant reader lives in reportSlice):
 *   { totalHours, deltaPercent, maintenanceCount, maintenanceDeltaPercent,
 *     avgHealthScore, healthDeltaPercent,
 *     byMachine: [{ machineCode, hours, percent }] }
 * @param {{ from?: string, to?: string }} [params] ISO dates
 */
export async function getDowntime({ from, to } = {}) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const response = await api.get(ENDPOINTS.REPORT_DOWNTIME, { params });
  return response.data;
}

/**
 * GET /api/reports/performance?range= — ASSUMED.
 * range: "this_week" | "this_month" | "last_month"
 * Expected shape:
 *   { machines: ["CNC", ...],
 *     series: [{ key, label, color, values: [{ machineCode, value }] }] }
 * (an array of series, or a `values` object map, is also accepted)
 * @param {{ range?: string }} [params]
 */
export async function getPerformance({ range = "this_month" } = {}) {
  const response = await api.get(ENDPOINTS.REPORT_PERFORMANCE, { params: { range } });
  return response.data;
}

/**
 * POST /api/reports/generate — ASSUMED.
 * @param {{ tab?: string, range?: string, from?: string, to?: string, format?: string }} body
 */
export async function generateReport(body = {}) {
  const response = await api.post(ENDPOINTS.REPORT_GENERATE, body);
  return response.data;
}
