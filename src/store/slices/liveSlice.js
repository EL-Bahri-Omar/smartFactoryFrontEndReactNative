// src/store/slices/liveSlice.js

import { createSlice } from "@reduxjs/toolkit";

const liveSlice = createSlice({
  name: "live",
  initialState: {
    connected: false,
    messagesByTopic: {}, // { [destination]: latestPayload }
    unreadCount: 0,
  },
  reducers: {
    setConnected(state, action) {
      state.connected = action.payload;
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
      state.messagesByTopic = {};
      state.unreadCount = 0;
    },
  },
});

export const { setConnected, pushMessage, markAllRead, reset } = liveSlice.actions;
export default liveSlice.reducer;
