// src/store/slices/alertSlice.js
// Stub slice — will be built when this resource's screen is implemented.

import { createSlice } from "@reduxjs/toolkit";

const alertSlice = createSlice({
  name: "alert",
  initialState: {
    list: [],
    current: null,
    status: "idle",
    error: null,
  },
  reducers: {},
});

export default alertSlice.reducer;

