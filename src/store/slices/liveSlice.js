// src/store/slices/liveSlice.js

import { createSlice } from "@reduxjs/toolkit";

const liveSlice = createSlice({
  name: "live",
  initialState: {
    connected: false,
    // True once STOMP has reached CONNECTED at least once this session. The
    // UI must NOT shout "Reconnecting…" during the very first connect (that
    // is normal startup, not a failure) — only after a genuine drop.
    everConnected: false,
    messagesByTopic: {}, // { [destination]: latestPayload }
    unreadCount: 0,
  },
  reducers: {
    setConnected(state, action) {
      const on = !!action.payload;
      state.connected = on;
      if (on) state.everConnected = true;
    },
    pushMessage(state, action) {
      const { topic, payload } = action.payload;
      state.messagesByTopic[topic] = payload;
      // Only alert/notification topics feed the bell badge. Every sensor
      // reading also lands here and would inflate the counter otherwise.
      const t = String(topic || "").toLowerCase();
      if (t.includes("alert") || t.includes("notification")) {
        state.unreadCount += 1;
      }
    },
    markAllRead(state) {
      state.unreadCount = 0;
    },
    reset(state) {
      state.connected = false;
      state.everConnected = false;
      state.messagesByTopic = {};
      state.unreadCount = 0;
    },
  },
});

export const { setConnected, pushMessage, markAllRead, reset } = liveSlice.actions;
export default liveSlice.reducer;
