// src/store/slices/machineSlice.js

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as machineService from "../services/machineService";

// ── Thunks ──────────────────────────────────────────────────────────────

export const fetchMachines = createAsyncThunk(
  "machine/fetchAll",
  async (params, { rejectWithValue }) => {
    try {
      return await machineService.getAll(params);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Unfiltered counts for the status tabs. The list itself is always
 * server-filtered, so tab badges cannot be computed from it (they would
 * change with every filter — the reported bug). One unfiltered fetch
 * (capped at 100 by the backend) feeds counts only. Refreshed on mount
 * and after every mutation.
 */
export const fetchMachineCounts = createAsyncThunk(
  "machine/fetchCounts",
  async (_, { rejectWithValue }) => {
    try {
      const data = await machineService.getAll({ page: 0, size: 100 });
      const content = Array.isArray(data) ? data : data?.content || [];
      const counts = { ALL: data?.totalElements ?? content.length };
      content.forEach((m) => {
        if (m?.status) counts[m.status] = (counts[m.status] || 0) + 1;
      });
      return counts;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchMachineById = createAsyncThunk(
  "machine/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      return await machineService.getById(id);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const createMachine = createAsyncThunk(
  "machine/create",
  async (body, { rejectWithValue }) => {
    try {
      return await machineService.create(body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateMachine = createAsyncThunk(
  "machine/update",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await machineService.update(id, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const deleteMachine = createAsyncThunk(
  "machine/delete",
  async (id, { rejectWithValue }) => {
    try {
      await machineService.remove(id);
      return id;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// ── Slice ───────────────────────────────────────────────────────────────

const machineSlice = createSlice({
  name: "machine",
  initialState: {
    list: [],
    current: null,
    currentStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    currentError: null,
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    error: null,
    filters: {
      status: null,
      search: "",
      zoneId: null,
    },
    counts: {}, // unfiltered per-status totals for tab badges { ALL, RUNNING, ... }
  },
  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    // Fetch all
    builder
      .addCase(fetchMachines.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchMachines.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = Array.isArray(action.payload) ? action.payload : action.payload?.content || [];
      })
      .addCase(fetchMachines.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to fetch machines" };
      });

    // Fetch by ID
    builder
      .addCase(fetchMachineById.pending, (state, action) => {
        state.currentStatus = "loading";
        state.currentError = null;
        const nextId = action.meta.arg;
        if (state.current && state.current.id !== nextId && state.current.code !== nextId && state.current.machineCode !== nextId) {
          state.current = null;
        }
      })
      .addCase(fetchMachineById.fulfilled, (state, action) => {
        state.currentStatus = "succeeded";
        state.current = action.payload?.data || action.payload;
      })
      .addCase(fetchMachineById.rejected, (state, action) => {
        state.currentStatus = "error";
        state.currentError = action.payload || { message: "Failed to load machine" };
      });

    // Create
    builder
      .addCase(createMachine.fulfilled, (state, action) => {
        state.list.push(action.payload);
      });

    // Unfiltered counts (tab badges — stable across filters)
    builder
      .addCase(fetchMachineCounts.fulfilled, (state, action) => {
        state.counts = action.payload || {};
      });

    // Update
    builder
      .addCase(updateMachine.fulfilled, (state, action) => {
        const idx = state.list.findIndex((m) => m.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.current?.id === action.payload.id) state.current = action.payload;
      });

    // Delete
    builder
      .addCase(deleteMachine.fulfilled, (state, action) => {
        state.list = state.list.filter((m) => m.id !== action.payload);
        if (state.current?.id === action.payload) state.current = null;
      });
  },
});

export const { setFilters } = machineSlice.actions;
export default machineSlice.reducer;
