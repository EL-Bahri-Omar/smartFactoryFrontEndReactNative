// src/store/slices/eventSlice.js
//
// "Recent Activity" for the Map & Zones screen.
//
// There is NO `/api/events` on this backend (documented in
// docs/api-contract.md), so the old `eventService.getRecent()` always came
// back empty and the card sat on "No recent activity". Instead of an endpoint
// that does not exist, the activity feed is now COMPOSED from two CONFIRMED
// sources the backend really serves:
//
//   GET /api/alerts?size=100&sort=timestamp,desc   → alert raised / updated
//   GET /api/maintenance?size=100                  → intervention created / closed
//
// Both are read with `Promise.allSettled`, so a role that may read one and not
// the other still gets a feed; a role that may read neither gets the honest
// empty state. Rows are merged, sorted newest-first and cut to `limit`.
// Nothing is invented: every row maps 1:1 onto a real backend record.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as alertService from "../services/alertService";
import * as interventionService from "../services/interventionService";

const toTime = (v) => {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export const fetchRecentEvents = createAsyncThunk(
  "event/fetchRecent",
  async ({ limit = 10 } = {}, { rejectWithValue }) => {
    const [alertsRes, maintRes] = await Promise.allSettled([
      alertService.getAll({ size: 100, sort: "timestamp,desc" }),
      interventionService.getAll({ size: 100 }),
    ]);

    const okAlerts = alertsRes.status === "fulfilled" && alertsRes.value;
    const okMaint = maintRes.status === "fulfilled" && maintRes.value;
    if (!okAlerts && !okMaint) {
      return rejectWithValue({ message: "Could not load recent activity." });
    }

    const rows = [];

    if (okAlerts) {
      (alertsRes.value?.list || alertsRes.value?.content || []).forEach((a) => {
        if (!a) return;
        rows.push({
          id: a.id || `alert-${rows.length}`,
          kind: "alert",
          severity: a.severity || null,
          machineCode: a.machineCode || null,
          message: a.message || (a.machineCode ? `${a.machineCode} alert` : "Alert raised"),
          createdAt: a.timestamp || a.createdAt || null,
        });
      });
    }

    if (okMaint) {
      (maintRes.value?.list || maintRes.value?.content || []).forEach((t) => {
        if (!t) return;
        const head = t.title || t.type || "Intervention";
        rows.push({
          id: t.id || `intervention-${rows.length}`,
          kind: "maintenance",
          status: t.status || null,
          severity: null,
          machineCode: t.machineCode || null,
          message: t.machineCode ? `${head} · ${t.machineCode}` : head,
          createdAt: t.updatedAt || t.createdAt || t.scheduledAt || null,
        });
      });
    }

    rows.sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
    return rows.slice(0, limit);
  }
);

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
