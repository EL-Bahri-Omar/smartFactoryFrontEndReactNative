// src/store/slices/dashboardSlice.js
//
// Sprint 7 preview — the real landing dashboard.
//
// The dashboard is the FIRST screen after login, so it has to be fast: it
// issues one small, parallel fan-out instead of re-using the heavy list
// endpoints the Machines/Alerts/Maintenance screens load.
//
//   GET /api/machines?size=100          → totals + per-status split
//   GET /api/alerts/summary             → exact ACTIVE counts (cheap, server-side)
//   GET /api/alerts?status=ACTIVE&size=5→ the 5 newest active alerts
//   GET /api/maintenance?size=100       → open queue (PENDING/ASSIGNED/IN_PROGRESS)
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

const OPEN_STATUSES = ["PENDING", "ASSIGNED", "IN_PROGRESS"];

function summarizeMachines(result) {
  const list = result?.list || result?.content || [];
  const total = result?.totalElements ?? list.length;
  const counts = { total, RUNNING: 0, IDLE: 0, MAINTENANCE: 0, FAILURE: 0, OFFLINE: 0, UNKNOWN: 0 };
  list.forEach((m) => {
    const key = String(m?.status || "UNKNOWN").toUpperCase();
    if (counts[key] != null) counts[key] += 1;
    else counts.UNKNOWN += 1;
  });
  return counts;
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
   * @param {{ machines?: boolean, alerts?: boolean, interventions?: boolean }} scope
   *   Only fan out for what this role may read — avoids a pointless 403 and
   *   keeps the first paint fast (a technician without MAINTENANCE_READ does
   *   not wait for a maintenance request to fail).
   */
  async ({ machines = true, alerts = true, interventions = true } = {}, { rejectWithValue }) => {
    const [machinesRes, summaryRes, alertsRes, interventionsRes] = await Promise.allSettled([
      machines ? machineService.getAll({ size: 100 }) : skipped(),
      alerts ? alertService.getSummary() : skipped(),
      alerts ? alertService.getAll({ status: "ACTIVE", size: 5, sort: "timestamp,desc" }) : skipped(),
      interventions ? interventionService.getAll({ size: 100 }) : skipped(),
    ]);

    // A skipped source resolves to `null` (not a failure); a failed one rejects.
    const ok = (r) => r.status === "fulfilled" && r.value !== null;
    const failed = (r) => r.status === "rejected";
    const payload = {
      machines: ok(machinesRes) ? summarizeMachines(machinesRes.value) : null,
      alerts: null,
      interventions: ok(interventionsRes) ? summarizeInterventions(interventionsRes.value) : null,
      failed: {
        machines: failed(machinesRes),
        alerts: failed(summaryRes) && failed(alertsRes),
        interventions: failed(interventionsRes),
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
