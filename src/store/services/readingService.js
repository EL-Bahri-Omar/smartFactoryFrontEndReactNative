// src/store/services/readingService.js
//
// URLs are ASSUMED. Update + move to CONFIRMED in docs/api-contract.md
// once the Sprint 4 monitoring endpoints ship.

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";
import { SENSOR_UNIT } from "../../constants/roles";

/**
 * GET /api/machines/{id}/readings?from=&to=&sensorType=
 * @param {{ machineId: string, from?: string, to?: string, sensorType?: string }} params
 */
export async function getByMachine({ machineId, from, to, sensorType } = {}) {
  const url = buildUrl(ENDPOINTS.MACHINE_READINGS, { id: machineId });
  const response = await api.get(url, {
    params: {
      from,
      to,
      sensorType: sensorType || undefined,
    },
  });
  return normalizeReadings(response.data);
}

/**
 * Accept array, page, { readings }, or { series: { TYPE: [{t,v}] } }.
 */
export function normalizeReadings(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(normalizeOne).filter(Boolean);
  if (Array.isArray(data.content)) return data.content.map(normalizeOne).filter(Boolean);
  if (Array.isArray(data.readings)) return data.readings.map(normalizeOne).filter(Boolean);
  if (data.series && typeof data.series === "object") {
    return Object.entries(data.series).flatMap(([type, points]) =>
      (points || []).map((point) =>
        normalizeOne({
          ...point,
          sensorType: point.sensorType || type,
        })
      )
    );
  }
  const single = normalizeOne(data);
  return single ? [single] : [];
}

function normalizeOne(row) {
  if (!row || typeof row !== "object") return null;
  const sensorType = String(row.sensorType || row.type || "").toUpperCase();
  const value = Number(row.value ?? row.v);
  const timestamp = row.timestamp || row.ts || row.time || row.createdAt;
  if (!sensorType || timestamp == null || Number.isNaN(value)) return null;
  return {
    sensorType,
    value,
    unit: row.unit || SENSOR_UNIT[sensorType] || "",
    timestamp,
    delta: typeof row.delta === "number" ? row.delta : undefined,
  };
}
