// src/store/slices/settingsSlice.js
//
// Sprint 1: the backend has NO /api/settings endpoint, so settings are
// local-only Redux state (defaults below). When a settings API ships,
// reintroduce HTTP in settingsService and call it from these thunks.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// ── Thunks (local-only for now) ─────────────────────────────────────────

export const fetchSettings = createAsyncThunk(
  "settings/fetch",
  async (_, { getState }) => {
    const { settings } = getState();
    return {
      general: settings.general,
      notifications: settings.notifications,
      machines: settings.machines || { autoRefreshSeconds: 0 },
    };
  }
);

export const updateSettings = createAsyncThunk(
  "settings/update",
  async (body) => {
    return body;
  }
);

// ── Slice ───────────────────────────────────────────────────────────────

const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    general: {
      factoryName: "SmartFactory",
      timezone: "UTC+01:00",
      language: "en",
      dateFormat: "DD/MM/YYYY",
    },
    notifications: {
      enableNotifications: true,
      darkMode: false, // TODO: wired to state only, does not apply a theme yet
    },
    // Machines settings (review: "add the machines settings").
    machines: {
      autoRefreshSeconds: 0, // 0 = off, else refetch the machines list every N seconds
    },
    status: "idle",    // 'idle' | 'loading' | 'succeeded' | 'error'
    saveStatus: "idle", // 'idle' | 'saving' | 'saved' | 'error'
    error: null,
  },
  reducers: {
    setGeneral(state, action) {
      state.general = { ...state.general, ...action.payload };
    },
    setNotifications(state, action) {
      state.notifications = { ...state.notifications, ...action.payload };
    },
    setMachines(state, action) {
      state.machines = { ...(state.machines || {}), ...action.payload };
    },
    clearSaveStatus(state) {
      state.saveStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    // Fetch (local)
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.status = "succeeded";
        if (action.payload?.general) state.general = action.payload.general;
        if (action.payload?.notifications) state.notifications = action.payload.notifications;
        if (action.payload?.machines) state.machines = action.payload.machines;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload;
      });

    // Update (local)
    builder
      .addCase(updateSettings.pending, (state) => {
        state.saveStatus = "saving";
        state.error = null;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.saveStatus = "saved";
        if (action.payload?.general) state.general = { ...state.general, ...action.payload.general };
        if (action.payload?.notifications) state.notifications = { ...state.notifications, ...action.payload.notifications };
        if (action.payload?.machines) state.machines = { ...state.machines, ...action.payload.machines };
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.saveStatus = "error";
        state.error = action.payload;
      });
  },
});

export const { setGeneral, setNotifications, setMachines, clearSaveStatus } = settingsSlice.actions;
export default settingsSlice.reducer;
