// src/store/slices/analyticsSlice.js
//
// Sprint 4 History & Analytics. No /api/analytics backend exists — the
// backend exposes timeseries + readings (TelemetryCache/history DB), so the
// summary averages, breach stats and health score are computed client-side
// from the fetched points (documented deviation, see docs/api-contract.md).

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as telemetryService from "../services/telemetryService";
import { getByMachinePage } from "../services/readingService";

/** Fetch timeseries points for one machine + period (1h|24h|7d|30d). */
export const fetchTrends = createAsyncThunk(
  "analytics/fetchTrends",
  async ({ machineId, period = "24h", sensorType, maxPoints = 200 } = {}, { rejectWithValue }) => {
    try {
      const data = await telemetryService.getTimeseries({ machineId, period, sensorType, maxPoints });
      return { machineId, period, sensorType: sensorType || "ALL", ...data };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** Fetch one paginated readings page for the history data table. */
export const fetchTablePage = createAsyncThunk(
  "analytics/fetchTablePage",
  async ({ machineId, from, to, sensorType, page = 0, size = 20 } = {}, { rejectWithValue }) => {
    try {
      const data = await getByMachinePage({ machineId, from, to, sensorType, page, size });
      return { machineId, ...data };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const analyticsSlice = createSlice({
  name: "analytics",
  initialState: {
    machineId: null,
    period: "24h",
    sensorType: "ALL",
    points: [],
    totalPoints: 0,
    from: null,
    to: null,
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    error: null,
    table: { list: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
    tableStatus: "idle",
    tableError: null,
  },
  reducers: {
    setPeriod(state, action) {
      state.period = action.payload;
    },
    clearAnalytics(state) {
      state.points = [];
      state.totalPoints = 0;
      state.status = "idle";
      state.error = null;
      state.table = { list: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
      state.tableStatus = "idle";
      state.tableError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrends.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.machineId = action.meta.arg?.machineId || state.machineId;
        state.period = action.meta.arg?.period || state.period;
        state.sensorType = action.meta.arg?.sensorType || "ALL";
      })
      .addCase(fetchTrends.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.points = action.payload.points || [];
        state.totalPoints = action.payload.totalPoints ?? state.points.length;
        state.from = action.payload.from || null;
        state.to = action.payload.to || null;
      })
      .addCase(fetchTrends.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to load trends" };
        state.points = [];
      });

    builder
      .addCase(fetchTablePage.pending, (state) => {
        state.tableStatus = "loading";
        state.tableError = null;
      })
      .addCase(fetchTablePage.fulfilled, (state, action) => {
        state.tableStatus = "succeeded";
        state.table = {
          list: action.payload.list || [],
          page: action.payload.page ?? 0,
          size: action.payload.size ?? 20,
          totalElements: action.payload.totalElements ?? 0,
          totalPages: action.payload.totalPages ?? 0,
        };
      })
      .addCase(fetchTablePage.rejected, (state, action) => {
        state.tableStatus = "error";
        state.tableError = action.payload || { message: "Failed to load readings" };
        state.table.list = [];
      });
  },
});

export const { setPeriod, clearAnalytics } = analyticsSlice.actions;
export default analyticsSlice.reducer;

/** Average value per sensor type from points. */
export function averageByType(points = []) {
  const acc = {};
  (points || []).forEach((p) => {
    const t = String(p.sensorType || "").toUpperCase();
    const v = Number(p.value);
    if (!t || Number.isNaN(v)) return;
    if (!acc[t]) acc[t] = { sum: 0, n: 0 };
    acc[t].sum += v;
    acc[t].n += 1;
  });
  const out = {};
  Object.entries(acc).forEach(([t, { sum, n }]) => {
    out[t] = n ? sum / n : null;
  });
  return out;
}

/**
 * Health score 0–100 from breach ratio over the period.
 * 100 = no threshold breach in any point; each breached point costs weight
 * (CRITICAL ×2, WARNING ×1) spread over all points; floored at 0.
 * Pass a breached(point) => 0|1|2 classifier built from thresholds.
 */
export function healthScore(points = [], breached) {
  if (!points.length) return null;
  let breachedCount = 0;
  points.forEach((p) => {
    const level = breached ? breached(p) || 0 : 0;
    if (level > 0) breachedCount += 1;
  });
  return Math.max(0, Math.round(100 - (breachedCount / points.length) * 100));
}
