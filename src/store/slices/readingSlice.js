// src/store/slices/readingSlice.js

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as readingService from "../services/readingService";

const RANGE_MS = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export function rangeToWindow(range = "6h") {
  const to = new Date();
  const span = RANGE_MS[range] || RANGE_MS["6h"];
  const from = new Date(to.getTime() - span);
  return { from: from.toISOString(), to: to.toISOString() };
}

export const fetchReadings = createAsyncThunk(
  "reading/fetch",
  async ({ machineId, range = "6h", sensorType } = {}, { rejectWithValue }) => {
    try {
      const { from, to } = rangeToWindow(range);
      const list = await readingService.getByMachine({
        machineId,
        from,
        to,
        sensorType,
      });
      return { list, range, machineId };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const readingSlice = createSlice({
  name: "reading",
  initialState: {
    list: [],
    range: "6h",
    machineId: null,
    status: "idle",
    error: null,
  },
  reducers: {
    setRange(state, action) {
      state.range = action.payload;
    },
    clearReadings(state) {
      state.list = [];
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReadings.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.range = action.meta.arg?.range || state.range;
        state.machineId = action.meta.arg?.machineId || state.machineId;
      })
      .addCase(fetchReadings.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = action.payload.list || [];
        state.range = action.payload.range;
        state.machineId = action.payload.machineId;
      })
      .addCase(fetchReadings.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to load readings" };
        state.list = [];
      });
  },
});

export const { setRange, clearReadings } = readingSlice.actions;
export default readingSlice.reducer;
