// src/store/services/pushService.js
//
// Native push notifications (items 11 + 12):
//   11. notifications reach the phone even when the app is closed — this
//       registers the device token with POST /api/notifications/tokens so
//       the backend can FCM-push AppNotification rows (alerts themselves
//       stay in-app: they only travel on STOMP /topic/alerts).
//   12. pressing a notification marks it read and navigates to the screen
//       it belongs to (intervention detail / alert detail / machine).
//
// expo-notifications is a NATIVE module: every entry point here is guarded
// (Platform.OS !== 'web' + lazy require) so the web bundle never touches it
// and never breaks the browser build. It is also skipped entirely inside
// Expo Go (SDK 53+), where the push native modules do not exist — see
// `isExpoGo()` below. Push then simply stays inactive; everything else works.

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { ENDPOINTS } from "../../constants/api";
import api from "../../lib/axios";
import * as notificationService from "./notificationService";
import { markNotificationRead } from "../slices/notificationSlice";

const DEVICE_TYPE = Platform.OS === "ios" ? "IOS" : Platform.OS === "android" ? "ANDROID" : "UNKNOWN";

let responseSubscription = null;
let tokenSubscription = null;
let lastResponseKey = null;

// Expo Go (SDK 53+) is not allowed to do remote push: the native modules are
// stripped from the client, so `require("expo-notifications")` throws
// "Cannot find native module 'ExpoTopicSubscriptionModule'" while the package
// initialises — the throw is reported before our try/catch can swallow it and
// shows up as a redbox on every launch. Detect Expo Go up-front and treat
// push as unsupported instead of importing the module at all.
//
// `executionEnvironment === 'storeClient'` alone is NOT enough: it also
// matches development builds (expo-dev-client), where push works. Expo Go is
// either flagged by the legacy `appOwnership === 'expo'`, or by the pair
// storeClient + a manifest that only Expo Go carries (`extra.expoGo`).
function isExpoGo() {
  try {
    if (Constants?.appOwnership === "expo") return true;
    return (
      Constants?.executionEnvironment === "storeClient" &&
      Constants?.expoGoConfig != null
    );
  } catch {
    return false;
  }
}

// undefined = not probed yet, null = unsupported, module = available.
let notificationsSupport;
let pushUnavailableNoted = false;

function notificationsModule() {
  if (Platform.OS === "web") return null;
  if (notificationsSupport !== undefined) return notificationsSupport;

  if (isExpoGo()) {
    notificationsSupport = null;
    return null;
  }

  try {
    // Lazy require: keep expo-notifications out of the web bundle graph.
    // eslint-disable-next-line global-require
    notificationsSupport = require("expo-notifications");
  } catch {
    notificationsSupport = null;
  }
  return notificationsSupport;
}

/**
 * Best-effort route for a tapped notification payload.
 * Mirrors the backend `dispatchPushNotification` data maps:
 *   alerts        → { alertId, machineId, severity }
 *   maintenance   → { interventionId, type }
 */
function routeFor(data = {}) {
  if (data.interventionId) return `/(app)/maintenance/${data.interventionId}`;
  if (data.alertId) return { pathname: "/(app)/alerts", params: { alertId: String(data.alertId) } };
  if (data.machineId) return `/(app)/machines/${data.machineId}`;
  if (data.type === "MAINTENANCE_ASSIGNED") return "/(app)/maintenance";
  if (data.type && String(data.type).startsWith("ALERT")) return "/(app)/alerts";
  return "/(app)/notifications";
}

/**
 * Mark the tapped notification read (item 12).
 * The push data map does not carry the row id yet (backend TODO), so we
 * match the newest unread REST row with the same title — cheap (one page)
 * and correct in practice; when the id IS present we call PUT directly.
 */
async function markTappedRead(dispatch, { notificationId, title }) {
  try {
    if (notificationId) {
      await dispatch(markNotificationRead(notificationId));
      return;
    }
    if (!title) return;
    const { list } = await notificationService.getAll({ page: 0, size: 50 });
    const match = list.find((n) => !n.isRead && n.title === title);
    if (match) await dispatch(markNotificationRead(match.id));
  } catch {
    /* never block navigation on a mark-read failure */
  }
}

/**
 * Upload the device token to the backend (POST /api/notifications/tokens).
 * Prefer the raw FCM token (what the backend's Firebase sender needs); fall
 * back to the Expo push token. Returns the token when one was registered.
 */
async function registerToken(Notifications) {
  if (!Notifications) return null;
  let token = null;
  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    token = deviceToken?.data || null;
  } catch {
    token = null;
  }
  if (!token) {
    try {
      const expoToken = await Notifications.getExpoPushTokenAsync();
      token = expoToken?.data || null;
    } catch {
      token = null;
    }
  }
  if (token) {
    await api.post(ENDPOINTS.NOTIFICATION_TOKENS, { token, deviceType: DEVICE_TYPE });
  }
  return token;
}

/**
 * Handle a tap on a system notification: mark read + navigate (item 12).
 * `dispatch` comes from the store, `router` from expo-router (passed in by
 * the caller so this module stays free of component imports).
 */
export async function handleNotificationResponse(dispatch, router, response) {
  const content = response?.notification?.request?.content;
  const data = content?.data || {};
  const key = `${content?.title || ""}|${content?.body || ""}|${JSON.stringify(data)}`;
  // The same response can be delivered twice (cold start + listener) — ignore repeats.
  if (lastResponseKey === key) return;
  lastResponseKey = key;

  await markTappedRead(dispatch, { notificationId: data.notificationId, title: content?.title });

  const target = routeFor(data);
  try {
    router.push(target);
  } catch {
    router.push("/(app)/notifications");
  }
}

/**
 * Init push (native only): permissions, foreground presentation, device
 * token registration and the tap listener. Safe no-op on web or when
 * expo-notifications is unavailable (web bundle, missing native module).
 *
 * @param {{ dispatch: Function, router: any, isAuthenticated: boolean }} opts
 * @returns {Promise<boolean>} true when push is active on this platform.
 */
// Settings → Notifications on/off (review: "let the notification (on/off)
// button work"): module-scoped flag read LIVE by the foreground handler.
let notificationsEnabled = true;

export function setNotificationsEnabled(v) {
  notificationsEnabled = !!v;
}

export async function initPush({ dispatch, router, isAuthenticated = false } = {}) {
  if (Platform.OS === "web" || !isAuthenticated) return false;

  const Notifications = notificationsModule();
  if (!Notifications) {
    // Informative, once per launch — push is simply not available on this
    // client (Expo Go, or a build without the native module). The rest of the
    // app must keep working.
    if (!pushUnavailableNoted) {
      pushUnavailableNoted = true;
      console.info(
        isExpoGo()
          ? "[push] Expo Go cannot receive remote push notifications (SDK 53+). Use a development build for push; continuing without it."
          : "[push] expo-notifications native module unavailable; continuing without push."
      );
    }
    return false;
  }

  try {
    // Foreground: show the banner instead of silently dropping it — unless
    // the user turned notifications OFF in Settings.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: notificationsEnabled,
        shouldShowList: notificationsEnabled,
        shouldPlaySound: false,
        shouldSetBadge: notificationsEnabled,
      }),
    });

    // Restore the persisted on/off choice (Settings → Notifications).
    try {
      const raw = await AsyncStorage.getItem("@sf_notifications_enabled");
      if (raw != null) notificationsEnabled = raw === "1";
    } catch { /* keep default */ }

    // Android 8+ requires a channel; without one FCM messages can be dropped
    // silently — especially while the app is closed. Create it before asking
    // for the Android 13 notification permission.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2563EB",
      });
    }

    const { status } = await Notifications.getPermissionsAsync();
    let effective = status;
    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      effective = asked.status;
    }

    if (!responseSubscription) {
      responseSubscription = Notifications.addNotificationResponseReceivedListener((res) => {
        handleNotificationResponse(dispatch, router, res);
      });
    }

    // Re-register when FCM rotates the device token (can happen without a
    // reinstall). The backend replaces the old token row.
    if (!tokenSubscription && Notifications.addPushTokenListener) {
      tokenSubscription = Notifications.addPushTokenListener((deviceToken) => {
        const token = deviceToken?.data;
        if (!token) return;
        api
          .post(ENDPOINTS.NOTIFICATION_TOKENS, { token, deviceType: DEVICE_TYPE })
          .catch(() => {});
      });
    }

    if (effective !== "granted") return false; // token would never arrive

    // Register the device token so the backend can push while the app is
    // closed (item 11).
    await registerToken(Notifications);
    return true;
  } catch (e) {
    // Never break the app over push setup (missing native module, denied
    // permission, offline token upload).
    console.warn("[push] init skipped:", e?.message);
    return false;
  }
}

/** Best-effort token cleanup on logout (never throws). */
export async function unregisterPushToken() {
  if (Platform.OS === "web") return;
  const Notifications = notificationsModule();
  if (!Notifications) return;
  try {
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    if (deviceToken?.data) {
      await api.delete(`${ENDPOINTS.NOTIFICATION_TOKENS}/${encodeURIComponent(deviceToken.data)}`);
    }
  } catch {
    /* ignore */
  }
}

/**
 * The notification that launched/resumed the app (cold start tap) or null.
 * Web-safe: resolves null immediately so the root layout can await it
 * unconditionally.
 */
export async function getLastNotificationResponseSafe() {
  if (Platform.OS === "web") return null;
  const Notifications = notificationsModule();
  if (!Notifications?.getLastNotificationResponseAsync) return null;
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}
