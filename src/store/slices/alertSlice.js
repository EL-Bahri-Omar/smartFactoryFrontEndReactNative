// src/store/slices/alertSlice.js
//
// Sprint 5 — Alerts. Two data paths:
//  1. REST /api/alerts (CONFIRMED — AlertController): list, acknowledge,
//     resolve (no batch "mark all" endpoint exists).
//  2. STOMP /topic/alerts (CONFIRMED): new broadcasts are pushed into the
//     list by prependAlert from the screen's useEffect watching
//     liveSlice.messagesByTopic.
//
// Severity stays raw (CRITICAL|HIGH|WARNING|INFO); presentation maps
// through lib/status.js. Status uses backend ACTIVE|ACKNOWLEDGED|RESOLVED.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as alertService from "../services/alertService";

// Alerts keep accumulating live; the list is capped so a long-running
// session cannot grow forever.
// Cap for the GLOBAL alert list. Health scores count ACTIVE alerts per
// machine+sensorType, so truncating here would silently drop sensors from the
// score — the dashboard and map ask for 500 rows to cover the whole fleet.
const MAX_LIST_SIZE = 500;

export const fetchAlerts = createAsyncThunk(
  "alert/fetch",
  async ({ page = 0, size = 100, status, severity, machineId } = {}, { rejectWithValue }) => {
    try {
      return await alertService.getAll({ page, size, status, severity, machineId });
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Machine-scoped alerts (item 9: machine sensor alerts for ADMIN /
 * TECHNICIAN / RESPONSABLE_INDUSTRIEL on the machine detail screen).
 * Kept in its own state bucket so it never clobbers the global list the
 * /alerts screen renders.
 */
export const fetchMachineAlerts = createAsyncThunk(
  "alert/fetchMachine",
  async ({ machineId, page = 0, size = 50 } = {}, { rejectWithValue }) => {
    try {
      return await alertService.getAll({ page, size, machineId });
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** POST /api/alerts/:id/acknowledge { comment? } (CONFIRMED). */
export const acknowledgeAlert = createAsyncThunk(
  "alert/acknowledge",
  async ({ id, comment } = {}, { rejectWithValue }) => {
    try {
      const updated = await alertService.acknowledge(id, comment);
      return { id, ...updated };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** POST /api/alerts/:id/resolve { comment? } (CONFIRMED). */
export const resolveAlert = createAsyncThunk(
  "alert/resolve",
  async ({ id, comment } = {}, { rejectWithValue }) => {
    try {
      const updated = await alertService.resolve(id, comment);
      return { id, ...updated };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * "Mark all read" — the backend has NO batch endpoint, so this walks the
 * ACTIVE rows and acknowledges each one. Rows whose acknowledge call fails
 * are rolled back to ACTIVE by the per-row rejected handler below.
 */
export const acknowledgeAllAlerts = createAsyncThunk(
  "alert/acknowledgeAll",
  async (_, { getState, dispatch, rejectWithValue }) => {
    const activeIds = getState().alert.list
      .filter((a) => a.status === "ACTIVE")
      .map((a) => a.id);
    const failures = [];
    for (const id of activeIds) {
      try {
        await dispatch(acknowledgeAlert({ id })).unwrap();
      } catch (error) {
        failures.push(id);
      }
    }
    // One rejected per failed row already flips status back; report failures
    // only when EVERY row failed (consumer shows a toast).
    if (failures.length > 0 && failures.length === activeIds.length && activeIds.length > 0) {
      return rejectWithValue({ message: "Failed to acknowledge alerts" });
    }
    return { acknowledged: activeIds.length - failures.length };
  }
);

const alertSlice = createSlice({
  name: "alert",
  initialState: {
    list: [],
    machineList: [], // machine detail screen (item 9) — kept separate on purpose
    machineStatus: "idle",
    machineError: null,
    filter: "ALL", // ALL | CRITICAL | HIGH | MEDIUM | LOW (UI chips; WARNING→MEDIUM, INFO→LOW)
    status: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    error: null,
    ackStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'error' (acknowledge/resolve ops)
    pagination: { page: 0, size: 100, totalElements: 0, totalPages: 1 },
  },
  reducers: {
    setFilter(state, action) {
      state.filter = action.payload || "ALL";
    },
    /** Prepend a live STOMP alert; replaces an earlier row with the same id. */
    prependAlert(state, action) {
      const incoming = action.payload;
      if (!incoming || (!incoming.id && !incoming.message)) return;
      state.list = [
        incoming,
        ...state.list.filter((a) => a.id !== incoming.id),
      ].slice(0, MAX_LIST_SIZE);
    },
    /** Merge a normalized REST row over an existing id (detail refresh). */
    upsertAlert(state, action) {
      const incoming = action.payload;
      if (!incoming?.id) return;
      const idx = state.list.findIndex((a) => a.id === incoming.id);
      if (idx >= 0) state.list[idx] = { ...state.list[idx], ...incoming };
      else state.list.unshift(incoming);
    },
    /** Change the status of one row (used with optimistic paths). */
    setAlertStatus(state, action) {
      const { id, status } = action.payload;
      const row = state.list.find((a) => a.id === id);
      if (row && status) row.status = status;
    },
    clearAlerts(state) {
      state.list = [];
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlerts.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.status = "succeeded";
        const payload = action.payload || {};
        // Merge: keep live rows whose ids are not in the fetched batch.
        const fetchedIds = new Set(payload.list.map((a) => a.id));
        const liveExtras = state.list.filter((a) => !fetchedIds.has(a.id) && a.status === "ACTIVE");
        state.list = [...liveExtras, ...payload.list].slice(0, MAX_LIST_SIZE);
        state.pagination = {
          page: payload.page ?? 0,
          size: payload.size ?? 100,
          totalElements: payload.totalElements ?? payload.list.length,
          totalPages: payload.totalPages ?? 1,
        };
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to fetch alerts" };
      });

    builder
      .addCase(fetchMachineAlerts.pending, (state) => {
        state.machineStatus = "loading";
        state.machineError = null;
      })
      .addCase(fetchMachineAlerts.fulfilled, (state, action) => {
        state.machineStatus = "succeeded";
        const payload = action.payload || {};
        state.machineList = payload.list || [];
      })
      .addCase(fetchMachineAlerts.rejected, (state, action) => {
        state.machineStatus = "error";
        state.machineError = action.payload || { message: "Failed to fetch machine alerts" };
      });

    builder
      .addCase(acknowledgeAlert.pending, (state, action) => {
        state.ackStatus = "loading";
        const { id, comment } = action.meta.arg || {};
        // Optimistic flip so the row reacts instantly.
        const row = state.list.find((a) => a.id === id);
        if (row) {
          row.status = "ACKNOWLEDGED";
          if (comment !== undefined) row.comment = comment;
        }
      })
      .addCase(acknowledgeAlert.rejected, (state, action) => {
        state.ackStatus = "error";
        // Roll back the optimistic flip.
        const { id } = action.meta.arg || {};
        const row = state.list.find((a) => a.id === id);
        if (row && row.status === "ACKNOWLEDGED") row.status = "ACTIVE";
      })
      .addCase(acknowledgeAlert.fulfilled, (state) => {
        state.ackStatus = "succeeded";
      });

    builder
      .addCase(resolveAlert.pending, (state, action) => {
        state.ackStatus = "loading";
        const { id, comment } = action.meta.arg || {};
        const row = state.list.find((a) => a.id === id);
        if (row) {
          row.status = "RESOLVED";
          if (comment !== undefined) row.comment = comment;
        }
      })
      .addCase(resolveAlert.rejected, (state, action) => {
        state.ackStatus = "error";
        const { id } = action.meta.arg || {};
        const row = state.list.find((a) => a.id === id);
        if (row && row.status === "RESOLVED") row.status = "ACTIVE";
      })
      .addCase(resolveAlert.fulfilled, (state) => {
        state.ackStatus = "succeeded";
      });

    builder
      .addCase(acknowledgeAllAlerts.pending, (state) => {
        state.ackStatus = "loading";
      })
      .addCase(acknowledgeAllAlerts.rejected, (state) => {
        state.ackStatus = "error";
      })
      .addCase(acknowledgeAllAlerts.fulfilled, (state) => {
        state.ackStatus = "succeeded";
      });
  },
});

export const {
  setFilter,
  prependAlert,
  upsertAlert,
  setAlertStatus,
  clearAlerts,
} = alertSlice.actions;
export default alertSlice.reducer;
