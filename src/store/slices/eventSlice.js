// src/store/slices/eventSlice.js

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as eventService from "../services/eventService";

// ── Thunks ──────────────────────────────────────────────────────────────

export const fetchRecentEvents = createAsyncThunk(
  "event/fetchRecent",
  async ({ limit } = {}, { rejectWithValue }) => {
    try {
      return await eventService.getRecent(limit);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// ── Slice ───────────────────────────────────────────────────────────────

const eventSlice = createSlice({
  name: "event",
  initialState: {
    list: [],
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecentEvents.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchRecentEvents.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchRecentEvents.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to fetch events" };
      });
  },
});

export default eventSlice.reducer;
