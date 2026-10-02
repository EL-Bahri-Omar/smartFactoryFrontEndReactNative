// src/store/slices/reportSlice.js
// Stub slice — will be built when this resource's screen is implemented.

import { createSlice } from "@reduxjs/toolkit";

const reportSlice = createSlice({
  name: "report",
  initialState: {
    list: [],
    current: null,
    status: "idle",
    error: null,
  },
  reducers: {},
});

export default reportSlice.reducer;

