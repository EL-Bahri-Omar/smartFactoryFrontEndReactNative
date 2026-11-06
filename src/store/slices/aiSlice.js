// src/store/slices/aiSlice.js
//
// Sprint 8 — AI Predictions Redux slice.
// Manages AI prediction data from the SmartFactory AI inference service.
//
// Data sources:
//   1. REST: GET /api/anomalies (filtered for thresholdType === "AI_MODEL")
//   2. WebSocket: /topic/ai-predictions (real-time predictions)
//   3. WebSocket: /topic/machines/{id}/ai-prediction (per-machine)

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as aiService from "../services/aiService";

// --- Async thunks ---

/** Fetch all active AI predictions (anomalies with thresholdType=AI_MODEL). */
export const fetchAiPredictions = createAsyncThunk(
  "ai/fetchPredictions",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await aiService.getAiPredictions(params);
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  }
);

/** Fetch AI predictions for a specific machine. */
export const fetchMachineAiPredictions = createAsyncThunk(
  "ai/fetchMachinePredictions",
  async (machineId, { rejectWithValue }) => {
    try {
      return await aiService.getAiPredictionsForMachine(machineId);
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || err.message);
    }
  }
);

// --- Slice ---

const aiSlice = createSlice({
  name: "ai",
  initialState: {
    /** All AI predictions (anomalies with thresholdType=AI_MODEL) */
    list: [],
    /** Per-machine AI predictions */
    machinePredictions: [],
    /** Latest real-time AI prediction per machine (from WebSocket) */
    liveByMachine: {},
    /** Loading state: idle | loading | succeeded | error */
    status: "idle",
    machineStatus: "idle",
    error: null,
    machineError: null,
  },
  reducers: {
    /**
     * Push a live AI prediction from WebSocket.
     * Payload: { machineId, machineCode, predictedStatus, confidence,
     *            anomalyScore, severity, temperatureMean, vibrationRms,
     *            currentMean, rpmMean, timestamp }
     */
    pushLivePrediction(state, action) {
      const pred = action.payload;
      if (!pred?.machineId && !pred?.machineCode) return;
      const key = pred.machineId || pred.machineCode;
      state.liveByMachine[key] = {
        ...pred,
        receivedAt: new Date().toISOString(),
      };
      // Also index by machineCode for easy lookup
      if (pred.machineCode && pred.machineCode !== key) {
        state.liveByMachine[pred.machineCode] = state.liveByMachine[key];
      }
    },

    /** Clear all live predictions (e.g. on logout). */
    clearLivePredictions(state) {
      state.liveByMachine = {};
    },

    /** Reset all AI state. */
    resetAi(state) {
      state.list = [];
      state.machinePredictions = [];
      state.liveByMachine = {};
      state.status = "idle";
      state.machineStatus = "idle";
      state.error = null;
      state.machineError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAiPredictions
      .addCase(fetchAiPredictions.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchAiPredictions.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = action.payload;
      })
      .addCase(fetchAiPredictions.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || action.error?.message;
      })
      // fetchMachineAiPredictions
      .addCase(fetchMachineAiPredictions.pending, (state) => {
        state.machineStatus = "loading";
        state.machineError = null;
      })
      .addCase(fetchMachineAiPredictions.fulfilled, (state, action) => {
        state.machineStatus = "succeeded";
        state.machinePredictions = action.payload;
      })
      .addCase(fetchMachineAiPredictions.rejected, (state, action) => {
        state.machineStatus = "error";
        state.machineError = action.payload || action.error?.message;
      });
  },
});

export const { pushLivePrediction, clearLivePredictions, resetAi } = aiSlice.actions;
export default aiSlice.reducer;
