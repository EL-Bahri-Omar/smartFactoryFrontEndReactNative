// src/lib/storage.js
//
// Cross-platform storage wrapper. The rest of the app never branches on Platform.OS.
//
// The Sprint 1 backend is a stateless JWT API: login returns { token, user },
// the token travels in the Authorization: Bearer header, there is NO refresh
// endpoint and NO httpOnly cookie. So the access token is persisted on both
// platforms and rehydrated on launch via GET /api/auth/me:
//
// ┌─────────────────────────────────────────────────────────────────────────┐
/// │ NATIVE (iOS / Android)                                                │
// │   • accessToken → AsyncStorage ("@sf_access_token")                    │
// │   • user JSON   → AsyncStorage ("@sf_user")                            │
// │                                                                       │
// │ WEB (browser)                                                         │
// │   • accessToken → localStorage ("@sf_access_token")                   │
// │   • user JSON   → localStorage ("@sf_user")                           │
// │   • On reload the token is read from localStorage and the user is     │
// │     rehydrated via GET /api/auth/me (see store/initAuth.js).          │
// └─────────────────────────────────────────────────────────────────────────┘
//
// Every export is async to keep a uniform signature across platforms.

import { Platform } from "react-native";

const KEYS = {
  ACCESS_TOKEN: "@sf_access_token",
  USER: "@sf_user",
};

// ── Lazy AsyncStorage import (native only) ──────────────────────────────
let AsyncStorage = null;

async function getStorage() {
  if (AsyncStorage) return AsyncStorage;
  if (Platform.OS !== "web") {
    const mod = await import("@react-native-async-storage/async-storage");
    AsyncStorage = mod.default;
  }
  return AsyncStorage;
}

// ── Web localStorage helpers (guarded for SSR / non-browser envs) ──────
function webGet(key) {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function webSet(key, value) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable — session simply won't survive reload.
  }
}

function webRemove(key) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/** Store the access token. */
export async function setTokens({ accessToken }) {
  if (Platform.OS === "web") {
    if (accessToken) webSet(KEYS.ACCESS_TOKEN, accessToken);
    return;
  }
  const storage = await getStorage();
  if (accessToken) await storage.setItem(KEYS.ACCESS_TOKEN, accessToken);
}

/** Return the access token (string | null). */
export async function getAccessToken() {
  if (Platform.OS === "web") return webGet(KEYS.ACCESS_TOKEN);
  const storage = await getStorage();
  return storage.getItem(KEYS.ACCESS_TOKEN);
}

/** Clear the access token. */
export async function clearTokens() {
  if (Platform.OS === "web") {
    webRemove(KEYS.ACCESS_TOKEN);
    return;
  }
  const storage = await getStorage();
  await storage.removeItem(KEYS.ACCESS_TOKEN);
}

/** Persist user metadata. */
export async function setUser(user) {
  if (Platform.OS === "web") {
    webSet(KEYS.USER, JSON.stringify(user));
    return;
  }
  const storage = await getStorage();
  await storage.setItem(KEYS.USER, JSON.stringify(user));
}

/** Retrieve user metadata (parsed object | null). */
export async function getUser() {
  if (Platform.OS === "web") {
    const raw = webGet(KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const storage = await getStorage();
  const raw = await storage.getItem(KEYS.USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Clear user metadata. */
export async function clearUser() {
  if (Platform.OS === "web") {
    webRemove(KEYS.USER);
    return;
  }
  const storage = await getStorage();
  await storage.removeItem(KEYS.USER);
}
