// src/store/services/sensorService.js
//
// CONFIRMED Sprint 3 against smartFactoryBackEndSpringBoot MachineController.
// - GET /api/machines/:id/sensors -> array
//   [{ id, machineId, type, unit, status, lastSeen, timeoutSeconds,
//      createdAt, updatedAt }]
// - status ∈ ONLINE | OFFLINE | MAINTENANCE (US19 offline detection).
// - Sensors auto-provision on first MQTT message: empty array = this
//   machine never published. No POST/PUT/DELETE endpoints in Sprint 3.
// NOTE: pass the Mongo id, not the code — the controller resolves by id only.

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/machines/:id/sensors -> array (empty when never published) */
export async function getMachineSensors(machineId) {
  const url = buildUrl(ENDPOINTS.MACHINE_SENSORS, { id: machineId });
  const response = await api.get(url);
  return Array.isArray(response.data) ? response.data : [];
}
