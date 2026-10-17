// src/store/services/telemetryService.js
//
// CONFIRMED Sprint 4 against SensorReadingController (telemetry + history).
// machineId accepts the Mongo id OR the code everywhere.

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/machines/:id/sensors/{temperature|vibration|current|rpm}/current */
export async function getCurrent(machineId, sensorPath) {
  const templates = {
    TEMPERATURE: ENDPOINTS.MACHINE_CURRENT_TEMPERATURE,
    VIBRATION: ENDPOINTS.MACHINE_CURRENT_VIBRATION,
    CURRENT: ENDPOINTS.MACHINE_CURRENT_CURRENT,
    RPM: ENDPOINTS.MACHINE_CURRENT_RPM,
  };
  const url = buildUrl(templates[sensorPath], { id: machineId });
  const response = await api.get(url);
  return response.data;
}

/** GET /api/machines/:id/readings/latest -> full snapshot + status */
export async function getLatest(machineId) {
  const url = buildUrl(ENDPOINTS.MACHINE_READINGS_LATEST, { id: machineId });
  const response = await api.get(url);
  return response.data;
}

/** GET /api/machines/:id/status -> { machineId, machineCode, name, status, lastSeen, isOnline } */
export async function getStatusInfo(machineId) {
  const url = buildUrl(ENDPOINTS.MACHINE_STATUS_INFO, { id: machineId });
  const response = await api.get(url);
  return response.data;
}

/** PUT /api/machines/:id/status { status } (MACHINE_WRITE) */
export async function updateStatus(machineId, status) {
  const url = buildUrl(ENDPOINTS.MACHINE_STATUS_INFO, { id: machineId });
  const response = await api.put(url, { status });
  return response.data;
}

/**
 * GET /api/machines/:id/readings/timeseries
 * Params: sensorType?, period=1h|24h|7d|30d, from/to, aggregate=avg, maxPoints.
 * -> { machineId, machineCode, sensorType, from, to, period, totalPoints, points[] }
 * points: [{ timestamp, value, unit, sensorType }], ascending.
 */
export async function getTimeseries({ machineId, sensorType, period, from, to, aggregate = "avg", maxPoints = 200 } = {}) {
  const url = buildUrl(ENDPOINTS.MACHINE_TIMESERIES, { id: machineId });
  const response = await api.get(url, {
    params: {
      sensorType: sensorType || undefined,
      period: period || undefined,
      from: from || undefined,
      to: to || undefined,
      aggregate,
      maxPoints,
    },
  });
  return response.data;
}
