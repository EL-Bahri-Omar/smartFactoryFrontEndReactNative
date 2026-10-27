// src/store/slices/zoneSlice.js

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as zoneService from "../services/zoneService";
import * as dashboardService from "../services/dashboardService";

// ── Thunks ──────────────────────────────────────────────────────────────

export const fetchZones = createAsyncThunk(
  "zone/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      return await zoneService.getAll();
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchZoneMachines = createAsyncThunk(
  "zone/fetchMachines",
  async (zoneId, { rejectWithValue }) => {
    try {
      const machines = await zoneService.getZoneMachines(zoneId);
      return { zoneId, machines };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * GET /api/dashboard/zones/{zoneId} — CONFIRMED Sprint 7 route (US53).
 * Everything `/api/zones/{id}/machines` does NOT carry: `healthScore`,
 * `healthGrade` and `activeAlertsCount` per machine, plus the zone's own
 * `machinesByStatus` split. That is what paints the health ring and the
 * status chips in the Map & Zones machine list (map&zones.png).
 *
 * ADMIN | RESPONSABLE | TECHNICIAN only (SecurityConfig.java:119) — an
 * OPERATOR caller lands in `details[id].status === "error"` and the screen
 * falls back to the plain `/api/zones/{id}/machines` rows.
 */
export const fetchZoneDetails = createAsyncThunk(
  "zone/fetchDetails",
  async (zoneId, { rejectWithValue }) => {
    try {
      const details = await dashboardService.getZoneDetails(zoneId);
      return { zoneId, details };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// ── Slice ───────────────────────────────────────────────────────────────

const zoneSlice = createSlice({
  name: "zone",
  initialState: {
    list: [],
    machinesByZone: {}, // { zoneId: [machine, ...] }
    // { [zoneId]: { status: 'idle'|'loading'|'succeeded'|'error', data } }
    details: {},
    current: null,
    status: "idle",
    error: null,
  },
  reducers: {
    setCurrent(state, action) {
      state.current = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchZones.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchZones.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = Array.isArray(action.payload) ? action.payload : action.payload?.content || [];
      })
      .addCase(fetchZones.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to fetch zones" };
      });

    builder
      .addCase(fetchZoneMachines.fulfilled, (state, action) => {
        const { zoneId, machines } = action.payload;
        state.machinesByZone[zoneId] = Array.isArray(machines) ? machines : [];
      });

    // Per-zone detail: keep the previous payload while a refresh is in flight
    // so expanding a zone never flashes empty, and record `error` so the
    // screen does not refetch a route this role may not call.
    builder
      .addCase(fetchZoneDetails.pending, (state, action) => {
        const zoneId = action.meta.arg;
        const prev = state.details[zoneId];
        state.details[zoneId] = { status: "loading", data: prev?.data || null };
      })
      .addCase(fetchZoneDetails.fulfilled, (state, action) => {
        const { zoneId, details } = action.payload;
        state.details[zoneId] = { status: "succeeded", data: details || null };
      })
      .addCase(fetchZoneDetails.rejected, (state, action) => {
        const zoneId = action.meta.arg;
        const prev = state.details[zoneId];
        state.details[zoneId] = { status: "error", data: prev?.data || null };
      });
  },
});

export const { setCurrent } = zoneSlice.actions;
export default zoneSlice.reducer;
