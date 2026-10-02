// src/store/slices/dashboardSlice.js
// Stub slice — will be built when this resource's screen is implemented.

import { createSlice } from "@reduxjs/toolkit";

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    list: [],
    current: null,
    status: "idle",
    error: null,
  },
  reducers: {},
});

export default dashboardSlice.reducer;

