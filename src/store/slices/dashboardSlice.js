// src/store/slices/dashboardSlice.js
//
// The real landing dashboard (Sprint 7).
//
// The dashboard is the FIRST screen after login, so it has to be fast: it
// issues one small, parallel fan-out instead of re-using the heavy list
// endpoints the Machines/Alerts/Maintenance screens load.
//
//   GET /api/machines?size=100            → map rows + fallback status counts
//   GET /api/alerts/summary               → exact ACTIVE counts (cheap)
//   GET /api/alerts?status=ACTIVE&size=5  → the 5 newest active alerts
//   GET /api/maintenance?size=100         → open queue (PENDING/…/IN_PROGRESS)
//   GET /api/dashboard/kpis?period=day    → CONFIRMED: MTBF, MTTR, downtime
//   GET /api/dashboard/kpis/history       → CONFIRMED: 7-point availability series
//
//   GET /api/dashboard/overview           → NOT in this fan-out, and NO LONGER
//                                           dispatched at all. Measured on the
//                                           running backend: 156–271 s (every
//                                           other route answers in 15–33 ms).
//                                           It runs computeMachineHealthScore()
//                                           for EVERY machine, and every value
//                                           it patched (status counts, alert
//                                           totals, availability) is already
//                                           derived from the fast calls above.
//                                           See docs/api-contract.md for the
//                                           backend fix spec.
//
// `/api/dashboard/*` is ADMIN | RESPONSABLE | TECHNICIAN only
// (SecurityConfig.java:119) — an OPERATOR caller rejects, and allSettled keeps
// the rest of the dashboard alive. The screen reads `failed.kpis` to decide
// whether that is a 403 or a genuinely empty factory.
//
// It keeps its own state bucket — importing the shared slices here would
// overwrite the lists the other screens are rendering.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { computeMachineHealth, computeFactoryHealth } from "../../lib/health";
import * as machineService from "../services/machineService";
import * as alertService from "../services/alertService";
import * as interventionService from "../services/interventionService";
import * as dashboardService from "../services/dashboardService";

const OPEN_STATUSES = ["PENDING", "ASSIGNED", "IN_PROGRESS"];

// Rows that need attention first, then the ones that are simply running.
// Used for the "Machine Status" list (max 8 rows, ui-notes §2).
const ATTENTION_RANK = { FAILURE: 0, MAINTENANCE: 1, OFFLINE: 2, IDLE: 3, RUNNING: 4 };

function machineList(result) {
  return result?.list || result?.content || [];
}

function summarizeMachines(result) {
  const list = machineList(result);
  const total = result?.totalElements ?? list.length;
  const counts = { total, RUNNING: 0, IDLE: 0, MAINTENANCE: 0, FAILURE: 0, OFFLINE: 0, UNKNOWN: 0 };
  list.forEach((m) => {
    const key = String(m?.status || "UNKNOWN").toUpperCase();
    if (counts[key] != null) counts[key] += 1;
    else counts.UNKNOWN += 1;
  });
  return counts;
}

/** The 8 rows the Machine Status card shows — attention first, code asc. */
function topMachineRows(list) {
  return [...list]
    .sort((a, b) => {
      const ra = ATTENTION_RANK[String(a?.status || "").toUpperCase()] ?? 5;
      const rb = ATTENTION_RANK[String(b?.status || "").toUpperCase()] ?? 5;
      if (ra !== rb) return ra - rb;
      return String(a?.code || a?.name || "").localeCompare(String(b?.code || b?.name || ""));
    })
    .slice(0, 8);
}

const toNum = (v) =>
  v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);

/**
 * Machines Availability, computed on the CLIENT from the real status split:
 * a machine is available while it is RUNNING or IDLE — i.e. it is not in
 * maintenance, not failed and not offline.
 *
 * The backend's `availability` from GET /api/dashboard/kpis is an
 * operating-minutes ratio whose `downtimeMinutes` only counts CORRECTIVE
 * interventions. Preventive work does not move it, so a factory with 5
 * machines in MAINTENANCE still answers 100 % — exactly what the review
 * flagged ("fix machine availability calc"). The backend stays untouched, so
 * the card uses this value instead; the deviation is recorded in
 * docs/api-contract.md. Real counts, honest arithmetic, nothing invented.
 */
function computeAvailability(counts) {
  if (!counts || !counts.total || counts.total <= 0) return null;
  const available = (counts.RUNNING || 0) + (counts.IDLE || 0);
  return Math.round((available / counts.total) * 1000) / 10;
}

/**
 * Tolerant reader for the CONFIRMED `GET /api/dashboard/kpis` payload.
 * Every field of that response is a small nested object
 * (`availability.value`, `mtbf.valueHours`, `mttr.valueMinutes`, `oee.value`);
 * anything missing stays null so the card renders an em dash instead of a
 * made-up 0.
 *
 * `oee.value` is null BY DESIGN — DashboardService.getKpis answers
 * `status: "UNAVAILABLE"` because good-parts/ideal-cycle-time are not
 * instrumented. We surface the status + reason so the screen can say why.
 */
function normalizeKpis(raw) {
  if (!raw || typeof raw !== "object") return null;
  const obj = (v) => (v && typeof v === "object" ? v : {});
  const availability = obj(raw.availability);
  const mtbf = obj(raw.mtbf);
  const mttr = obj(raw.mttr);
  const oee = obj(raw.oee);

  return {
    // NOTE: `availability.value` is read but then replaced by
    // computeAvailability() below — see that function for why.
    availability: toNum(availability.value),
    oee: toNum(oee.value),
    oeeStatus: oee.status || null,
    oeeReason: oee.reason || null,
    // healthScore / totalMachines / activeAlerts come from their own fast
    // sources (health-scores thunk, /machines total, /alerts/summary).
    mtbf: toNum(mtbf.valueHours),
    mtbfNote: mtbf.note || null,
    mtbfFailures: toNum(mtbf.failureCount),
    mttr: toNum(mttr.valueMinutes),
    operatingMinutes: toNum(availability.operatingMinutes),
    downtimeMinutes: toNum(availability.downtimeMinutes),
    // The Sprint 7 payload carries no deltas — the trend chips stay hidden
    // rather than being invented.
    deltas: { totalMachines: null, availability: null, activeAlerts: null, oee: null },
  };
}

/**
 * Fallback KPIs computed from CONFIRMED data (counts, not fabrications).
 * Used when the Sprint 7 endpoints are unreachable for this role — the
 * availability here is the client-side RUNNING+IDLE/total split (the same
 * definition the KPI card always shows), so the number does not jump around
 * depending on which source answered.
 */
function deriveKpis(summary, alerts) {
  if (!summary && !alerts) return null;
  const total = summary ? summary.total : null;
  return {
    totalMachines: total,
    availability: computeAvailability(summary),
    activeAlerts: alerts ? alerts.active : null,
    oee: null,
    oeeStatus: null,
    oeeReason: null,
    healthScore: null,
    mtbf: null,
    mtbfNote: null,
    mtbfFailures: null,
    mttr: null,
    operatingMinutes: null,
    downtimeMinutes: null,
    deltas: { totalMachines: null, availability: null, activeAlerts: null, oee: null },
  };
}

/**
 * `GET /api/dashboard/kpis/history` is a bare array of buckets. Keep only
 * what we plot and drop malformed rows (a null availability would draw as 0).
 */
function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return null;
  const points = raw
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      timestamp: p.timestamp || null,
      availability: toNum(p.availability),
      failuresCount: toNum(p.failuresCount),
      downtimeMinutes: toNum(p.downtimeMinutes),
    }));
  return points.length ? points : null;
}

function summarizeInterventions(result) {
  const list = result?.list || [];
  const open = list.filter((t) => OPEN_STATUSES.includes(t.status));
  const counts = { PENDING: 0, ASSIGNED: 0, IN_PROGRESS: 0 };
  open.forEach((t) => {
    if (counts[t.status] != null) counts[t.status] += 1;
  });
  // Soonest planned / most urgent first.
  const byUrgency = [...open].sort((a, b) => {
    const pa = a.priority === "HIGH" ? 0 : a.priority === "MEDIUM" ? 1 : 2;
    const pb = b.priority === "HIGH" ? 0 : b.priority === "MEDIUM" ? 1 : 2;
    if (pa !== pb) return pa - pb;
    const ta = new Date(a.scheduledAt || a.createdAt || 0).getTime();
    const tb = new Date(b.scheduledAt || b.createdAt || 0).getTime();
    return ta - tb;
  });
  return {
    total: result?.totalElements ?? list.length,
    open: open.length,
    ...counts,
    upcoming: byUrgency.slice(0, 5),
  };
}

const skipped = () => Promise.resolve(null);

export const fetchDashboard = createAsyncThunk(
  "dashboard/fetch",
  /**
   * @param {{ machines?: boolean, alerts?: boolean, interventions?: boolean,
   *           kpis?: boolean }} scope
   *   Only fan out for what this role may read — avoids a pointless 403 and
   *   keeps the first paint fast. `kpis` targets the CONFIRMED Sprint 7
   *   routes, which are ADMIN | RESPONSABLE | TECHNICIAN only
   *   (SecurityConfig.java:119): an OPERATOR caller rejects and the other
   *   blocks still render, with `failed.kpis` set.
   */
  async (
    {
      machines = true,
      alerts = true,
      interventions = true,
      kpis = true,
    } = {},
    { rejectWithValue }
  ) => {
    const [
      machinesRes,
      summaryRes,
      alertsRes,
      interventionsRes,
      kpisRes,
      historyRes,
    ] = await Promise.allSettled([
      // size=500 (not 100): the whole-fleet status split below is counted from
      // THIS page, so it must cover every machine — there is no /overview
      // fallback any more (that route measured 156–271 s).
      machines ? machineService.getAll({ size: 500 }) : skipped(),
      alerts ? alertService.getSummary() : skipped(),
      // 500, not 5: the Fan-out needs EVERY active alert to score the fleet
      // machine-by-machine (see computeMachineHealth). The "Recent Activity"
      // block keeps the newest 5 from the same response — one request, not two.
      alerts ? alertService.getAll({ status: "ACTIVE", size: 500, sort: "timestamp,desc" }) : skipped(),
      interventions ? interventionService.getAll({ size: 100 }) : skipped(),
      kpis ? dashboardService.getKpis({ period: "day" }) : skipped(),
      kpis ? dashboardService.getKpisHistory({ period: "week", points: 7 }) : skipped(),
    ]);

    // A skipped source resolves to `null` (not a failure); a failed one rejects.
    const ok = (r) => r.status === "fulfilled" && r.value !== null;
    const failed = (r) => r.status === "rejected";

    const payload = {
      machines: ok(machinesRes) ? summarizeMachines(machinesRes.value) : null,
      // Raw rows: the map groups them by zoneId and the status card picks 8.
      machineRows: ok(machinesRes) ? topMachineRows(machineList(machinesRes.value)) : [],
      allMachines: ok(machinesRes) ? machineList(machinesRes.value) : [],
      alerts: null,
      interventions: ok(interventionsRes) ? summarizeInterventions(interventionsRes.value) : null,
      // ── Sprint 7 — CONFIRMED (DashboardController) ────────────────────────
      // Whole-fleet status split; falls back to the counted machine page.
      statusCounts: ok(machinesRes) ? summarizeMachines(machinesRes.value) : null,
      history: ok(historyRes) ? normalizeHistory(historyRes.value) : null,
      kpisFromApi: false,
      kpis: null,
      failed: {
        machines: failed(machinesRes),
        alerts: failed(summaryRes) && failed(alertsRes),
        interventions: failed(interventionsRes),
        kpis: failed(kpisRes),
        history: failed(historyRes),
      },
      fetchedAt: Date.now(),
    };

    if (ok(summaryRes) || ok(alertsRes)) {
      const summary = ok(summaryRes) ? summaryRes.value || {} : {};
      const rows = ok(alertsRes) ? alertsRes.value?.list || [] : [];
      payload.alerts = {
        active: Number(summary.activeCount ?? alertsRes.value?.totalElements ?? rows.length) || 0,
        critical: Number(summary.criticalActiveCount ?? 0) || 0,
        high: Number(summary.highActiveCount ?? 0) || 0,
        warning: Number(summary.warningActiveCount ?? 0) || 0,
        acknowledged: Number(summary.acknowledgedCount ?? 0) || 0,
        // Newest 5 — what "Recent Activity" renders.
        recent: rows.slice(0, 5),
        // Every ACTIVE alert, grouped by machine — feeds the health score.
        allActive: rows,
      };
    }

    // ── Factory Health Score, computed FRONTEND-side (src/lib/health.js) ────
    // The backend route that does this measured 151–339 s, so the score is
    // built here from the fleet + alert rows this thunk already fetched:
    // each sensor owns 25 pts, split 12.5 degraded (WARNING) + 12.5 anomaly
    // (HIGH/CRITICAL) — one ACTIVE alert per sensor IS that state. FAILURE → 0,
    // MAINTENANCE → 50, OFFLINE → no score (null, dropped from the average).
    // The factory score is the mean of the non-OFFLINE machines. Never
    // fabricated — a machine with no status contributes no score.
    const fleet = payload.allMachines || [];
    if (fleet.length) {
      const alertsByMachine = new Map();
      (payload.alerts?.allActive || []).forEach((a) => {
        const id = a?.machineId;
        if (!id) return;
        if (!alertsByMachine.has(id)) alertsByMachine.set(id, []);
        alertsByMachine.get(id).push(a);
      });
      const scores = fleet.map((m) =>
        // An ACTIVE alert row IS one sensor out of range (one per machine +
        // sensorType), so its severity maps straight onto the model's two
        // halves: WARNING → degraded (12.5), HIGH/CRITICAL → anomaly (25).
        // `sensors:` is the ONLY input — passing both alerts and breaches used
        // to charge the same sensor twice.
        computeMachineHealth({
          status: m?.status,
          sensors: alertsByMachine.get(m?.id) || [],
        })
      );
      payload.machineHealth = fleet.map((m, i) => ({
        machineId: m?.id ?? null,
        machineCode: m?.code || m?.name || "—",
        score: scores[i],
      }));
      const factoryScore = computeFactoryHealth(scores);
      if (factoryScore != null) payload.factoryHealthScore = factoryScore;
    }

    // KPIs: real Sprint 7 numbers when /kpis answers, overlaid on values
    // derived from the CONFIRMED data above (so a blocked /kpis still leaves
    // totals + alert counts on screen). Never fabricated — a null stays null.
    const derived = deriveKpis(payload.machines, payload.alerts) || {};
    const api = ok(kpisRes) ? normalizeKpis(kpisRes.value) : null;
    const merged = { ...derived };
    if (api) {
      Object.keys(api).forEach((k) => {
        if (k === "deltas") return;
        if (api[k] !== null && api[k] !== undefined) merged[k] = api[k];
      });
      merged.deltas = api.deltas;
    }
    // The backend's operating-minutes ratio does not count preventive work —
    // replace it with the status-split definition (see computeAvailability).
    const clientAvailability = computeAvailability(payload.statusCounts);
    if (clientAvailability != null) merged.availability = clientAvailability;
    // Frontend-computed score (src/lib/health.js) always wins over anything
    // derived: it is instant, complete and is the average of every machine.
    if (payload.factoryHealthScore != null) merged.healthScore = payload.factoryHealthScore;
    payload.kpisFromApi = Boolean(api);
    payload.kpis = Object.keys(merged).length ? merged : null;

    // A dashboard where every single block failed is a real error, not an
    // "empty factory" — let the screen show the retry state.
    if (!payload.machines && !payload.alerts && !payload.interventions) {
      return rejectWithValue({ message: "Could not load the dashboard." });
    }
    return payload;
  }
);

// GET /api/dashboard/health-scores is intentionally NOT called any more — it
// measured 151–339 s (docs/api-contract.md). The Factory Health Score is
// computed inside fetchDashboard instead, from the fleet + alert rows it
// already has: see src/lib/health.js.

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    data: null,
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    error: null,
    // Factory Health Score lives in data.kpis.healthScore (computed in the
    // thunk) and data.factoryHealthScore (raw mean) — no extra request.
  },
  reducers: {
    clearDashboard(state) {
      state.data = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.data = action.payload;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Could not load the dashboard." };
      });
      // Factory Health Score: computed in the thunk (src/lib/health.js) —
      // GET /api/dashboard/health-scores (151–339 s) is never dispatched.
  },
});

export const { clearDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
