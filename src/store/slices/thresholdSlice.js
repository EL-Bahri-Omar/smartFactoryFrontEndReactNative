// src/store/slices/thresholdSlice.js
//
// Per-machine alert thresholds (real backend collection `machine_thresholds`).
// Replaces the former caracteristiques-based seuil convention.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as thresholdService from "../services/thresholdService";

/** Fetch all thresholds configured for one machine (id or code). */
export const fetchThresholds = createAsyncThunk(
  "threshold/fetchByMachine",
  async (machineId, { rejectWithValue }) => {
    try {
      const list = await thresholdService.getByMachine(machineId);
      return { list, machineId };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** Upsert one sensor threshold (PUT .../thresholds/:sensorType). */
export const saveThreshold = createAsyncThunk(
  "threshold/save",
  async ({ machineId, sensorType, body }, { rejectWithValue }) => {
    try {
      const saved = await thresholdService.save(machineId, sensorType, body);
      return saved;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** Delete one sensor threshold (back to backend fallback behavior). */
export const deleteThreshold = createAsyncThunk(
  "threshold/delete",
  async ({ machineId, sensorType }, { rejectWithValue }) => {
    try {
      await thresholdService.remove(machineId, sensorType);
      return sensorType;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const thresholdSlice = createSlice({
  name: "threshold",
  initialState: {
    list: [],
    machineId: null,
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    error: null,
    saveStatus: "idle", // 'idle' | 'saving' | 'saved' | 'error'
    saveError: null,
  },
  reducers: {
    clearThresholds(state) {
      state.list = [];
      state.machineId = null;
      state.status = "idle";
      state.error = null;
      state.saveStatus = "idle";
      state.saveError = null;
    },
    clearThresholdSave(state) {
      state.saveStatus = "idle";
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchThresholds.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.machineId = action.meta.arg || state.machineId;
      })
      .addCase(fetchThresholds.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = action.payload.list || [];
        state.machineId = action.payload.machineId;
      })
      .addCase(fetchThresholds.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to load thresholds" };
        state.list = [];
      });

    builder
      .addCase(saveThreshold.pending, (state) => {
        state.saveStatus = "saving";
        state.saveError = null;
      })
      .addCase(saveThreshold.fulfilled, (state, action) => {
        state.saveStatus = "saved";
        const saved = action.payload;
        const idx = state.list.findIndex((t) => t.sensorType === saved?.sensorType);
        if (idx !== -1) state.list[idx] = saved;
        else if (saved?.sensorType) state.list.push(saved);
      })
      .addCase(saveThreshold.rejected, (state, action) => {
        state.saveStatus = "error";
        state.saveError = action.payload || { message: "Failed to save threshold" };
      });

    builder.addCase(deleteThreshold.fulfilled, (state, action) => {
      state.list = state.list.filter((t) => t.sensorType !== action.payload);
    });
  },
});

export const { clearThresholds, clearThresholdSave } = thresholdSlice.actions;
export default thresholdSlice.reducer;
