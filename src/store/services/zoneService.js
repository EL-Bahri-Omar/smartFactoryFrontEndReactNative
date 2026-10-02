// src/store/services/zoneService.js
//
// CONFIRMED Sprint 1 against smartFactoryBackEndSpringBoot ZoneController.
// - GET    /api/zones -> array [{ id, name, description, location, machineCount, ... }]
// - GET    /api/zones/:id -> zone
// - POST   /api/zones (ADMIN) { name, description?, location? } -> 201 zone
// - PUT    /api/zones/:id (ADMIN) -> zone
// - DELETE /api/zones/:id (ADMIN) -> 204
// - GET    /api/zones/:id/machines -> machines in the zone
// NOTE: no alertCount in Sprint 1 — the map treats it as 0 until alerts ship.

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/zones -> array */
export async function getAll() {
  const response = await api.get(ENDPOINTS.ZONES);
  return response.data;
}

/** GET /api/zones/:id */
export async function getById(zoneId) {
  const url = buildUrl(ENDPOINTS.ZONE_BY_ID, { id: zoneId });
  const response = await api.get(url);
  return response.data;
}

/** GET /api/zones/:id/machines */
export async function getZoneMachines(zoneId) {
  const url = buildUrl(ENDPOINTS.ZONE_MACHINES, { id: zoneId });
  const response = await api.get(url);
  return response.data;
}

/** POST /api/zones (ADMIN) */
export async function create(body) {
  const response = await api.post(ENDPOINTS.ZONES, body);
  return response.data;
}

/** PUT /api/zones/:id (ADMIN) */
export async function update(zoneId, body) {
  const url = buildUrl(ENDPOINTS.ZONE_BY_ID, { id: zoneId });
  const response = await api.put(url, body);
  return response.data;
}

/** DELETE /api/zones/:id (ADMIN) -> 204 */
export async function remove(zoneId) {
  const url = buildUrl(ENDPOINTS.ZONE_BY_ID, { id: zoneId });
  const response = await api.delete(url);
  return response.data;
}
