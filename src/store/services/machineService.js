// src/store/services/machineService.js
//
// CONFIRMED Sprint 1 against smartFactoryBackEndSpringBoot MachineController.
// - GET  /api/machines?zoneId=&status=&search=&page=&size=&sort= -> paginated
// - GET  /api/machines/:id -> { id, name, code, type, zoneId, zoneName, status, ... }
// - POST /api/machines (ADMIN) { name, code, type, zoneId?, status?, description?, caracteristiques? }
// - PUT  /api/machines/:id (ADMIN) — full UpdateMachineRequest (name, code, type, status required)
// - DELETE /api/machines/:id (ADMIN) -> 204
// - GET /api/machines/:id/sensors -> [] in Sprint 1 (sensors ship in Sprint 2)

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/machines?status=...&search=... */
export async function getAll(params = {}) {
  const response = await api.get(ENDPOINTS.MACHINES, { params });
  return response.data;
}

/** GET /api/machines/:id */
export async function getById(id) {
  const url = buildUrl(ENDPOINTS.MACHINE_BY_ID, { id });
  const response = await api.get(url);
  return response.data;
}

/** GET /api/machines/:id/sensors — ASSUMED */
export async function getSensors(id) {
  const url = buildUrl(ENDPOINTS.MACHINE_SENSORS, { id });
  const response = await api.get(url);
  return response.data;
}

/** POST /api/machines */
export async function create(body) {
  const response = await api.post(ENDPOINTS.MACHINES, body);
  return response.data;
}

/** PUT /api/machines/:id (ADMIN) — full object required by the backend */
export async function update(id, body) {
  const url = buildUrl(ENDPOINTS.MACHINE_BY_ID, { id });
  const response = await api.put(url, body);
  return response.data;
}

/** DELETE /api/machines/:id */
export async function remove(id) {
  const url = buildUrl(ENDPOINTS.MACHINE_BY_ID, { id });
  const response = await api.delete(url);
  return response.data;
}
