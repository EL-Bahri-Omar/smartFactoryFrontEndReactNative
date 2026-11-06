// src/store/services/aiService.js
//
// Sprint 11 — AI Predictions. Fetches anomalies with thresholdType="AI_MODEL"
// from the existing anomalies endpoint, and subscribes to the AI prediction
// WebSocket topic for real-time updates.
//
// AI prediction shape (from WebSocket /topic/ai-predictions):
// { eventType: "AI_PREDICTION", machineId, machineCode, predictedStatus,
//   confidence, anomalyScore, severity, temperatureMean, vibrationRms,
//   currentMean, rpmMean, timestamp }
//
// AI anomaly shape (from GET /api/anomalies filtered client-side):
// Standard Anomaly with thresholdType === "AI_MODEL"

import api from "../../lib/axios";
import { ENDPOINTS } from "../../constants/api";

/**
 * GET /api/anomalies — fetches all anomalies, then filters client-side
 * for AI_MODEL thresholdType. Returns the array of AI anomalies.
 * Sprint 11: accepts empty status to get ALL predictions (OPEN + RESOLVED + ACKNOWLEDGED).
 */
export async function getAiPredictions({ status, page = 0, size = 200 } = {}) {
  const params = { page, size, sort: "timestamp,desc" };
  if (status) params.status = status;
  const { data } = await api.get(ENDPOINTS.ANOMALIES, { params });
  // Filter for AI_MODEL anomalies only
  const content = data?.content || data || [];
  const aiAnomalies = Array.isArray(content)
    ? content.filter((a) => a.thresholdType === "AI_MODEL")
    : [];
  return aiAnomalies;
}

/**
 * GET /api/anomalies — fetches AI anomalies for a specific machine.
 */
export async function getAiPredictionsForMachine(machineId, { status, page = 0, size = 20 } = {}) {
  const params = { machineId, page, size, sort: "timestamp,desc" };
  if (status) params.status = status;
  const { data } = await api.get(ENDPOINTS.ANOMALIES, { params });
  const content = data?.content || data || [];
  const aiAnomalies = Array.isArray(content)
    ? content.filter((a) => a.thresholdType === "AI_MODEL")
    : [];
  return aiAnomalies;
}
