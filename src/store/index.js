// src/store/index.js
// Central Redux store. All slices are registered here.

import { configureStore } from "@reduxjs/toolkit";
import { setUnauthorizedHandler } from "../lib/axios";
import { forceLogout } from "./slices/authSlice";
import { configure as configureLiveService } from "./services/liveService";
import { setConnected, pushMessage, markAllRead, reset } from "./slices/liveSlice";

// ── Import all slice reducers ──────────────────────────────────────────
import authReducer from "./slices/authSlice";
import machineReducer from "./slices/machineSlice";
import sensorReducer from "./slices/sensorSlice";
import readingReducer from "./slices/readingSlice";
import alertReducer from "./slices/alertSlice";
import notificationReducer from "./slices/notificationSlice";
import ticketReducer from "./slices/ticketSlice";
import maintenanceReducer from "./slices/maintenanceSlice";
import zoneReducer from "./slices/zoneSlice";
import eventReducer from "./slices/eventSlice";
import dashboardReducer from "./slices/dashboardSlice";
import analyticsReducer from "./slices/analyticsSlice";
import reportReducer from "./slices/reportSlice";
import userReducer from "./slices/userSlice";
import settingsReducer from "./slices/settingsSlice";
import aiReducer from "./slices/aiSlice";
import liveReducer from "./slices/liveSlice";

// ── Configure the store ────────────────────────────────────────────────

export const store = configureStore({
  reducer: {
    auth: authReducer,
    machine: machineReducer,
    sensor: sensorReducer,
    reading: readingReducer,
    alert: alertReducer,
    notification: notificationReducer,
    ticket: ticketReducer,
    maintenance: maintenanceReducer,
    zone: zoneReducer,
    event: eventReducer,
    dashboard: dashboardReducer,
    analytics: analyticsReducer,
    report: reportReducer,
    user: userReducer,
    settings: settingsReducer,
    ai: aiReducer,
    live: liveReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Disable serializable check for certain actions if needed
      serializableCheck: false,
    }),
});

// ── Wire up the 401 handler (avoids circular imports) ──────────────────
setUnauthorizedHandler(() => {
  store.dispatch(forceLogout());
});

// ── Wire up liveService with dispatch + slice actions ──────────────────
configureLiveService({
  dispatch: store.dispatch,
  actions: { setConnected, pushMessage, markAllRead, reset },
});

export default store;
