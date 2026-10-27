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
//   GET /api/dashboard/overview           → CONFIRMED Sprint 7: factory status,
//                                           machinesByStatus, alerts, health score
//   GET /api/dashboard/kpis?period=day    → CONFIRMED: availability %, MTBF, MTTR
//   GET /api/dashboard/kpis/history       → CONFIRMED: 7-point availability series
//
// `/api/dashboard/*` is ADMIN | RESPONSABLE | TECHNICIAN only
// (SecurityConfig.java:119) — an OPERATOR caller rejects, and allSettled keeps
// the rest of the dashboard alive. The screen reads `failed.kpis` / `failed.overview`
// to decide whether that is a 403 or a genuinely empty factory.
//
// It keeps its own state bucket — importing the shared slices here would
// overwrite the lists the other screens are rendering.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
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
function normalizeKpis(raw, overview) {
  if (!raw || typeof raw !== "object") return null;
  const obj = (v) => (v && typeof v === "object" ? v : {});
  const availability = obj(raw.availability);
  const mtbf = obj(raw.mtbf);
  const mttr = obj(raw.mttr);
  const oee = obj(raw.oee);

  return {
    totalMachines: toNum(overview?.totalMachines),
    availability: toNum(availability.value),
    activeAlerts: toNum(overview?.activeAlertsCount),
    oee: toNum(oee.value),
    oeeStatus: oee.status || null,
    oeeReason: oee.reason || null,
    healthScore: toNum(overview?.overallHealthScore),
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
 * availability here is RUNNING/total over the returned page, which is a
 * different (weaker) number than the backend's operating-minutes ratio, so
 * the API value always wins when it arrives.
 */
function deriveKpis(summary, alerts) {
  if (!summary && !alerts) return null;
  const total = summary ? summary.total : null;
  const running = summary ? summary.RUNNING : null;
  return {
    totalMachines: total,
    availability:
      summary && total > 0 ? Math.round((running / total) * 1000) / 10 : null,
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
 * Machines-by-status counts for the status card row.
 * The backend's `overview.machinesByStatus` covers the whole fleet (not just
 * the first page of GET /api/machines), so it is preferred when present.
 */
function statusCounts(overview, summary) {
  const src = overview?.machinesByStatus;
  if (src && typeof src === "object") {
    return {
      total: toNum(overview.totalMachines),
      RUNNING: toNum(src.RUNNING) || 0,
      IDLE: toNum(src.IDLE) || 0,
      MAINTENANCE: toNum(src.MAINTENANCE) || 0,
      FAILURE: toNum(src.FAILURE) || 0,
      OFFLINE: toNum(src.OFFLINE) || 0,
      UNKNOWN: toNum(src.UNKNOWN) || 0,
    };
  }
  return summary;
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
   *           overview?: boolean, kpis?: boolean }} scope
   *   Only fan out for what this role may read — avoids a pointless 403 and
   *   keeps the first paint fast. `overview` / `kpis` target the CONFIRMED
   *   Sprint 7 routes, which are ADMIN | RESPONSABLE | TECHNICIAN only
   *   (SecurityConfig.java:119): an OPERATOR caller rejects and the other
   *   blocks still render, with `failed.overview` / `failed.kpis` set.
   */
  async (
    {
      machines = true,
      alerts = true,
      interventions = true,
      overview = true,
      kpis = true,
    } = {},
    { rejectWithValue }
  ) => {
    const [
      machinesRes,
      summaryRes,
      alertsRes,
      interventionsRes,
      overviewRes,
      kpisRes,
      historyRes,
    ] = await Promise.allSettled([
      machines ? machineService.getAll({ size: 100 }) : skipped(),
      alerts ? alertService.getSummary() : skipped(),
      alerts ? alertService.getAll({ status: "ACTIVE", size: 5, sort: "timestamp,desc" }) : skipped(),
      interventions ? interventionService.getAll({ size: 100 }) : skipped(),
      overview ? dashboardService.getOverview() : skipped(),
      kpis ? dashboardService.getKpis({ period: "day" }) : skipped(),
      kpis ? dashboardService.getKpisHistory({ period: "week", points: 7 }) : skipped(),
    ]);

    // A skipped source resolves to `null` (not a failure); a failed one rejects.
    const ok = (r) => r.status === "fulfilled" && r.value !== null;
    const failed = (r) => r.status === "rejected";
    const ov = ok(overviewRes) ? overviewRes.value : null;

    const payload = {
      machines: ok(machinesRes) ? summarizeMachines(machinesRes.value) : null,
      // Raw rows: the map groups them by zoneId and the status card picks 8.
      machineRows: ok(machinesRes) ? topMachineRows(machineList(machinesRes.value)) : [],
      allMachines: ok(machinesRes) ? machineList(machinesRes.value) : [],
      alerts: null,
      interventions: ok(interventionsRes) ? summarizeInterventions(interventionsRes.value) : null,
      // ── Sprint 7 — CONFIRMED (DashboardController) ────────────────────────
      overview: ov,
      factoryStatus: ov?.factoryStatus || null,
      // Whole-fleet status split; falls back to the counted machine page.
      statusCounts: statusCounts(
        ov,
        ok(machinesRes) ? summarizeMachines(machinesRes.value) : null
      ),
      history: ok(historyRes) ? normalizeHistory(historyRes.value) : null,
      kpisFromApi: false,
      kpis: null,
      failed: {
        machines: failed(machinesRes),
        alerts: failed(summaryRes) && failed(alertsRes),
        interventions: failed(interventionsRes),
        overview: failed(overviewRes),
        kpis: failed(kpisRes),
        history: failed(historyRes),
      },
      fetchedAt: Date.now(),
    };

    if (ok(summaryRes) || ok(alertsRes)) {
      const summary = ok(summaryRes) ? summaryRes.value || {} : {};
      const recent = ok(alertsRes) ? alertsRes.value?.list || [] : [];
      payload.alerts = {
        active: Number(summary.activeCount ?? alertsRes.value?.totalElements ?? recent.length) || 0,
        critical: Number(summary.criticalActiveCount ?? 0) || 0,
        high: Number(summary.highActiveCount ?? 0) || 0,
        warning: Number(summary.warningActiveCount ?? 0) || 0,
        acknowledged: Number(summary.acknowledgedCount ?? 0) || 0,
        recent,
      };
    }

    // KPIs: real Sprint 7 numbers when /kpis answers, overlaid on values
    // derived from the CONFIRMED data above (so a blocked /kpis still leaves
    // totals + alert counts on screen). Never fabricated — a null stays null.
    const derived = deriveKpis(payload.machines, payload.alerts) || {};
    const api = ok(kpisRes) ? normalizeKpis(kpisRes.value, ov) : null;
    const merged = { ...derived };
    if (api) {
      Object.keys(api).forEach((k) => {
        if (k === "deltas") return;
        if (api[k] !== null && api[k] !== undefined) merged[k] = api[k];
      });
      merged.deltas = api.deltas;
    }
    if (ov) {
      merged.totalMachines = toNum(ov.totalMachines) ?? merged.totalMachines;
      merged.activeAlerts = toNum(ov.activeAlertsCount) ?? merged.activeAlerts;
      merged.healthScore = toNum(ov.overallHealthScore);
    }
    payload.kpisFromApi = Boolean(api);
    payload.kpis = Object.keys(merged).length ? merged : null;

    // A dashboard where every single block failed is a real error, not an
    // "empty factory" — let the screen show the retry state.
    if (!payload.machines && !payload.alerts && !payload.interventions && !ov) {
      return rejectWithValue({ message: "Could not load the dashboard." });
    }
    return payload;
  }
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    data: null,
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    error: null,
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
  },
});

export const { clearDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
