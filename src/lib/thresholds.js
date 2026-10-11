// src/lib/thresholds.js
//
// Per-machine sensor thresholds (seuils), stored in the database TODAY using
// the existing Machine.caracteristiques[] field — no backend change needed
// for storage. Entries use { nom, valeur, type: "seuil" }:
//
//   nom    = "seuil.<TYPE>.<key>"   e.g. "seuil.TEMPERATURE.warning"
//   valeur = number as string        e.g. "62.5"  (valeur is a String server-side)
//   type   = "seuil"
//
// Keys per sensor type:
//   TEMPERATURE | VIBRATION | CURRENT : { warning, critical } (high thresholds)
//   RPM                             : { warningLow, warningHigh, criticalLow, criticalHigh }
//
// Until the backend reads these entries (spec in docs/api-contract.md), it
// keeps enforcing its hardcoded defaults — mirrored here so the UI shows the
// effective values and the simulator can already check breaches per machine.

import { SENSOR_TYPE } from "../constants/roles";

export const SEUIL_TYPE = "seuil";

export const DEFAULT_THRESHOLDS = Object.freeze({
  [SENSOR_TYPE.TEMPERATURE]: Object.freeze({ warning: 60, critical: 80 }),
  [SENSOR_TYPE.VIBRATION]: Object.freeze({ warning: 4.5, critical: 8 }),
  [SENSOR_TYPE.CURRENT]: Object.freeze({ warning: 9.5, critical: 13 }),
  [SENSOR_TYPE.RPM]: Object.freeze({ warningLow: 1000, warningHigh: 1800, criticalLow: 500, criticalHigh: 2000 }),
});

const KEYS_BY_TYPE = {
  [SENSOR_TYPE.TEMPERATURE]: ["warning", "critical"],
  [SENSOR_TYPE.VIBRATION]: ["warning", "critical"],
  [SENSOR_TYPE.CURRENT]: ["warning", "critical"],
  [SENSOR_TYPE.RPM]: ["warningLow", "warningHigh", "criticalLow", "criticalHigh"],
};

export function seuilName(type, key) {
  return `seuil.${type}.${key}`;
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Effective thresholds for a machine: stored seuil entries override defaults.
 * @returns {{ values: object, custom: boolean }}
 */
export function getThresholds(machine) {
  const values = {};
  for (const [type, keys] of Object.entries(KEYS_BY_TYPE)) {
    values[type] = { ...DEFAULT_THRESHOLDS[type] };
  }
  let custom = false;
  const list = machine?.caracteristiques || [];
  for (const entry of list) {
    if (!entry || entry.type !== SEUIL_TYPE || typeof entry.nom !== "string") continue;
    const match = entry.nom.match(/^seuil\.([A-Z]+)\.([A-Za-z]+)$/);
    if (!match) continue;
    const [, type, key] = match;
    if (!values[type] || !(key in values[type])) continue;
    values[type][key] = toNumber(entry.valeur, values[type][key]);
    custom = true;
  }
  return { values, custom };
}

/**
 * Return a new caracteristiques array with seuil entries replaced by `values`,
 * keeping every non-seuil entry untouched.
 */
export function withThresholds(machine, values) {
  const kept = (machine?.caracteristiques || []).filter((e) => e?.type !== SEUIL_TYPE);
  const seuilEntries = [];
  for (const [type, keys] of Object.entries(KEYS_BY_TYPE)) {
    for (const key of keys) {
      const raw = values?.[type]?.[key];
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      seuilEntries.push({ nom: seuilName(type, key), valeur: String(n), type: SEUIL_TYPE });
    }
  }
  return [...kept, ...seuilEntries];
}

/**
 * Validate threshold values. Returns an error string or null.
 */
export function validateThresholds(values) {
  for (const type of [SENSOR_TYPE.TEMPERATURE, SENSOR_TYPE.VIBRATION, SENSOR_TYPE.CURRENT]) {
    const v = values?.[type] || {};
    if (!Number.isFinite(Number(v.warning)) || !Number.isFinite(Number(v.critical))) {
      return `${type}: warning and critical must be numbers.`;
    }
    if (Number(v.warning) >= Number(v.critical)) {
      return `${type}: warning must be below critical.`;
    }
    if (Number(v.warning) < 0 || Number(v.critical) < 0) {
      return `${type}: thresholds cannot be negative.`;
    }
  }
  const rpm = values?.[SENSOR_TYPE.RPM] || {};
  for (const key of KEYS_BY_TYPE[SENSOR_TYPE.RPM]) {
    if (!Number.isFinite(Number(rpm[key]))) return `RPM: ${key} must be a number.`;
  }
  if (!(Number(rpm.criticalLow) < Number(rpm.warningLow) && Number(rpm.warningLow) < Number(rpm.warningHigh) && Number(rpm.warningHigh) < Number(rpm.criticalHigh))) {
    if (!(Number(rpm.criticalLow) < Number(rpm.warningLow))) return "RPM: critical low must be below warning low.";
    if (!(Number(rpm.warningLow) < Number(rpm.warningHigh))) return "RPM: warning low must be below warning high.";
    return "RPM: warning high must be below critical high.";
  }
  return null;
}
