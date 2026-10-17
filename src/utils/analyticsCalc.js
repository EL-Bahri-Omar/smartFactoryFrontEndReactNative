// src/utils/analyticsCalc.js
//
// Client-side analytics computations — no /api/analytics backend.
// Derived from timeseries readings + thresholds:
//   - Average per sensor type
//   - Health score (100 - breach penalty / points)
//   - Breach count (warning + critical)
//   - Export CSV generation

import { SENSOR_TYPE, SENSOR_UNIT } from "../constants/roles";

/**
 * Compute average for each sensor type from grouped readings.
 * @param {Object} groups — { TEMPERATURE: [{value}], VIBRATION: [{value}], ... }
 * @returns {{ sensorType: string, avg: number, count: number, unit: string }[]}
 */
export function computeAverages(groups) {
  return Object.entries(groups).map(([type, points]) => {
    if (!points || points.length === 0) {
      return { sensorType: type, avg: null, count: 0, unit: SENSOR_UNIT[type] || "" };
    }
    const sum = points.reduce((s, p) => s + (Number(p.value) || 0), 0);
    return {
      sensorType: type,
      avg: sum / points.length,
      count: points.length,
      unit: SENSOR_UNIT[type] || points[0]?.unit || "",
    };
  });
}

/**
 * Count threshold breaches per sensor type.
 * @param {Object} groups — { TEMPERATURE: [{value}], ... }
 * @param {Object[]} thresholds — [{ sensorType, warningMin, warningMax, criticalMin, criticalMax }]
 * @returns {{ sensorType: string, warnings: number, criticals: number, total: number }[]}
 */
export function countBreaches(groups, thresholds = []) {
  const thresholdMap = {};
  thresholds.forEach((t) => {
    if (t?.sensorType) thresholdMap[t.sensorType] = t;
  });

  return Object.entries(groups).map(([type, points]) => {
    const thr = thresholdMap[type];
    if (!thr || thr.active === false || !points?.length) {
      return { sensorType: type, warnings: 0, criticals: 0, total: points?.length || 0 };
    }
    let warnings = 0;
    let criticals = 0;
    for (const p of points) {
      const v = Number(p.value);
      if (Number.isNaN(v)) continue;
      const cMax = thr.criticalMax != null ? Number(thr.criticalMax) : null;
      const cMin = thr.criticalMin != null ? Number(thr.criticalMin) : null;
      const wMax = thr.warningMax != null ? Number(thr.warningMax) : null;
      const wMin = thr.warningMin != null ? Number(thr.warningMin) : null;
      if ((cMax != null && v >= cMax) || (cMin != null && v <= cMin)) {
        criticals++;
      } else if ((wMax != null && v >= wMax) || (wMin != null && v <= wMin)) {
        warnings++;
      }
    }
    return { sensorType: type, warnings, criticals, total: points.length };
  });
}

/**
 * Compute health score: 100 - (penalty / totalPoints * 100).
 * CRITICAL = 2 penalty points, WARNING = 1 penalty point.
 * @param {Object[]} breaches — output of countBreaches
 * @returns {{ score: number, label: string, totalBreaches: number }}
 */
export function computeHealthScore(breaches = []) {
  let totalPoints = 0;
  let penalty = 0;
  let totalBreaches = 0;

  for (const b of breaches) {
    totalPoints += b.total || 0;
    penalty += (b.criticals || 0) * 2 + (b.warnings || 0) * 1;
    totalBreaches += (b.criticals || 0) + (b.warnings || 0);
  }

  if (totalPoints === 0) {
    return { score: 100, label: "No Data", totalBreaches: 0 };
  }

  const raw = Math.max(0, 100 - (penalty / totalPoints) * 100);
  const score = Math.round(raw * 10) / 10;

  let label = "Excellent";
  if (score < 50) label = "Critical";
  else if (score < 70) label = "Poor";
  else if (score < 85) label = "Good";
  else if (score < 95) label = "Very Good";

  return { score, label, totalBreaches };
}

/**
 * Generate CSV content from readings.
 * @param {Object[]} readings — flat array of { sensorType, value, unit, timestamp }
 * @param {string} machineCode — machine identifier for header
 * @returns {string} — CSV content
 */
export function generateCSV(readings = [], machineCode = "machine") {
  const header = "Timestamp,Sensor Type,Value,Unit";
  const rows = readings.map((r) => {
    const ts = r.timestamp || "";
    const type = r.sensorType || "";
    const val = r.value ?? "";
    const unit = r.unit || SENSOR_UNIT[type] || "";
    return `${ts},${type},${val},${unit}`;
  });
  return [header, ...rows].join("\n");
}

/**
 * Download CSV on web, or return the content for native share.
 * @param {string} csvContent
 * @param {string} filename
 */
export function downloadCSV(csvContent, filename = "readings.csv") {
  if (typeof document !== "undefined") {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }
  return false; // Native: caller should use Share.share({ message: csvContent })
}
