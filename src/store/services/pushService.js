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
// and never breaks the browser build.

import { Platform } from "react-native";
import { ENDPOINTS } from "../../constants/api";
import api from "../../lib/axios";
import * as notificationService from "./notificationService";
import { markNotificationRead } from "../slices/notificationSlice";

const DEVICE_TYPE = Platform.OS === "ios" ? "IOS" : Platform.OS === "android" ? "ANDROID" : "UNKNOWN";

let responseSubscription = null;
let lastResponseKey = null;

function notificationsModule() {
  try {
    // Lazy require: keep expo-notifications out of the web bundle graph.
    // eslint-disable-next-line global-require
    return require("expo-notifications");
  } catch {
    return null;
  }
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
export async function initPush({ dispatch, router, isAuthenticated = false } = {}) {
  if (Platform.OS === "web" || !isAuthenticated) return false;

  const Notifications = notificationsModule();
  if (!Notifications) return false;

  try {
    // Foreground: show the banner instead of silently dropping it.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
    });

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

    if (effective !== "granted") return false; // token would never arrive

    // Register the device token so the backend can push while the app is
    // closed (item 11). Prefer the raw FCM token (what the backend's
    // firebase sender needs); fall back to the Expo push token.
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
