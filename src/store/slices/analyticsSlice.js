// src/store/slices/analyticsSlice.js
// Stub slice — will be built when this resource's screen is implemented.

import { createSlice } from "@reduxjs/toolkit";

const analyticsSlice = createSlice({
  name: "analytics",
  initialState: {
    list: [],
    current: null,
    status: "idle",
    error: null,
  },
  reducers: {},
});

export default analyticsSlice.reducer;

