// src/store/initAuth.js
//
// Bootstrap auth on app start. Called once from app/_layout.jsx.
//
// The Sprint 1 backend is stateless JWT with no refresh endpoint, and the
// token is persisted (AsyncStorage on native, localStorage on web).
// If a token exists, validate it via GET /api/auth/me. If me fails (expired
// or revoked token), clear storage and stay unauthenticated silently.

import * as storage from "../lib/storage";
import { meThunk } from "./slices/authSlice";

/**
 * Call once on app mount. Rehydrates auth state.
 * @param {Function} dispatch - store.dispatch
 */
export async function bootstrapAuth(dispatch) {
  try {
    const existingToken = await storage.getAccessToken();
    if (!existingToken) return; // No session — stay unauthenticated (no error UI)

    try {
      await dispatch(meThunk()).unwrap();
    } catch {
      // Token invalid/expired — clear and stay unauthenticated silently.
      await storage.clearTokens();
      await storage.clearUser();
    }
  } catch {
    // Swallow — user simply stays unauthenticated
  }
}
