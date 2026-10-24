// src/store/services/notificationService.js
//
// Sprint 5 — Notifications. ALL CONFIRMED against the real
// NotificationController (US40):
//   GET   /api/notifications?page=&size=           → Page<AppNotification>
//         (current user only; server defaults to 20/page, newest first)
//   PUT   /api/notifications/:id/read              → marked-read notification
//   PUT   /api/notifications/mark-read (NO body)   → { message, unreadCount }
//         marks EVERY unread notification of the user in one call
//   GET   /api/notifications/unread-count          → { unreadCount }
//   POST  /api/notifications/tokens { token, deviceType, deviceId? } (native FCM)
//   DELETE /api/notifications/tokens/:token   (also body { token } variant)
//   NOTE: there is NO DELETE /:id nor /clear-all in the backend — the UI
//   must not offer per-row delete.
//
// AppNotification row: { id, userId, userEmail?, machineId?, interventionId?,
// data? { interventionId, machineId, severity, screen, type }, title, message,
// type: ALERT_CRITICAL | ALERT_WARNING | MAINTENANCE | GROUP_MEMBER_ADDED |
// GROUP_MEMBER_REMOVED (+ legacy ALERT_HIGH / MAINTENANCE_ASSIGNED), read |
// isRead, createdAt, readAt? }. interventionId + data are the DIRECT route to
// the intervention detail page (tap-a-push / tap-a-row).
// Live delivery: /topic/users/{userId}/notifications (row payload) and
// /topic/users/{userId}/unread-count (exact badge count). "Mark all" is the
// single bulk call PUT /api/notifications/mark-read.

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/**
 * GET /api/notifications — no server-side type filter; the UI filters by
 * type after fetching (All / Alerts / Maintenance / Info tabs).
 */
export async function getAll({ page = 0, size = 50 } = {}) {
  const response = await api.get(ENDPOINTS.NOTIFICATIONS, {
    params: { page, size },
  });
  const data = response.data || {};
  const list = normalizeNotifications(data);
  return {
    list,
    page: data.number ?? data.page ?? page,
    size: data.size ?? size,
    totalElements: data.totalElements ?? list.length,
    totalPages: data.totalPages ?? 1,
  };
}

/** GET /api/notifications/unread-count (CONFIRMED) → number. */
export async function getUnreadCount() {
  const response = await api.get(ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT);
  const body = response.data || {};
  return typeof body.unreadCount === "number" ? body.unreadCount : Number(body.unreadCount) || 0;
}

/**
 * PUT /api/notifications/:id/read (CONFIRMED) → the updated notification.
 * Returns a tolerant { id, isRead: true } so optimistic updates survive
 * even if the payload is bare.
 */
export async function markRead(id) {
  const url = buildUrl(ENDPOINTS.NOTIFICATION_MARK_READ, { id });
  const response = await api.put(url);
  const row = response.data;
  if (row && typeof row === "object" && row.id) {
    return normalizeNotification(row);
  }
  return { id, isRead: true };
}

/**
 * PUT /api/notifications/mark-read — CONFIRMED bulk endpoint. No body and no
 * id → the server marks EVERY unread notification of the connected user and
 * answers { message, unreadCount }. Replaces the old per-row markRead loop.
 */
export async function markAllRead() {
  const response = await api.put(`${ENDPOINTS.NOTIFICATIONS}/mark-read`);
  return response.data || {};
}

/**
 * POST /api/notifications/tokens (CONFIRMED) — registers an FCM device
 * token. Only useful on native builds with expo-notifications; the web
 * app never calls this (no Firebase project is wired for web push).
 */
export async function registerDeviceToken(token, deviceType = "WEB") {
  const response = await api.post(ENDPOINTS.NOTIFICATION_TOKENS, { token, deviceType });
  return response.data;
}

/** Normalize an array or Spring Page envelope to notification rows. */
export function normalizeNotifications(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(normalizeNotification).filter(Boolean);
  if (Array.isArray(data.content)) return data.content.map(normalizeNotification).filter(Boolean);
  if (Array.isArray(data.notifications)) return data.notifications.map(normalizeNotification).filter(Boolean);
  const one = normalizeNotification(data);
  return one ? [one] : [];
}

/**
 * Normalize a REST row. Safe for a bare live-alert payload too: alerts of
 * severity CRITICAL/HIGH are mirrored into notifications server-side, so a
 * raw { id, message, severity } still lands in the Alerts tab.
 */
export function normalizeNotification(row) {
  if (!row || typeof row !== "object") return null;
  const id = row.id ?? row.notificationId;
  if (!id && !row.message) return null;
  let type = row.type || null;
  if (!type && row.severity) {
    type = String(row.severity).toUpperCase() === "CRITICAL" ? "ALERT_CRITICAL" : "ALERT_HIGH";
  } else if (!type) {
    type = "INFO";
  }
  return {
    id,
    userId: row.userId ?? null,
    type,
    alertId: row.alertId ?? null,
    machineId: row.machineId ?? row.relatedId ?? null,
    machineCode: row.machineCode ?? null,
    // Direct navigation keys (Sprint 7 backend): rows carry interventionId
    // top-level and/or inside `data` — used by row press + push taps.
    interventionId: row.interventionId ?? row.data?.interventionId ?? null,
    data: row.data && typeof row.data === "object" ? row.data : null,
    title: row.title || "",
    message: row.message || row.content || "",
    isRead: row.isRead ?? row.read ?? false,
    createdAt: row.createdAt || row.timestamp || new Date().toISOString(),
  };
}
