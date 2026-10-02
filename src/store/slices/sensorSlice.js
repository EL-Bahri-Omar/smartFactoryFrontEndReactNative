// src/store/slices/sensorSlice.js
// Stub slice — will be built when this resource's screen is implemented.

import { createSlice } from "@reduxjs/toolkit";

const sensorSlice = createSlice({
  name: "sensor",
  initialState: {
    list: [],
    current: null,
    status: "idle",
    error: null,
  },
  reducers: {},
});

export default sensorSlice.reducer;

