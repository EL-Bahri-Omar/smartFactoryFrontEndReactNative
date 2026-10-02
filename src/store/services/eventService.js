// src/store/services/eventService.js

import api from "../../lib/axios";

/** GET /api/events?limit=N */
export async function getRecent(limit = 10) {
  const response = await api.get("/api/events", { params: { limit } });
  return response.data;
}
