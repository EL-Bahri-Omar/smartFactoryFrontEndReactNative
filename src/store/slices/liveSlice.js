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
      state.unreadCount += 1;
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
