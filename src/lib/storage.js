// src/lib/storage.js
//
// Cross-platform storage wrapper. The rest of the app never branches on Platform.OS.
//
// The Sprint 1 backend is a stateless JWT API: login returns { token, user },
// the token travels in the Authorization: Bearer header, there is NO refresh
// endpoint and NO httpOnly cookie.
//
// Remember-me model:
// - Memory (module-level) always holds the current session. Lost on reload.
// - Persistent storage (AsyncStorage native / localStorage web) is written
//   ONLY when remember === true. bootstrapAuth rehydrates via GET /me only
//   for remembered sessions — unchecked = session ends on app close.
// - Remembered email is kept separately so the login field can be prefilled.
//
// Every export is async to keep a uniform signature across platforms.

import { Platform } from "react-native";

const KEYS = {
  ACCESS_TOKEN: "@sf_access_token",
  USER: "@sf_user",
  REMEMBER: "@sf_remember",
  REMEMBER_EMAIL: "@sf_remember_email",
};

// ── In-memory session (lost on reload — the non-remembered case) ──────
let memoryToken = null;
let memoryUser = null;

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

async function nativeGet(key) {
  const storage = await getStorage();
  return storage.getItem(key);
}

async function nativeSet(key, value) {
  const storage = await getStorage();
  await storage.setItem(key, value);
}

async function nativeRemove(key) {
  const storage = await getStorage();
  await storage.removeItem(key);
}

// ── Remember flag + remembered email ────────────────────────────────────

export async function setRememberMe(remember) {
  if (Platform.OS === "web") {
    if (remember) webSet(KEYS.REMEMBER, "1");
    else webRemove(KEYS.REMEMBER);
    return;
  }
  if (remember) await nativeSet(KEYS.REMEMBER, "1");
  else await nativeRemove(KEYS.REMEMBER);
}

export async function getRememberMe() {
  if (Platform.OS === "web") return webGet(KEYS.REMEMBER) === "1";
  return (await nativeGet(KEYS.REMEMBER)) === "1";
}

export async function setRememberedEmail(email) {
  if (!email) return;
  if (Platform.OS === "web") webSet(KEYS.REMEMBER_EMAIL, email);
  else await nativeSet(KEYS.REMEMBER_EMAIL, email);
}

export async function getRememberedEmail() {
  if (Platform.OS === "web") return webGet(KEYS.REMEMBER_EMAIL);
  return nativeGet(KEYS.REMEMBER_EMAIL);
}

export async function clearRememberedEmail() {
  if (Platform.OS === "web") webRemove(KEYS.REMEMBER_EMAIL);
  else await nativeRemove(KEYS.REMEMBER_EMAIL);
}

// ── Tokens ──────────────────────────────────────────────────────────────

/** Store the access token. Pass { remember: true } to survive app restart. */
export async function setTokens({ accessToken, remember = false }) {
  memoryToken = accessToken ?? null;
  await setRememberMe(remember);
  if (Platform.OS === "web") {
    if (remember && accessToken) webSet(KEYS.ACCESS_TOKEN, accessToken);
    else webRemove(KEYS.ACCESS_TOKEN);
    return;
  }
  if (remember && accessToken) await nativeSet(KEYS.ACCESS_TOKEN, accessToken);
  else await nativeRemove(KEYS.ACCESS_TOKEN);
}

/** Return the access token (memory first, then persistent). */
export async function getAccessToken() {
  if (memoryToken) return memoryToken;
  const t = Platform.OS === "web" ? webGet(KEYS.ACCESS_TOKEN) : await nativeGet(KEYS.ACCESS_TOKEN);
  if (t) memoryToken = t;
  return t;
}

/** Clear the access token (memory + persistent). Keeps the remember flag. */
export async function clearTokens() {
  memoryToken = null;
  if (Platform.OS === "web") webRemove(KEYS.ACCESS_TOKEN);
  else await nativeRemove(KEYS.ACCESS_TOKEN);
}

// ── User ────────────────────────────────────────────────────────────────

/** Persist user metadata. Respects the remember flag unless overridden. */
export async function setUser(user, opts = {}) {
  memoryUser = user ?? null;
  let remember = opts.remember;
  if (remember === undefined) remember = await getRememberMe();
  if (!user) return;
  if (Platform.OS === "web") {
    if (remember) webSet(KEYS.USER, JSON.stringify(user));
    else webRemove(KEYS.USER);
    return;
  }
  if (remember) await nativeSet(KEYS.USER, JSON.stringify(user));
  else await nativeRemove(KEYS.USER);
}

/** Retrieve user metadata (memory first, then persistent). */
export async function getUser() {
  if (memoryUser) return memoryUser;
  const raw = Platform.OS === "web" ? webGet(KEYS.USER) : await nativeGet(KEYS.USER);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    memoryUser = parsed;
    return parsed;
  } catch {
    return null;
  }
}

/** Clear user metadata (memory + persistent). */
export async function clearUser() {
  memoryUser = null;
  if (Platform.OS === "web") webRemove(KEYS.USER);
  else await nativeRemove(KEYS.USER);
}
