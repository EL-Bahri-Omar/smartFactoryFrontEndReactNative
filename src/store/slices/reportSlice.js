// src/store/slices/reportSlice.js
//
// Reports — rebuilt on CONFIRMED data (see reportService.js).
//
// The old slice called the ASSUMED /api/reports/{downtime,performance} routes,
// which do not exist on the backend, so `downtimeAvailable` stayed false and
// the screen permanently rendered its empty state. Everything below is now
// derived from real backend rows:
//
//   Total Downtime (h)   ← corrective interventions in the window
//   Maintenance Count     ← every intervention in the window
//   Avg. Health Score     ← /api/dashboard/health-scores.averageScore
//   Downtime by Machine   ← same corrective rows, grouped by machineCode
//   Machine health bars   ← health-scores.machines[].score
//   Fleet donut           ← /api/machines grouped by status
//   Alerts bar            ← /api/alerts in the window, grouped by severity
//
// The selected range is a CLIENT-SIDE window over `createdAt` / `timestamp`,
// and the previous window of equal length is used for the delta chips.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as reportService from "../services/reportService";
import { getMachineStatus } from "../../lib/status";
import { computeMachineHealth, computeFactoryHealth } from "../../lib/health";

export const RANGES = [
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
];

const DAY = 86400000;

const toNum = (v) =>
  v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);

function errorPayload(err, fallback) {
  return {
    message: err?.message || fallback,
    status: err?.status ?? err?.response?.status ?? null,
  };
}

/** Range key → `{ start, end, prevStart, prevEnd }` (equal-length previous). */
function windowFor(range) {
  const now = new Date();
  let start;
  let end;
  if (range === "last_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === "this_week") {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
    // Monday-first so "This Week" matches the dashboard's Mon…Sun buckets.
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end = now;
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = now;
  }
  const span = Math.max(end - start, DAY);
  return { start, end, prevStart: new Date(start.getTime() - span), prevEnd: start };
}

/** Custom ISO/date inputs → the same shape; null when neither is readable. */
function customWindow(from, to) {
  const s = from ? new Date(from) : null;
  const e = to ? new Date(to) : null;
  const start = s && !Number.isNaN(s.getTime()) ? s : new Date(0);
  const end = e && !Number.isNaN(e.getTime()) ? e : new Date();
  if (!s && !e) return null;
  const span = Math.max(end - start, DAY);
  return { start, end, prevStart: new Date(start.getTime() - span), prevEnd: start };
}

const inWin = (iso, a, b) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= a.getTime() && t <= b.getTime();
};

/** Backend rule: only CORRECTIVE interventions consume availability. */
function downtimeOf(rows, a, b) {
  const win = rows.filter((r) => inWin(r?.createdAt, a, b));
  const corrective = win.filter((r) => (r.type || "CORRECTIVE") === "CORRECTIVE");
  let minutes = 0;
  const byMachine = new Map();
  corrective.forEach((r) => {
    // Same fallback the backend uses (DashboardService.getKpis): an
    // intervention without a recorded duration counts as one hour.
    const m = Number(r?.durationMinutes) > 0 ? Number(r.durationMinutes) : 60;
    minutes += m;
    const key = r?.machineCode || r?.machineId || "Unknown";
    byMachine.set(key, (byMachine.get(key) || 0) + m);
  });
  return {
    hours: Math.round((minutes / 60) * 10) / 10,
    interventions: win.length,
    byMachine,
  };
}

/** percent change vs the previous window — null when there is no baseline. */
function deltaOf(cur, prev) {
  if (prev == null || prev <= 0 || cur == null) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

const mapToDonut = (m, colorFn) =>
  [...m.entries()]
    .map(([label, value]) => ({ key: label, label, value, color: colorFn ? colorFn(label) : undefined }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

const SEVERITY_COLOR = {
  CRITICAL: "#DC2626",
  HIGH: "#EA580C",
  WARNING: "#F59E0B",
  INFO: "#2563EB",
};

const HEALTH_SERIES = [{ key: "score", label: "Health score", color: "#22C55E" }];

/**
 * fetchReport({ range, from, to }) — the one and only phase. Three CONFIRMED
 * calls that all answer in under 50 ms (measured 15–33 ms), plus the health
 * score computed right here in the client from the machine + alert rows they
 * return (src/lib/health.js) — GET /api/dashboard/health-scores measured
 * 151–339 s and is never called. A single failing call degrades that one
 * section instead of blanking the whole screen; three failures surface a
 * retryable error.
 */
export const fetchReport = createAsyncThunk(
  "report/fetchReport",
  async ({ range = "this_month", from, to } = {}, { rejectWithValue }) => {
    const winDef = from || to ? customWindow(from, to) : windowFor(range);
    const settled = await Promise.allSettled([
      reportService.getMaintenance(),
      reportService.getAlerts(),
      reportService.getMachines(),
    ]);
    const [maint, alerts, machines] = settled;
    const answered = settled.filter((s) => s.status === "fulfilled").length;
    if (!answered) {
      const first = settled.find((s) => s.status === "rejected");
      return rejectWithValue(errorPayload(first?.reason, "Could not load the report."));
    }

    const w = winDef || windowFor(range);
    const rows = maint.status === "fulfilled" ? maint.value : [];
    const alertRows = alerts.status === "fulfilled" ? alerts.value : [];
    const machineRows = machines.status === "fulfilled" ? machines.value : [];

    const cur = downtimeOf(rows, w.start, w.end);
    const prev = downtimeOf(rows, w.prevStart, w.prevEnd);

    const byStatus = new Map();
    machineRows.forEach((m) => {
      const key = String(m?.status || "OFFLINE").toUpperCase();
      byStatus.set(key, (byStatus.get(key) || 0) + 1);
    });

    const winRows = rows.filter((r) => inWin(r?.createdAt, w.start, w.end));

    const byType = new Map();
    winRows.forEach((r) => {
      const key = String(r?.type || "CORRECTIVE").toUpperCase();
      byType.set(key, (byType.get(key) || 0) + 1);
    });

    const bySeverity = new Map();
    alertRows
      .filter((a) => inWin(a?.timestamp ?? a?.createdAt, w.start, w.end))
      .forEach((a) => {
        const key = String(a?.severity || "INFO").toUpperCase();
        bySeverity.set(key, (bySeverity.get(key) || 0) + 1);
      });

    // ── Health score, computed FRONTEND-side (src/lib/health.js) ───────────
    // GET /api/dashboard/health-scores measured 151–339 s on this backend and
    // is never called. The fleet + the alert rows this thunk already fetched
    // are exactly the two signals it needed, so the score is ready the moment
    // the rest of the report is: base 100 − status penalty − open-alert
    // penalty per machine, then the mean of those (review: "average of all
    // the machines health score").
    const alertsByMachine = new Map();
    alertRows.forEach((a) => {
      const id = a?.machineId;
      if (!id) return;
      if (!alertsByMachine.has(id)) alertsByMachine.set(id, []);
      alertsByMachine.get(id).push(a);
    });
    const machineHealth = machineRows
      .map((m) => ({
        label: m?.code || m?.name || "—",
        score: computeMachineHealth({
          status: m?.status,
          // Same model as the dashboard: an ACTIVE alert row is one sensor out
          // of range, WARNING → degraded (12.5), HIGH/CRITICAL → anomaly (25).
          sensors: alertsByMachine.get(m?.id) || [],
        }),
      }))
      .filter((m) => m.score != null)
      .sort((a, b) => a.score - b.score); // worst first — the ones to fix
    const factoryScore = computeFactoryHealth(machineHealth.map((m) => m.score));

    return {
      rangeKey: from || to ? "custom" : range,
      start: w.start.toISOString(),
      end: w.end.toISOString(),
      metrics: {
        downtimeHours: cur.hours,
        downtimeDelta: deltaOf(cur.hours, prev.hours),
        maintenanceCount: cur.interventions,
        maintenanceDelta: deltaOf(cur.interventions, prev.interventions),
        avgHealthScore: factoryScore,
        healthDelta: null,
      },
      totalMachines: machineRows.length,
      byMachine: mapToDonut(cur.byMachine),
      byType: mapToDonut(byType),
      byStatus: mapToDonut(byStatus, (label) => getMachineStatus(label).color),
      bySeverity: mapToDonut(bySeverity, (label) => SEVERITY_COLOR[label] || "#64748B"),
      performance: {
        series: HEALTH_SERIES,
        data: machineHealth.slice(0, 12).map((m) => ({ label: m.label, values: [m.score] })),
      },
      partial: {
        maintenance: maint.status !== "fulfilled",
        alerts: alerts.status !== "fulfilled",
        machines: machines.status !== "fulfilled",
        // Health needs no extra request — it is computed right here.
        health: false,
      },
    };
  }
);

const reportSlice = createSlice({
  name: "report",
  initialState: {
    report: null,
    range: "this_month",
    tab: "maintenance",
    customFrom: "",
    customTo: "",
    status: "idle", // idle | loading | succeeded | error
    error: null,
    // Health has no separate phase any more — it is computed inside fetchReport.
  },
  reducers: {
    setTab(state, action) {
      state.tab = action.payload;
    },
    setRange(state, action) {
      state.range = action.payload;
    },
    setCustom(state, action) {
      state.customFrom = action.payload.from ?? state.customFrom;
      state.customTo = action.payload.to ?? state.customTo;
    },
    clearReport(state) {
      state.report = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReport.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchReport.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.report = action.payload;
      })
      .addCase(fetchReport.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Could not load the report." };
      });
  },
});

export const { setTab, setRange, setCustom, clearReport } = reportSlice.actions;
export default reportSlice.reducer;
