// src/store/services/dashboardService.js
//
// Sprint 7 (docs/prompts/12-dashboard.md). BOTH endpoints are ASSUMED — the
// backend does not expose /api/dashboard/* yet (verified: no Dashboard* or
// Report* controller in smartFactoryBackEndSpringBoot).
//
// The dashboard screen never depends on them: `dashboardSlice.fetchDashboard`
// fans out over CONFIRMED endpoints (machines / alerts summary / alerts /
// maintenance) and calls these as OPTIONAL sources inside `allSettled`, so a
// 404 simply means "OEE and the delta chips stay empty until Sprint 7 lands".
//
// Do NOT add a fallback/mock response here — an empty result must reach the
// screen as an empty result.

import api from "../../lib/axios";
import { ENDPOINTS } from "../../constants/api";

/**
 * GET /api/dashboard/kpis — ASSUMED.
 * Expected shape (tolerant reader lives in dashboardSlice):
 *   { totalMachines, availability, activeAlerts, oee, mtbf, mttr, healthScore,
 *     deltas: { totalMachines, availability, activeAlerts, oee } }
 * @returns {Promise<Object>} raw payload
 */
export async function getKpis() {
  const response = await api.get(ENDPOINTS.DASHBOARD_KPIS);
  return response.data;
}

/**
 * GET /api/dashboard/summary — ASSUMED. Optional aggregate block.
 * @returns {Promise<Object>} raw payload
 */
export async function getSummary() {
  const response = await api.get(ENDPOINTS.DASHBOARD_SUMMARY);
  return response.data;
}
