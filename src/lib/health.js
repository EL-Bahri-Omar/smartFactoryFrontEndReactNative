// src/lib/health.js
//
// FRONTEND health score — the model agreed in review:
//
//   1. Each machine has 4 sensors. Each sensor owns 25 of the 100 points.
//   2. A sensor's 25 is split in two halves:
//        12.5 → DEGRADED  (threshold WARNING)
//        12.5 → ANOMALY   (threshold CRITICAL)
//      so a sensor in WARNING costs 12.5, and once it escalates to CRITICAL it
//      costs the whole 25 (both halves), not 12.5 on top of 12.5.
//   3. Status OVERRIDES the sensor maths — it is not subtracted from it:
//        FAILURE     → 0    (the machine is down; its sensors no longer matter)
//        MAINTENANCE → 50   (deliberately stopped, scored at half)
//        OFFLINE     → null (NO SCORE — it must not drag the factory average)
//      RUNNING / IDLE / anything else → the sensor maths above.
//   4. Factory score = (sum of every machine score) / (number of machines
//      EXCLUDING the OFFLINE ones). OFFLINE returns null and is dropped from
//      both the sum and the denominator by computeFactoryHealth().
//
// Why not call the backend: `GET /api/dashboard/health-scores` and
// `/api/dashboard/overview` run DashboardService.computeMachineHealthScore(),
// which reads back the WHOLE sensor-reading history per threshold just to look
// at the newest row. MEASURED on the running backend: 151–339 s, while every
// other /api route answers in 15–33 ms. Spec + the Java fix are in
// docs/api-contract.md.
//
// SENSOR_POINTS  = 25   one sensor's share of 100
// DEGRADED_SHARE = 12.5 lost when it goes WARNING
// ANOMALY_SHARE  = 12.5 lost when it goes CRITICAL (on top of DEGRADED_SHARE)
export const SENSOR_POINTS = 25;
export const DEGRADED_SHARE = SENSOR_POINTS / 2; // 12.5
export const ANOMALY_SHARE = SENSOR_POINTS / 2; // 12.5

/** Fixed scores for the statuses that override the sensor maths. */
export const STATUS_SCORE = {
  FAILURE: 0,
  MAINTENANCE: 50,
};

const clamp = (n) => Math.max(0, Math.min(100, n));

/** "WARNING" / "CRITICAL" / "HIGH" → "degraded" / "anomaly" / null. */
export function severityToSensorState(severity) {
  const s = String(severity || "").toUpperCase();
  if (s === "CRITICAL" || s === "HIGH") return "anomaly";
  if (s === "WARNING") return "degraded";
  return null; // INFO / NORMAL / unknown → not a sensor state
}

/**
 * Health score of ONE machine, 0–100, or null when it has no score (OFFLINE).
 *
 * @param {{
 *   status?: string|null,        // RUNNING | IDLE | MAINTENANCE | FAILURE | OFFLINE
 *   sensors?: Array<{severity?: string}|null>|null,  // alert rows w/ sensorType
 *   degraded?: number|null,      // sensors currently in WARNING (0–4)
 *   anomaly?: number|null,       // sensors currently in CRITICAL (0–4)
 * }} [input]
 * @returns {number|null} 0–100, or null for OFFLINE / unknown machine
 */
export function computeMachineHealth(input = {}) {
  const { status, sensors, degraded = 0, anomaly = 0 } = input;
  if (!status) return null;

  const key = String(status).toUpperCase();
  if (key === "OFFLINE") return null;
  if (key in STATUS_SCORE) return STATUS_SCORE[key];

  // Count sensor states from alert rows when explicit counts were not passed.
  // Each alert row IS one sensor out of range (one ACTIVE alert per machine +
  // sensorType), so severity maps straight onto the two halves.
  let deg = Math.max(0, Number(degraded) || 0);
  let ano = Math.max(0, Number(anomaly) || 0);
  if ((!deg && !ano) && Array.isArray(sensors)) {
    sensors.filter(Boolean).forEach((row) => {
      const state = severityToSensorState(row?.severity);
      if (state === "degraded") deg += 1;
      else if (state === "anomaly") ano += 1;
    });
  }

  // A sensor that is CRITICAL has already lost both halves, so only the
  // ANOMALY half is added here — the DEGRADED half is what WARNING costs.
  const lost = deg * DEGRADED_SHARE + ano * (DEGRADED_SHARE + ANOMALY_SHARE);
  return Math.round(clamp(100 - lost));
}

/**
 * Split ACTIVE alert rows into the two sensor states of the health model.
 *
 * One ACTIVE alert exists per (machineId, sensorType), so each row IS one
 * sensor out of range and its severity maps onto a half of that sensor's 25:
 *   WARNING        → degraded (12.5)
 *   HIGH/CRITICAL  → anomaly  (25)
 *   INFO/other     → ignored (not a sensor state)
 *
 * Duplicates per sensor are collapsed to the WORST state, and rows without a
 * sensorType are skipped (they are not sensor breaches).
 *
 * @param {Array<{sensorType?: string|null, severity?: string}|null>|null} alerts
 * @returns {{ degraded: number, anomaly: number }}
 */
export function sensorStatesFromAlerts(alerts) {
  const worst = new Map();
  (Array.isArray(alerts) ? alerts : [])
    .filter(Boolean)
    .forEach((a) => {
      if (!a?.sensorType) return;
      const state = severityToSensorState(a?.severity);
      if (!state) return;
      const key = String(a.sensorType);
      const rank = state === "anomaly" ? 2 : 1;
      if (!worst.has(key) || worst.get(key) < rank) worst.set(key, rank);
    });
  let degraded = 0;
  let anomaly = 0;
  worst.forEach((rank) => {
    if (rank === 2) anomaly += 1;
    else degraded += 1;
  });
  return { degraded, anomaly };
}

/**
 * Factory Health Score = (sum of all machine scores) / (machines EXCLUDING
 * OFFLINE). OFFLINE machines return null from computeMachineHealth and are
 * dropped from both the sum and the denominator, so they never dilute the
 * average — the exact "divide by the machines except offline" rule.
 *
 * @param {Array<number|null|undefined>} scores
 * @returns {number|null} one decimal, null when no machine has a score
 */
export function computeFactoryHealth(scores) {
  const valid = (scores || []).map(Number).filter((n) => Number.isFinite(n));
  if (!valid.length) return null;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  return Math.round(mean * 10) / 10;
}
