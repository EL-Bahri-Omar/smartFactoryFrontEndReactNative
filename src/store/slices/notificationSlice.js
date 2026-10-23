// src/store/slices/notificationSlice.js
//
// Sprint 5 — Notifications. State mirrors the screen's tabs:
// { list, type: ALL|UNREAD|ALERTS|MAINTENANCE|INFO, status, moreStatus,
//   error, pagination, unread: { server, local, status } }.
//
// REST GET /api/notifications returns the CURRENT USER's rows only and has
// no server-side type filter, so tab filtering is client-side over `list`
// (backend types: ALERT_CRITICAL | ALERT_HIGH | ALERT_WARNING |
// MAINTENANCE_ASSIGNED | INFO; the "Alerts" tab groups every ALERT_*).
// Pagination is real: fetchNotifications now loads EVERY page up front (the
// full history is on screen without pressing anything), fetchMoreNotifications
// still covers pages that failed to load, and `pagination.allLoaded` tells the
// screen when no older page remains. First page replaces the list, older pages
// are APPENDED, so history (older / already-read rows) stays reachable.
// The backend also broadcasts each new row on
// /topic/users/{userId}/notifications and the unread count on
// /topic/users/{userId}/unread-count — `receiveNotification` and
// `setServerUnread` apply those live updates so assignments and alerts show
// up without reopening the screen.
//
// "Mark all" walks unread rows and fires one PUT per row — the backend has
// no batch mark-read endpoint.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as notificationService from "../services/notificationService";

// 1000 rows: "old" notifications must stay reachable through pagination, and
// the per-user feed is small enough (alert dedupe collapses most of it).
const MAX_LIST_SIZE = 1000;

export const fetchNotifications = createAsyncThunk(
  "notification/fetch",
  async ({ page = 0, size = 100, all = true } = {}, { rejectWithValue }) => {
    try {
      const first = await notificationService.getAll({ page, size });
      if (!all) return { ...first, allLoaded: false };

      // Load ALL older pages up front (the user asked for the full history
      // instead of pressing "load older" repeatedly). Sequential keeps the
      // server's page ordering; deduped by id; capped at MAX_LIST_SIZE and
      // 20 extra pages (2000 rows > MAX, so MAX always wins).
      const list = [...first.list];
      const known = new Set(list.map((n) => n.id));
      let last = first;
      let allLoaded = (first.page ?? 0) + 1 >= (first.totalPages ?? 1);
      let guard = 0;
      while (!allLoaded && list.length < MAX_LIST_SIZE && guard < 20) {
        guard += 1;
        try {
          last = await notificationService.getAll({
            page: (last.page ?? 0) + 1,
            size: last.size || size,
          });
        } catch {
          break; // older pages unreachable — keep what we have
        }
        (last.list || []).forEach((n) => {
          if (!known.has(n.id)) {
            known.add(n.id);
            list.push(n);
          }
        });
        allLoaded = (last.page ?? 0) + 1 >= (last.totalPages ?? 1);
      }
      return { ...first, list, allLoaded };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Older pages of the same feed — APPENDED to the list instead of replacing it,
 * so the history (read rows, older alerts) is reachable from the screen.
 */
export const fetchMoreNotifications = createAsyncThunk(
  "notification/fetchMore",
  async ({ page = 1, size = 100 } = {}, { rejectWithValue }) => {
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
    // Load the remaining pages first, otherwise "mark all" would only cover
    // what happens to be on screen and the server count would stay > 0.
    let guard = 0;
    while (guard < 30) {
      const { pagination } = getState().notification;
      // Already fully loaded by fetchNotifications (all pages up front).
      if (pagination.allLoaded) break;
      if ((pagination.page ?? 0) + 1 >= (pagination.totalPages ?? 1)) break;
      guard += 1;
      try {
        await dispatch(fetchMoreNotifications({ page: (pagination.page ?? 0) + 1 })).unwrap();
      } catch {
        break; // backend unreachable for extra pages — mark what we have
      }
    }

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

/**
 * Polling safety net for LIVE notifications (review: "notifications only
 * appeared after a manual refresh"). The STOMP bridge delivers in
 * milliseconds when the WebSocket is healthy, but a silent connection drop
 * must never force a manual refresh — every tick:
 *   1. refreshes the badge count (server truth), and
 *   2. pulls the newest page and merges rows the local list does not know
 *      yet as live rows (deduped by id, newest ends up on top).
 * Cheap on the LAN: two small GETs per tick, no list replacement.
 */
export const pollNotifications = createAsyncThunk(
  "notification/poll",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const count = await notificationService.getUnreadCount();
      dispatch(setServerUnread(count));

      const first = await notificationService.getAll({ page: 0, size: 50 });
      const known = new Set(getState().notification.list.map((n) => n.id));
      const fresh = (first.list || []).filter((n) => n?.id && !known.has(n.id));
      // receiveNotification prepends — feed the rows oldest-first so the
      // newest one ends up on top of the list.
      [...fresh].reverse().forEach((n) => dispatch(receiveNotification(n)));
      return { fresh: fresh.length };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const notificationSlice = createSlice({
  name: "notification",
  initialState: {
    list: [],
    type: "ALL", // ALL | UNREAD | ALERTS | MAINTENANCE | INFO
    status: "idle",
    moreStatus: "idle", // idle | loading | error (older pages)
    error: null,
    pagination: { page: 0, size: 100, totalElements: 0, totalPages: 1, allLoaded: false },
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
    /**
     * Live row from /topic/users/{userId}/notifications. Upsert by id so a
     * re-delivered message never duplicates a row.
     */
    receiveNotification(state, action) {
      const raw = action.payload;
      if (!raw) return;
      const id = raw.id ?? raw.notificationId;
      if (!id) return;

      let notifType = raw.type || null;
      if (!notifType) {
        const severity = String(raw.severity || "").toUpperCase();
        notifType = severity ? (severity === "WARNING" ? "ALERT_WARNING" : `ALERT_${severity}`) : "INFO";
      }

      const row = {
        id,
        userId: raw.userId ?? null,
        type: notifType,
        alertId: raw.alertId ?? null,
        machineId: raw.machineId ?? null,
        title: raw.title || "",
        message: raw.message || "",
        isRead: raw.isRead ?? raw.read ?? false,
        createdAt: raw.createdAt || new Date().toISOString(),
      };

      // Mirror the backend: a WARNING → CRITICAL transition marks the old
      // warning notification read (only the critical row stays unread).
      if (String(notifType).toUpperCase() === "ALERT_CRITICAL" && row.alertId) {
        state.list.forEach((n) => {
          if (n.alertId === row.alertId && String(n.type || "").toUpperCase() === "ALERT_WARNING") {
            n.isRead = true;
          }
        });
      }

      state.list = [row, ...state.list.filter((n) => n.id !== id)].slice(0, MAX_LIST_SIZE);
    },
    /** Exact unread count pushed on /topic/users/{userId}/unread-count. */
    setServerUnread(state, action) {
      const count = Number(action.payload);
      state.unread.server = Number.isFinite(count) ? count : 0;
      state.unread.status = "succeeded";
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
          size: payload.size ?? 100,
          totalElements: payload.totalElements ?? payload.list.length,
          totalPages: payload.totalPages ?? 1,
          allLoaded: payload.allLoaded ?? false,
        };
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to fetch notifications" };
      });

    builder
      .addCase(fetchMoreNotifications.pending, (state) => {
        state.moreStatus = "loading";
        state.error = null;
      })
      .addCase(fetchMoreNotifications.fulfilled, (state, action) => {
        state.moreStatus = "idle";
        const payload = action.payload || {};
        const known = new Set(state.list.map((n) => n.id));
        const incoming = (payload.list || []).filter((n) => !known.has(n.id));
        state.list = [...state.list, ...incoming].slice(0, MAX_LIST_SIZE);
        state.pagination = {
          page: payload.page ?? state.pagination.page,
          size: payload.size ?? state.pagination.size,
          totalElements: payload.totalElements ?? state.pagination.totalElements,
          totalPages: payload.totalPages ?? state.pagination.totalPages,
          allLoaded:
            payload.allLoaded ??
            ((payload.page ?? state.pagination.page) + 1 >=
              (payload.totalPages ?? state.pagination.totalPages)),
        };
      })
      .addCase(fetchMoreNotifications.rejected, (state, action) => {
        state.moreStatus = "error";
        state.error = action.payload || { message: "Failed to load older notifications" };
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

export const {
  setType,
  bumpLocalUnread,
  receiveNotification,
  setServerUnread,
  clearNotifications,
} = notificationSlice.actions;
export default notificationSlice.reducer;
