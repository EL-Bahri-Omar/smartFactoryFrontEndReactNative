// src/store/slices/zoneSlice.js

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as zoneService from "../services/zoneService";

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

// ── Slice ───────────────────────────────────────────────────────────────

const zoneSlice = createSlice({
  name: "zone",
  initialState: {
    list: [],
    machinesByZone: {}, // { zoneId: [machine, ...] }
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
  },
});

export const { setCurrent } = zoneSlice.actions;
export default zoneSlice.reducer;
