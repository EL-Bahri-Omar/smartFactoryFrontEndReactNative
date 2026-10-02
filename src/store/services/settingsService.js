// src/store/services/settingsService.js
//
// UNUSED in Sprint 1: the backend has no /api/settings endpoint.
// settingsSlice is local-only until a settings API ships — do not import this.

import api from "../../lib/axios";

/** GET /api/settings */
export async function getSettings() {
  const response = await api.get("/api/settings");
  return response.data;
}

/** PATCH /api/settings */
export async function updateSettings(body) {
  const response = await api.patch("/api/settings", body);
  return response.data;
}
