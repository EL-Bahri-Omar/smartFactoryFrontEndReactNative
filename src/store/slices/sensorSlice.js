// src/store/slices/sensorSlice.js
//
// CONFIRMED Sprint 3: sensors are read-only from the app side.
// The backend auto-provisions one sensor per (machine, type) on the first
// MQTT message and flips ONLINE/OFFLINE itself (US19). No CRUD in Sprint 3.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as sensorService from "../services/sensorService";

/** Fetch sensors for one machine. Pass the Mongo id, not the code. */
export const fetchMachineSensors = createAsyncThunk(
  "sensor/fetchByMachine",
  async (machineId, { rejectWithValue }) => {
    try {
      const list = await sensorService.getMachineSensors(machineId);
      return { list, machineId };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const sensorSlice = createSlice({
  name: "sensor",
  initialState: {
    list: [],
    machineId: null,
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    error: null,
  },
  reducers: {
    clearSensors(state) {
      state.list = [];
      state.machineId = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMachineSensors.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.machineId = action.meta.arg || state.machineId;
      })
      .addCase(fetchMachineSensors.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = action.payload.list || [];
        state.machineId = action.payload.machineId;
      })
      .addCase(fetchMachineSensors.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to load sensors" };
        state.list = [];
      });
  },
});

export const { clearSensors } = sensorSlice.actions;
export default sensorSlice.reducer;
