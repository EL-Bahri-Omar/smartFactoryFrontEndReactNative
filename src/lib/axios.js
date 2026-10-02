// src/lib/axios.js
//
// THE shared axios instance. Nothing else in the app imports axios directly.
// Services call this, slices call services, screens dispatch thunks.
//
// • Request interceptor: attaches Bearer token from storage.
// • Response interceptor: on 401 clears storage + fires the unauthorized
//   handler (force logout). There is NO refresh endpoint on the Sprint 1
//   backend (stateless JWT), so no refresh-then-retry happens here.
// • Normalises every error to { status, code, message, details }.
// • To avoid circular imports with the Redux store, a callback-based
//   `setUnauthorizedHandler(fn)` pattern is used for force-logout.

import ax from "axios";
import { API_BASE_URL } from "../constants/api";
import * as storage from "./storage";

// ── Unauthorized handler (set once from store/index.js) ────────────────
let onUnauthorized = null;

/**
 * Register a callback that fires on 401s outside the auth flow (full logout).
 * Called once from store/index.js to avoid circular dependency.
 */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// ── Create the instance ────────────────────────────────────────────────
const api = ax.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
  withCredentials: false, // Bearer-token auth only — no cookies involved
});

// ── Request interceptor ────────────────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    // Attach access token if available
    const token = await storage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // If body is FormData, let axios set the multipart Content-Type
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => Promise.reject(normalizeError(error))
);

// ── Response interceptor ───────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalUrl = error.config?.url || "";
    const status = error.response?.status;

    // Auth endpoints manage their own errors (login shows INVALID_CREDENTIALS,
    // register shows USER_ALREADY_EXISTS, ...). Never force-logout from them.
    const isAuthEndpoint = originalUrl.startsWith("/api/auth/");

    if (status === 401 && !isAuthEndpoint) {
      // Token expired/invalid on an authenticated call — full logout.
      // There is no refresh endpoint to retry with (Sprint 1 backend).
      await storage.clearTokens();
      await storage.clearUser();
      if (onUnauthorized) onUnauthorized();
    }

    return Promise.reject(normalizeError(error));
  }
);

// ── Error normalizer ───────────────────────────────────────────────────

/**
 * Normalize any error into a consistent shape for slices.
 * Never surface raw axios error objects to the rest of the app.
 */
function normalizeError(error) {
  if (error.response) {
    const { status, data } = error.response;
    return {
      status,
      code: data?.code || data?.error || "UNKNOWN",
      message: data?.message || error.message || "An error occurred",
      details: data?.details || data?.errors || null,
    };
  }

  if (error.request) {
    return {
      status: 0,
      code: "NETWORK_ERROR",
      message: "Network error — check your connection",
      details: null,
    };
  }

  return {
    status: 0,
    code: "CLIENT_ERROR",
    message: error.message || "An unexpected error occurred",
    details: null,
  };
}

// ── Convenience helpers ────────────────────────────────────────────────

export const get = (url, config) => api.get(url, config);
export const post = (url, data, config) => api.post(url, data, config);
export const patch = (url, data, config) => api.patch(url, data, config);
export const put = (url, data, config) => api.put(url, data, config);
export const del = (url, config) => api.delete(url, config);

export default api;
