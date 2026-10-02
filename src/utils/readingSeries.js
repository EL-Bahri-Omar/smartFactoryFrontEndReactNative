// src/utils/readingSeries.js
import { COLORS } from "../constants/colors";
import { SENSOR_TYPE, SENSOR_UNIT } from "../constants/roles";
import { formatNumber } from "./formatHelper";
import { normalizeReadings } from "../store/services/readingService";

export const SERIES_META = [
  {
    id: SENSOR_TYPE.TEMPERATURE,
    label: "Temperature",
    unit: SENSOR_UNIT.TEMPERATURE,
    color: COLORS.chartTemp,
    icon: "🌡",
    iconBgClass: "bg-danger/10",
  },
  {
    id: SENSOR_TYPE.VIBRATION,
    label: "Vibration",
    unit: SENSOR_UNIT.VIBRATION,
    color: COLORS.chartVibration,
    icon: "〰️",
    iconBgClass: "bg-primary-soft",
  },
  {
    id: SENSOR_TYPE.CURRENT,
    label: "Current",
    unit: SENSOR_UNIT.CURRENT,
    color: COLORS.chartCurrent,
    icon: "⚡",
    iconBgClass: "bg-primary-soft",
  },
  {
    id: SENSOR_TYPE.RPM,
    label: "RPM",
    unit: SENSOR_UNIT.RPM,
    color: COLORS.chartRpm,
    icon: "⟳",
    iconBgClass: "bg-primary-soft",
  },
];

export function mergeReadings(historical = [], live = []) {
  const liveNormalized = normalizeReadings(live);
  const byKey = new Map();
  [...historical, ...liveNormalized].forEach((row) => {
    const key = `${row.sensorType}|${row.timestamp}`;
    byKey.set(key, row);
  });
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
}

export function groupBySensor(readings = []) {
  const groups = {};
  SERIES_META.forEach((meta) => {
    groups[meta.id] = [];
  });
  readings.forEach((row) => {
    if (!groups[row.sensorType]) groups[row.sensorType] = [];
    groups[row.sensorType].push(row);
  });
  Object.keys(groups).forEach((key) => {
    groups[key].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  });
  return groups;
}

export function computeDelta(points = []) {
  if (!points.length) return null;
  const last = points[points.length - 1];
  if (typeof last.delta === "number") return last.delta;
  if (points.length < 2) return null;
  const first = points[0].value;
  if (first === 0) return last.value === 0 ? 0 : 100;
  return ((last.value - first) / Math.abs(first)) * 100;
}

export function buildChartSeries(groups) {
  return SERIES_META.map((meta) => ({
    id: meta.id,
    color: meta.color,
    data: (groups[meta.id] || []).map((row) => ({
      x: new Date(row.timestamp).getTime(),
      y: row.value,
    })),
  })).filter((s) => s.data.length > 0);
}

export function buildMetrics(groups) {
  return SERIES_META.map((meta) => {
    const points = groups[meta.id] || [];
    const last = points[points.length - 1];
    const decimals = meta.id === SENSOR_TYPE.RPM ? 0 : 1;
    return {
      ...meta,
      value: last ? formatNumber(last.value, decimals) : "—",
      unit: last?.unit || meta.unit,
      delta: computeDelta(points),
    };
  });
}

export function incomingToList(message) {
  if (!message) return [];
  return normalizeReadings(message);
}
