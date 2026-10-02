// src/store/slices/maintenanceSlice.js
// Stub slice — will be built when this resource's screen is implemented.

import { createSlice } from "@reduxjs/toolkit";

const maintenanceSlice = createSlice({
  name: "maintenance",
  initialState: {
    list: [],
    current: null,
    status: "idle",
    error: null,
  },
  reducers: {},
});

export default maintenanceSlice.reducer;

