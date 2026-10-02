// src/store/slices/aiSlice.js
// Stub slice — will be built when this resource's screen is implemented.

import { createSlice } from "@reduxjs/toolkit";

const aiSlice = createSlice({
  name: "ai",
  initialState: {
    list: [],
    current: null,
    status: "idle",
    error: null,
  },
  reducers: {},
});

export default aiSlice.reducer;

