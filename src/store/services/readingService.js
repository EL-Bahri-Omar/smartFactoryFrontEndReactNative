// src/store/services/readingService.js
//
// CONFIRMED Sprint 3 against smartFactoryBackEndSpringBoot SensorReadingController.
// GET /api/machines/{id}/readings?from=&to=&sensorType=&page=&size=&sort=
// -> paginated { content, page, size, totalElements, totalPages }.
// Accepts the Mongo id OR the code. Size caps at 100 server-side;
// sort defaults to timestamp,desc — the chart requests timestamp,asc.

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";
import { SENSOR_UNIT } from "../../constants/roles";

/**
 * GET /api/machines/{id}/readings
 * @param {{ machineId: string, from?: string, to?: string, sensorType?: string, page?: number, size?: number, sort?: string }} params
 */
export async function getByMachine({ machineId, from, to, sensorType, page = 0, size = 100, sort = "timestamp,asc" } = {}) {
  const url = buildUrl(ENDPOINTS.MACHINE_READINGS, { id: machineId });
  const response = await api.get(url, {
    params: {
      from,
      to,
      sensorType: sensorType || undefined,
      page,
      size,
      sort,
    },
  });
  return normalizeReadings(response.data);
}

/**
 * GET /api/machines/{id}/readings — paged variant, keeps the envelope meta
 * for tables: { list, page, size, totalElements, totalPages }.
 */
export async function getByMachinePage({ machineId, from, to, sensorType, page = 0, size = 20, sort = "timestamp,desc" } = {}) {
  const url = buildUrl(ENDPOINTS.MACHINE_READINGS, { id: machineId });
  const response = await api.get(url, {
    params: {
      from,
      to,
      sensorType: sensorType || undefined,
      page,
      size,
      sort,
    },
  });
  const data = response.data || {};
  return {
    list: normalizeReadings(data),
    page: data.page ?? page,
    size: data.size ?? size,
    totalElements: data.totalElements ?? 0,
    totalPages: data.totalPages ?? 0,
  };
}
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
