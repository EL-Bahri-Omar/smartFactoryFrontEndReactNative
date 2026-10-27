// src/store/slices/reportSlice.js
//
// Sprint 7 — Reports (docs/prompts/13-reports.md).
//
// State shape required by the prompt:
//   { downtime, performance, range, status, error }
// plus `generating` for the "Generate Report" button spinner.
//
// All three endpoints are ASSUMED (no Report* controller in the backend yet).
// A 404 resolves to a *successful* fetch with `available: false` so the screen
// renders its empty state ("No data for this range") instead of an alarming
// red error; a 500/network failure is a real error and carries `retry`.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as reportService from "../services/reportService";

export const RANGES = [
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
];

const toNum = (v) =>
  v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v);

const isMissing = (err) => {
  const status = err?.status ?? err?.response?.status;
  return status === 404 || status === 405;
};

function errorPayload(err, fallback) {
  return {
    message: err?.message || fallback,
    status: err?.status ?? err?.response?.status ?? null,
    notFound: isMissing(err),
  };
}

/**
 * Tolerant reader for `GET /api/reports/downtime`.
 * Returns `{ totalHours, deltaPercent, maintenanceCount,
 * maintenanceDeltaPercent, avgHealthScore, healthDeltaPercent, byMachine }`.
 * Accepts a bare array (= byMachine), a `downtime` wrapper, or the flat shape
 * documented in reportService. Missing numbers stay null → card shows "—".
 */
function normalizeDowntime(raw) {
  if (raw == null) return null;
  const src = Array.isArray(raw)
    ? { byMachine: raw }
    : raw.downtime && typeof raw.downtime === "object"
      ? raw.downtime
      : raw;

  const byRaw = src.byMachine || src.machines || src.breakdown || src.byMachineCode || [];
  const byMachine = (Array.isArray(byRaw) ? byRaw : [])
    .map((d, i) => ({
      key: d.machineCode || d.code || d.id || d.machineId || `m${i}`,
      label: d.machineCode || d.code || d.machineName || d.name || "—",
      value:
        toNum(d.hours) ??
        toNum(d.downtimeHours) ??
        toNum(d.totalHours) ??
        toNum(d.value) ??
        toNum(d.durationHours) ??
        0,
      color: d.color,
    }))
    .filter((d) => d.value > 0);

  return {
    totalHours:
      toNum(src.totalHours) ?? toNum(src.hours) ?? toNum(src.totalDowntime) ?? null,
    deltaPercent: toNum(src.deltaPercent ?? src.totalDeltaPercent ?? src.downtimeDeltaPercent),
    maintenanceCount:
      toNum(src.maintenanceCount) ?? toNum(src.interventionCount) ?? toNum(src.count) ?? null,
    maintenanceDeltaPercent: toNum(src.maintenanceDeltaPercent ?? src.interventionDeltaPercent),
    avgHealthScore:
      toNum(src.avgHealthScore) ?? toNum(src.healthScore) ?? toNum(src.averageHealthScore) ?? null,
    healthDeltaPercent: toNum(src.healthDeltaPercent ?? src.healthScoreDeltaPercent),
    byMachine,
  };
}

/**
 * Tolerant reader for `GET /api/reports/performance`.
 * Normalises into `{ series: [{ key, label, color }], data: [{ label, values: [] }] }`
 * for BarChart. Accepts:
 *   - { machines: [...], series: [{ label, values: [{ machineCode, value }] }] }
 *   - { series: [{ label, values: { CNC: 92 } }] }
 *   - a bare array of series
 * Returns null when nothing parseable is there (screen → empty state).
 */
function normalizePerformance(raw) {
  if (raw == null) return null;

  let seriesRaw = null;
  let machinesRaw = null;
  if (Array.isArray(raw)) {
    seriesRaw = raw;
  } else if (typeof raw === "object") {
    seriesRaw = raw.series || raw.datasets || raw.values || null;
    machinesRaw = raw.machines || raw.labels || raw.codes || null;
  }
  if (!Array.isArray(seriesRaw) || !seriesRaw.length) return null;

  const series = seriesRaw
    .map((s, i) => {
      if (!s || typeof s !== "object") return null;
      const rawValues = s.values ?? s.data ?? s.points ?? {};
      const map = {};
      if (Array.isArray(rawValues)) {
        rawValues.forEach((p) => {
          if (p == null) return;
          if (typeof p === "number") return; // no axis key — unusable
          const key = p.machineCode || p.code || p.machine || p.label || p.name;
          const val = toNum(p.value ?? p.score ?? p.percent ?? p.y);
          if (key != null && val != null) map[key] = val;
        });
      } else if (typeof rawValues === "object") {
        Object.entries(rawValues).forEach(([k, v]) => {
          const val = toNum(v);
          if (val != null) map[k] = val;
        });
      }
      if (!Object.keys(map).length) return null;
      return {
        key: String(s.key ?? s.id ?? s.label ?? s.name ?? i),
        label: String(s.label ?? s.name ?? s.key ?? `Series ${i + 1}`),
        color: s.color,
        map,
      };
    })
    .filter(Boolean);

  if (!series.length) return null;

  const union = [];
  series.forEach((s) =>
    Object.keys(s.map).forEach((k) => {
      if (!union.includes(k)) union.push(k);
    })
  );
  const axis = (Array.isArray(machinesRaw) && machinesRaw.length ? machinesRaw : union).slice(0, 12);

  return {
    series: series.map(({ key, label, color }) => ({ key, label, color })),
    data: axis.map((machine) => ({
      label: machine,
      values: series.map((s) => (s.map[machine] != null ? s.map[machine] : null)),
    })),
  };
}

/** fetchDowntime({ from, to }) → metrics + donut slice */
export const fetchDowntime = createAsyncThunk(
  "report/fetchDowntime",
  async ({ from, to } = {}, { rejectWithValue }) => {
    try {
      const raw = await reportService.getDowntime({ from, to });
      return { data: normalizeDowntime(raw), available: raw != null };
    } catch (err) {
      if (isMissing(err)) return { data: null, available: false, notFound: true };
      return rejectWithValue(errorPayload(err, "Could not load downtime."));
    }
  }
);

/** fetchPerformance({ range }) → grouped bar chart */
export const fetchPerformance = createAsyncThunk(
  "report/fetchPerformance",
  async ({ range = "this_month" } = {}, { rejectWithValue }) => {
    try {
      const raw = await reportService.getPerformance({ range });
      const data = normalizePerformance(raw);
      return { data, available: Boolean(data) };
    } catch (err) {
      if (isMissing(err)) return { data: null, available: false, notFound: true };
      return rejectWithValue(errorPayload(err, "Could not load performance."));
    }
  }
);

/** generateReport(body) → POST /api/reports/generate (ASSUMED) */
export const generateReport = createAsyncThunk(
  "report/generate",
  async (body = {}, { rejectWithValue }) => {
    try {
      const result = await reportService.generateReport(body);
      return result ?? { message: "Report generated" };
    } catch (err) {
      if (isMissing(err)) {
        return rejectWithValue({
          message: "Report generation isn't available yet (Sprint 7 backend).",
          notFound: true,
        });
      }
      return rejectWithValue(errorPayload(err, "Could not generate the report."));
    }
  }
);

const reportSlice = createSlice({
  name: "report",
  initialState: {
    downtime: null, // { totalHours, maintenanceCount, avgHealthScore, byMachine, ... }
    performance: null, // { series, data }
    range: "this_month",
    tab: "maintenance",
    status: "idle", // downtime / metric cards
    perfStatus: "idle", // performance chart (sub-tabs refetch on their own)
    error: null,
    perfError: null,
    downtimeAvailable: false,
    performanceAvailable: false,
    generating: false,
    generateError: null,
    generated: null,
  },
  reducers: {
    setTab(state, action) {
      state.tab = action.payload;
    },
    setRange(state, action) {
      state.range = action.payload;
    },
    clearGenerated(state) {
      state.generated = null;
      state.generateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDowntime.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchDowntime.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.downtime = action.payload.data;
        state.downtimeAvailable = action.payload.available;
        state.error = action.payload.notFound ? null : state.error;
      })
      .addCase(fetchDowntime.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Could not load downtime." };
      })

      .addCase(fetchPerformance.pending, (state) => {
        state.perfStatus = "loading";
        state.perfError = null;
      })
      .addCase(fetchPerformance.fulfilled, (state, action) => {
        state.perfStatus = "succeeded";
        state.performance = action.payload.data;
        state.performanceAvailable = action.payload.available;
      })
      .addCase(fetchPerformance.rejected, (state, action) => {
        state.perfStatus = "error";
        state.perfError = action.payload || { message: "Could not load performance." };
      })

      .addCase(generateReport.pending, (state) => {
        state.generating = true;
        state.generateError = null;
        state.generated = null;
      })
      .addCase(generateReport.fulfilled, (state, action) => {
        state.generating = false;
        state.generated = action.payload;
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.generating = false;
        state.generateError = action.payload || { message: "Could not generate the report." };
      });
  },
});

export const { setTab, setRange, clearGenerated } = reportSlice.actions;
export default reportSlice.reducer;
