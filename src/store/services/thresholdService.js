// src/store/services/thresholdService.js
//
// CONFIRMED against smartFactoryBackEndSpringBoot MachineThresholdController.
// Thresholds live in MongoDB (`machine_thresholds`, unique {machineId, sensorType}).
// - GET    /api/machines/:id/thresholds -> array (THRESHOLD_READ)
// - GET    /api/machines/:id/thresholds/:sensorType -> one, 404 THRESHOLD_NOT_FOUND (THRESHOLD_READ)
// - POST   /api/machines/:id/thresholds (upsert body) -> 201 (THRESHOLD_WRITE)
// - PUT    /api/machines/:id/thresholds/:sensorType (upsert, type from path) -> 200 (THRESHOLD_WRITE)
// - DELETE /api/machines/:id/thresholds/:sensorType -> 204 (THRESHOLD_WRITE)
// machineId accepts the Mongo id OR the code.
// Body: { sensorType, warningMin?, warningMax?, criticalMin?, criticalMax?,
//         unit?, active?, description? }
// Server validation: warningMin<=warningMax, criticalMin<=criticalMax,
// criticalMin<=warningMin, warningMax<=criticalMax, finite numbers, valid unit.

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/machines/:id/thresholds -> array (empty when none configured) */
export async function getByMachine(machineId) {
  const url = buildUrl(ENDPOINTS.MACHINE_THRESHOLDS, { id: machineId });
  const response = await api.get(url);
  return Array.isArray(response.data) ? response.data : [];
}

/** GET /api/machines/:id/thresholds/:sensorType -> one (404 when missing) */
export async function getOne(machineId, sensorType) {
  const url = buildUrl(ENDPOINTS.MACHINE_THRESHOLD_BY_TYPE, { id: machineId, sensorType });
  const response = await api.get(url);
  return response.data;
}

/**
 * PUT /api/machines/:id/thresholds/:sensorType (upsert).
 * The path type wins — the body sensorType is overwritten server-side.
 */
export async function save(machineId, sensorType, body) {
  const url = buildUrl(ENDPOINTS.MACHINE_THRESHOLD_BY_TYPE, { id: machineId, sensorType });
  const response = await api.put(url, { ...body, sensorType });
  return response.data;
}

/** DELETE /api/machines/:id/thresholds/:sensorType -> 204 */
export async function remove(machineId, sensorType) {
  const url = buildUrl(ENDPOINTS.MACHINE_THRESHOLD_BY_TYPE, { id: machineId, sensorType });
  const response = await api.delete(url);
  return response.data;
}
