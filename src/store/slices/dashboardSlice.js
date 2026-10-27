// src/store/slices/dashboardSlice.js
//
// Sprint 7 preview — the real landing dashboard.
//
// The dashboard is the FIRST screen after login, so it has to be fast: it
// issues one small, parallel fan-out instead of re-using the heavy list
// endpoints the Machines/Alerts/Maintenance screens load.
//
//   GET /api/machines?size=100          → totals + per-status split + map rows
//   GET /api/alerts/summary             → exact ACTIVE counts (cheap, server-side)
//   GET /api/alerts?status=ACTIVE&size=5→ the 5 newest active alerts
//   GET /api/maintenance?size=100       → open queue (PENDING/ASSIGNED/IN_PROGRESS)
//   GET /api/dashboard/kpis             → ASSUMED (Sprint 7) — OEE + deltas
//
// Every source is independent and permission-gated on the server, so a role
// that cannot read one of them (e.g. no ALERT_READ) still gets a usable
// dashboard: `Promise.allSettled` keeps the blocks that succeed and flags the
// ones that failed instead of blanking the whole page.
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
 * Tolerant reader for the ASSUMED `GET /api/dashboard/kpis`.
 * Accepts either top-level keys or a `kpis: {}` wrapper; anything missing
 * stays null so the card renders an em dash instead of a made-up 0.
 */
function normalizeKpis(raw) {
  if (!raw || typeof raw !== "object") return null;
  const src = raw.kpis && typeof raw.kpis === "object" ? raw.kpis : raw;
  const pick = (...keys) => {
    for (const k of keys) {
      if (src[k] != null && src[k] !== "") return src[k];
    }
    return null;
  };
  const d = src.deltas && typeof src.deltas === "object" ? src.deltas : {};
  const kpis = {
    totalMachines: toNum(pick("totalMachines", "machineCount", "machines")),
    availability: toNum(pick("availability", "availabilityRate", "availabilityPct")),
    activeAlerts: toNum(pick("activeAlerts", "alertsActive", "alerts")),
    oee: toNum(pick("oee", "oeePercent", "oeePct")),
    mtbf: toNum(pick("mtbf")),
    mttr: toNum(pick("mttr")),
    healthScore: toNum(pick("healthScore", "avgHealthScore")),
    deltas: {
      totalMachines: toNum(d.totalMachines ?? d.machines),
      availability: toNum(d.availability),
      activeAlerts: toNum(d.activeAlerts ?? d.alerts),
      oee: toNum(d.oee),
    },
  };
  return kpis;
}

/**
 * Fallback KPIs computed from CONFIRMED data (counts, not fabrications).
 * `availability` = RUNNING / total over the returned page; `oee` has no
 * source until the Sprint 7 endpoint exists, so it stays null → "—".
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
    mtbf: null,
    mttr: null,
    healthScore: null,
    deltas: { totalMachines: null, availability: null, activeAlerts: null, oee: null },
  };
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
   * @param {{ machines?: boolean, alerts?: boolean, interventions?: boolean, kpis?: boolean }} scope
   *   Only fan out for what this role may read — avoids a pointless 403 and
   *   keeps the first paint fast (a technician without MAINTENANCE_READ does
   *   not wait for a maintenance request to fail). `kpis` targets the ASSUMED
   *   Sprint 7 endpoint: rejecting is harmless (allSettled) and only leaves
   *   OEE/deltas empty.
   */
  async (
    { machines = true, alerts = true, interventions = true, kpis = true } = {},
    { rejectWithValue }
  ) => {
    const [machinesRes, summaryRes, alertsRes, interventionsRes, kpisRes] =
      await Promise.allSettled([
        machines ? machineService.getAll({ size: 100 }) : skipped(),
        alerts ? alertService.getSummary() : skipped(),
        alerts ? alertService.getAll({ status: "ACTIVE", size: 5, sort: "timestamp,desc" }) : skipped(),
        interventions ? interventionService.getAll({ size: 100 }) : skipped(),
        kpis ? dashboardService.getKpis() : skipped(),
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
      // ASSUMED Sprint 7 endpoint — null until the backend ships it.
      kpisFromApi: false,
      kpis: null,
      failed: {
        machines: failed(machinesRes),
        alerts: failed(summaryRes) && failed(alertsRes),
        interventions: failed(interventionsRes),
        kpis: failed(kpisRes),
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

    // KPIs: real Sprint 7 numbers when the endpoint exists, otherwise values
    // derived from the CONFIRMED data above. Never fabricated.
    const apiKpis = ok(kpisRes) ? normalizeKpis(kpisRes.value) : null;
    payload.kpisFromApi = Boolean(apiKpis);
    payload.kpis = apiKpis || deriveKpis(payload.machines, payload.alerts);

    // A dashboard where every single block failed is a real error, not an
    // "empty factory" — let the screen show the retry state.
    if (!payload.machines && !payload.alerts && !payload.interventions) {
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
