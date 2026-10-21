// src/store/slices/notificationSlice.js
//
// Sprint 5 — Notifications. State mirrors the screen's tabs:
// { list, type: ALL|ALERTS|MAINTENANCE|INFO, status, error, pagination,
//   unread: { server, local, status } }.
//
// REST GET /api/notifications returns the CURRENT USER's rows only and has
// no server-side type filter, so tab filtering is client-side over `list`
// (backend types: ALERT_CRITICAL | ALERT_HIGH | MAINTENANCE_ASSIGNED | INFO;
// the "Alerts" tab groups ALERT_CRITICAL + ALERT_HIGH). There is NO
// /topic/notifications STOMP publisher: rows come from REST only, plus the
// TopBar badge whose server value can be refreshed anywhere (refreshUnread).
//
// "Mark all" walks unread rows and fires one PUT per row — the backend has
// no batch mark-read endpoint.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as notificationService from "../services/notificationService";

const MAX_LIST_SIZE = 200;

export const fetchNotifications = createAsyncThunk(
  "notification/fetch",
  async ({ page = 0, size = 50 } = {}, { rejectWithValue }) => {
    try {
      return await notificationService.getAll({ page, size });
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** PUT /api/notifications/:id/read (CONFIRMED). */
export const markNotificationRead = createAsyncThunk(
  "notification/markRead",
  async (id, { rejectWithValue }) => {
    try {
      return await notificationService.markRead(id) || { id, isRead: true };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** Mark every unread row read, one PUT at a time (no batch endpoint). */
export const markAllNotificationsRead = createAsyncThunk(
  "notification/markAll",
  async (_, { getState, dispatch, rejectWithValue }) => {
    const unreadIds = getState().notification.list
      .filter((n) => !n.isRead)
      .map((n) => n.id);
    let failures = 0;
    for (const id of unreadIds) {
      try {
        await dispatch(markNotificationRead(id)).unwrap();
      } catch (error) {
        failures += 1;
      }
    }
    // Optimistic flips were already applied in pending; only surface an
    // error when NO row could be marked.
    if (failures > 0 && failures === unreadIds.length && unreadIds.length > 0) {
      return rejectWithValue({ message: "Failed to mark notifications as read" });
    }
    return { marked: unreadIds.length - failures };
  }
);

/** GET /api/notifications/unread-count → { unreadCount } (CONFIRMED). */
export const refreshUnreadCount = createAsyncThunk(
  "notification/refreshUnread",
  async (_, { rejectWithValue }) => {
    try {
      return await notificationService.getUnreadCount();
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const notificationSlice = createSlice({
  name: "notification",
  initialState: {
    list: [],
    type: "ALL", // ALL | ALERTS | MAINTENANCE | INFO
    status: "idle",
    error: null,
    pagination: { page: 0, size: 50, totalElements: 0, totalPages: 1 },
    // Server truth for the TopBar badge. `server` replaces the local live
    // counter whenever a fresh count arrives; a null server value keeps
    // `local` visible (backend unreachable).
    unread: { server: null, status: "idle" },
  },
  reducers: {
    setType(state, action) {
      state.type = action.payload || "ALL";
    },
    /**
     * Local live fallback for the badge: only alert-derived payloads bump
     * it (liveSlice already gates its counter to alert/notification topics).
     */
    bumpLocalUnread(state) {
      state.unread.server = null;
    },
    clearNotifications(state) {
      state.list = [];
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = "succeeded";
        const payload = action.payload || {};
        state.list = payload.list.slice(0, MAX_LIST_SIZE);
        state.pagination = {
          page: payload.page ?? 0,
          size: payload.size ?? 50,
          totalElements: payload.totalElements ?? payload.list.length,
          totalPages: payload.totalPages ?? 1,
        };
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to fetch notifications" };
      });

    builder
      .addCase(markNotificationRead.pending, (state, action) => {
        const id = action.meta.arg;
        const row = state.list.find((n) => n.id === id);
        if (row) row.isRead = true; // optimistic flip
      })
      .addCase(markNotificationRead.rejected, (state) => {
        state.error = { message: "Failed to mark notification as read" };
      });

    builder
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        if (state.unread.server !== null) state.unread.server = 0;
      });

    builder
      .addCase(refreshUnreadCount.pending, (state) => {
        state.unread.status = "loading";
      })
      .addCase(refreshUnreadCount.fulfilled, (state, action) => {
        state.unread.status = "succeeded";
        state.unread.server = typeof action.payload === "number" ? action.payload : 0;
      })
      .addCase(refreshUnreadCount.rejected, (state) => {
        state.unread.status = "error";
        // Keep `server: null` so the local live counter stays the badge source.
      });
  },
});

export const { setType, bumpLocalUnread, clearNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
