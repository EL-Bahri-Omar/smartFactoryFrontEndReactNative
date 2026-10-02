// src/utils/formatHelper.js
// Number, unit, and date formatting helpers. English only.

import { SENSOR_UNIT } from "../constants/roles";

/**
 * Format a number with locale separators.
 * @param {number} value
 * @param {number} [decimals=1]
 */
export function formatNumber(value, decimals = 1) {
  if (value == null || isNaN(value)) return "—";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a sensor value with its unit.
 * @param {number} value
 * @param {string} sensorType  e.g. "TEMPERATURE"
 */
export function formatSensorValue(value, sensorType) {
  if (value == null || isNaN(value)) return "—";
  const unit = SENSOR_UNIT[sensorType] || "";
  return `${formatNumber(value)} ${unit}`.trim();
}

/**
 * Format a percentage with a sign.
 * @param {number} value  e.g. 1.2 or -0.5
 * @param {number} [decimals=1]
 */
export function formatPercent(value, decimals = 1) {
  if (value == null || isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, decimals)}%`;
}

/**
 * Truncate a string to maxLength and add "…".
 * @param {string} str
 * @param {number} [maxLength=50]
 */
export function truncate(str, maxLength = 50) {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

/**
 * Capitalize the first letter of a string.
 * @param {string} str
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Format a duration in minutes to "Xh Ym".
 * @param {number} minutes
 */
export function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
