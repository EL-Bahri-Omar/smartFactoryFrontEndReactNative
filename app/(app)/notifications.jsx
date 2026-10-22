// app/(app)/notifications.jsx
//
// Notifications — web + mobile/tablet (CONFIRMED NotificationController).
//
// The backend persists each user's AppNotification rows:
// { id, userId, alertId?, machineId?, title, message,
//   type: ALERT_CRITICAL | ALERT_HIGH | ALERT_WARNING | MAINTENANCE_ASSIGNED | INFO,
//   isRead, createdAt }.
//
// IMPORTANT: this feed is PER USER. The screen never merges the global alert
// feed into the list anymore — a technician only sees the notifications the
// backend persisted for them (alerts broadcast to ADMIN / RESPONSABLE /
// TECHNICIAN, plus maintenance assignments addressed to that technician).
//
// Alert rows follow the SAME sensor rules as the Alerts screen
// (lib/sensorAlerts): at most one warning + one critical row per sensor, and
// the live dot sits only on the row matching the sensor's current state
// (warning → critical moves it; resolved turns it green). Read vs unread:
// unread rows get a primary tint + left border, read rows stay plain.
//
// Live updates: the backend broadcasts to /topic/users/{userId}/notifications
// (assignments included) and /topic/users/{userId}/unread-count. The list
// upserts incoming rows, and the TopBar badge follows the unread-count topic.
//
// Row tap → PUT /api/notifications/:id/read + navigate to the related screen.
// Deduped alert rows keep every underlying notification id, so tapping marks
// all copies read (no stale badge). "Mark all" walks unread rows (no batch
// endpoint).

import { useCallback, useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Skeleton from "../../src/components/Skeleton";
import EmptyState from "../../src/components/EmptyState";
import FilterChips from "../../src/components/FilterChips";
import BusyRow from "../../src/components/BusyRow";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useRole, PERMISSIONS } from "../../src/hooks/useRole";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useLiveTopic } from "../../src/hooks/useLiveTopic";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  refreshUnreadCount,
  receiveNotification,
  setType,
} from "../../src/store/slices/notificationSlice";
import { fetchAlerts, prependAlert } from "../../src/store/slices/alertSlice";
import { normalizeAlert } from "../../src/store/services/alertService";
import {
  buildSensorStates,
  isAlertNotificationType,
  liveDotFor,
  sensorKey,
  severityFromNotificationType,
} from "../../src/lib/sensorAlerts";
import { getAlertSeverity, normalizeAlertSeverity } from "../../src/lib/status";
import { relativeTime } from "../../src/lib/time";
import { formatNotificationTitle, formatNotificationMessage } from "../../src/lib/alertText";

const TABS = [
  { key: "ALL", label: "All" },
  { key: "ALERTS", label: "Alerts" },
  { key: "MAINTENANCE", label: "Maintenance" },
  { key: "INFO", label: "Info" },
];

/** Tab key ← backend notification type. ALERT_WARNING also belongs to Alerts. */
function tabForType(type) {
  if (isAlertNotificationType(type)) return "ALERTS";
  if (type === "MAINTENANCE_ASSIGNED") return "MAINTENANCE";
  return "INFO";
}

const TYPE_META = {
  MAINTENANCE_ASSIGNED: { label: "Maintenance", color: "#F59E0B", icon: "🔧" },
  INFO: { label: "Info", color: "#2563EB", icon: "•" },
};

function typeMeta(type) {
  return TYPE_META[type] || { label: type || "Info", color: "#94A3B8", icon: "•" };
}

/**
 * One display row from the per-user notification list.
 * Alert notifications are grouped per machine · sensor · severity (newest
 * wins) while keeping every underlying id for mark-read. Non-alert rows pass
 * through untouched.
 */
function buildRows(list, alertInfoById) {
  const grouped = new Map();
  const rows = [];

  for (const n of list) {
    if (!n) continue;
    const severity = severityFromNotificationType(n.type);
    const isAlert = severity != null;

    if (!isAlert) {
      rows.push({
        kind: "notification",
        n,
        alert: null,
        severity: null,
        sensorType: null,
        machineId: n.machineId || null,
        ids: [n.id],
        isRead: !!n.isRead,
        sortAt: n.createdAt,
      });
      continue;
    }

    // alertId is the joined alert. It also reveals the sensor type + live
    // state; when the page does not carry the alert, keep the row anyway and
    // key it by alert id so unrelated sensors are never collapsed together.
    const alert = n.alertId ? alertInfoById.get(n.alertId) || null : null;
    const machineId = alert?.machineId || n.machineId || alert?.machineCode || "";
    const sensorType = alert?.sensorType || alert?.sensorId || "";
    const identity = sensorType ? `${machineId}|${sensorType}` : `alert:${n.alertId || n.id}`;
    const key = `${identity}|${normalizeAlertSeverity(severity)}`;

    const row = {
      kind: "notification",
      n,
      alert,
      severity,
      sensorType,
      machineId,
      ids: [n.id],
      isRead: !!n.isRead,
      sortAt: n.createdAt,
    };

    const prev = grouped.get(key);
    if (!prev) {
      grouped.set(key, row);
      continue;
    }

    // Keep the newest copy, but retain every id so "mark read" clears the
    // duplicates too. The backend already marks the old warning read when a
    // sensor transitions to critical; the newest row owns the read state.
    const rowNewer = new Date(row.sortAt || 0) >= new Date(prev.sortAt || 0);
    const keep = rowNewer ? row : prev;
    const other = rowNewer ? prev : row;
    keep.ids = [...new Set([...keep.ids, ...other.ids])];
    keep.isRead = !!keep.n.isRead;
    grouped.set(key, keep);
  }

  rows.push(...grouped.values());
  rows.sort((a, b) => new Date(b.sortAt || 0) - new Date(a.sortAt || 0));
  return rows;
}

function rowMeta(row) {
  if (row.severity) {
    const sev = getAlertSeverity(row.severity);
    const normalized = normalizeAlertSeverity(row.severity);
    return {
      label:
        normalized === "CRITICAL"
          ? "Critical alert"
          : normalized === "HIGH"
            ? "High alert"
            : normalized === "MEDIUM"
              ? "Warning alert"
              : "Low alert",
      color: sev.color,
      icon: "!",
    };
  }
  return typeMeta(row.n.type);
}

/** Dot only for the alert-notification row matching the live sensor state. */
function notificationDot(row, sensorStates) {
  if (!row.severity) return null;
  const key = row.alert ? sensorKey(row.alert) : null;
  const live = key ? sensorStates.get(key) : null;
  if (!live) return null;
  if (normalizeAlertSeverity(row.severity) !== normalizeAlertSeverity(live.severity)) return null;
  if (row.alert?.id && live.id && row.alert.id !== live.id) return null;
  return liveDotFor({ id: row.alert?.id, severity: row.severity }, live);
}

export default function NotificationsScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dark = useDark();
  const isDesktop = useBreakpoint() === "desktop";
  const { hasPermission, isOperator, role } = useRole();
  const canReadAlerts =
    !isOperator &&
    (hasPermission(PERMISSIONS.ALERT_READ) ||
      ["ADMIN", "RESPONSABLE_INDUSTRIEL", "TECHNICIAN"].includes(role));

  const { list, type, status, error, pagination } = useAppSelector((s) => s.notification);
  const { list: alertList } = useAppSelector((s) => s.alert);
  const liveConnected = useAppSelector((s) => s.live.connected);
  const user = useAppSelector((s) => s.auth.user);

  // Per-user live channel: assignments and alert notifications arrive here
  // the moment the backend persists them (no need to reopen the screen).
  const notificationTopic = user?.id ? `/topic/users/${user.id}/notifications` : null;
  const liveNotification = useLiveTopic(notificationTopic, { enabled: !!notificationTopic });
  const lastLiveRef = useRef(null);

  // Keep the joined alert context current so the live dot moves
  // warning → critical even while this screen is open.
  const liveAlert = useLiveTopic("/topic/alerts", { enabled: canReadAlerts });
  const lastAlertRef = useRef(null);

  useEffect(() => {
    if (!liveNotification) return;
    const key = `${liveNotification.id || ""}-${liveNotification.createdAt || ""}`;
    if (lastLiveRef.current === key) return;
    lastLiveRef.current = key;
    dispatch(receiveNotification(liveNotification));
    dispatch(refreshUnreadCount());
  }, [liveNotification, dispatch]);

  useEffect(() => {
    if (!liveAlert) return;
    const key = `${liveAlert.id || liveAlert.message}-${liveAlert.severity || ""}-${liveAlert.status || ""}-${liveAlert.timestamp || ""}`;
    if (lastAlertRef.current === key) return;
    lastAlertRef.current = key;
    const normalized = normalizeAlert(liveAlert);
    if (normalized) dispatch(prependAlert(normalized));
  }, [liveAlert, dispatch]);

  // Refresh every time the screen gains focus (assignments appear without a
  // remount) and load the alert context used for sensor grouping + dots.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchNotifications({ page: 0, size: 50 }));
      dispatch(refreshUnreadCount());
      if (canReadAlerts) dispatch(fetchAlerts({ page: 0, size: 100 }));
    }, [dispatch, canReadAlerts])
  );

  const alertInfoById = useMemo(() => {
    const map = new Map();
    alertList.forEach((a) => {
      if (a?.id) map.set(a.id, a);
    });
    return map;
  }, [alertList]);

  const sensorStates = useMemo(() => buildSensorStates(alertList), [alertList]);

  // Per-user rows only (no global alert merge).
  const allRows = useMemo(() => buildRows(list, alertInfoById), [list, alertInfoById]);

  const rows = useMemo(() => {
    if (type === "ALL") return allRows;
    return allRows.filter((row) => tabForType(row.n.type) === type);
  }, [allRows, type]);

  const unreadCount = useMemo(() => {
    const counts = { ALL: 0, ALERTS: 0, MAINTENANCE: 0, INFO: 0 };
    allRows.forEach((row) => {
      if (row.isRead) return;
      counts.ALL += 1;
      const key = tabForType(row.n.type);
      if (counts[key] != null) counts[key] += 1;
    });
    return counts;
  }, [allRows]);

  async function markRowsRead(rowsToMark) {
    const ids = new Set();
    rowsToMark.forEach((row) => {
      if (row.isRead) return;
      row.ids.forEach((id) => {
        if (id) ids.add(id);
      });
    });
    if (ids.size > 0) {
      // Await the PUTs so the unread-count refresh reflects the server state.
      await Promise.all(
        [...ids].map((id) => dispatch(markNotificationRead(id)).unwrap().catch(() => null))
      );
    }
    dispatch(refreshUnreadCount());
  }

  /** Row press: mark every underlying copy read, then open the target. */
  function handleRowPress(row) {
    markRowsRead([row]);
    const n = row.n;
    const tab = tabForType(n.type);

    if (tab === "ALERTS") {
      router.push(
        n.alertId
          ? { pathname: "/(app)/alerts", params: { alertId: String(n.alertId) } }
          : "/(app)/alerts"
      );
      return;
    }

    if (tab === "MAINTENANCE") {
      // The backend stores the intervention id in alertId for assignment
      // notifications (NotificationService.notifyMaintenanceAssigned).
      const interventionId = n.interventionId || n.targetId || n.relatedId || n.alertId;
      router.push(
        interventionId
          ? `/(app)/maintenance/${interventionId}`
          : "/(app)/maintenance"
      );
      return;
    }

    const machineKey = n.machineId || n.machineCode;
    if (machineKey) {
      router.push(`/(app)/machines/${machineKey}`);
    }
  }

  async function handleMarkAll() {
    try {
      await dispatch(markAllNotificationsRead()).unwrap();
      dispatch(refreshUnreadCount());
    } catch {
      /* per-row errors already flagged in the slice; badge refresh ignored */
    }
  }

  const initiating = status === "loading" && list.length === 0;
  const refreshing = status === "loading" && list.length > 0;
  const empty = !initiating && rows.length === 0;
  const darkText = dark ? "text-white" : "text-text";
  const darkMuted = dark ? "text-white/60" : "text-text-muted";
  const hasUnread = unreadCount.ALL > 0;

  function renderRow(row, index) {
    const n = row.n;
    const meta = rowMeta(row);
    const unread = !row.isRead;
    const dot = notificationDot(row, sensorStates);

    return (
      <Pressable
        key={`${n.id}-${index}-${n.createdAt}`}
        onPress={() => handleRowPress(row)}
        className={`flex-row items-center px-3 py-3 border-b ${dark ? "border-white/5" : "border-border/50"}`}
        style={({ pressed }) => [
          {
            borderLeftWidth: 3,
            borderLeftColor: unread ? "#2563EB" : "transparent",
            backgroundColor: unread ? (dark ? "rgba(37,99,235,0.16)" : "rgba(37,99,235,0.06)") : "transparent",
          },
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: meta.color + "26" }}
        >
          <Text style={{ fontSize: 15, color: meta.color }}>{meta.icon}</Text>
        </View>
        <View className="flex-1 mr-3">
          <Text
            numberOfLines={1}
            className={`text-sm font-inter ${unread ? "font-bold" : "font-medium"} ${darkText}`}
          >
            {formatNotificationTitle(n.title) || formatNotificationMessage(n.message) || "Notification"}
          </Text>
          <Text numberOfLines={2} className={`text-xs font-inter mt-0.5 ${darkMuted}`}>
            {n.title && n.message
              ? formatNotificationMessage(n.message)
              : [n.machineCode, n.sensorType].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <View className="items-end gap-1">
          <View
            className="px-2 py-0.5 rounded-chip"
            style={{ backgroundColor: meta.color + "1A" }}
          >
            <Text className="text-[10px] font-bold font-inter" style={{ color: meta.color }}>
              {meta.label}
            </Text>
          </View>
          <Text className={`text-[10px] font-inter ${darkMuted}`}>
            {relativeTime(n.createdAt)}
          </Text>
        </View>

        {/* Live state dot — same rule as the Alerts screen: only the row
            matching the sensor's current state carries it. */}
        <View className="items-center ml-2" style={{ width: 22 }}>
          {dot ? (
            <>
              <View
                accessibilityLabel={`Sensor currently ${dot.label}`}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: dot.color,
                  shadowColor: dot.color,
                  shadowOpacity: 0.7,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 3,
                }}
              />
              <Text className={`text-[8px] font-inter mt-0.5 ${darkMuted}`}>{dot.label}</Text>
            </>
          ) : (
            <View style={{ width: 10, height: 10 }} />
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4">
          <View className={isDesktop ? "flex-row items-start justify-between gap-3" : ""}>
            <View className="flex-1">
              <Text className={`text-xl font-bold font-inter ${darkText}`}>Notifications</Text>
              <Text className={`text-sm font-inter ${darkMuted}`}>
                Critical/warning alerts and maintenance assignments sent to you.
              </Text>
            </View>
            <Button
              title="Mark all as read"
              variant="outline"
              size={isDesktop ? "sm" : "md"}
              disabled={!hasUnread}
              onPress={handleMarkAll}
              className={isDesktop ? "" : "mt-2 w-full"}
            />
          </View>
        </View>

        {/* Tabs with unread counts — scrollable chips on mobile */}
        <FilterChips
          chips={TABS.map((t) => ({ ...t, count: unreadCount[t.key] ?? 0 }))}
          active={type}
          onChange={(key) => dispatch(setType(key))}
          className="mb-4"
        />

        <Card>
          {refreshing && <BusyRow label="Updating…" className="mb-1" />}

          {initiating && (
            <View className="p-3 gap-3">
              {[1, 2, 3].map((i) => (
                <View key={i} className="flex-row items-center gap-3">
                  <Skeleton width={40} height={40} rounded />
                  <View className="flex-1 gap-1">
                    <Skeleton width="55%" height={14} />
                    <Skeleton width="80%" height={10} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {empty && (
            <EmptyState
              icon={
                <View
                  className="w-16 h-16 rounded-full items-center justify-center"
                  style={{ backgroundColor: "rgba(37,99,235,0.08)" }}
                >
                  <Text className="text-3xl">🎉</Text>
                </View>
              }
              title="You're all caught up"
              message={
                error
                  ? "Could not load your notifications. Check your connection and retry."
                  : type === "MAINTENANCE"
                    ? "Maintenance assignments will appear here when someone schedules you on an intervention."
                    : type === "ALERTS"
                      ? "Alert notifications addressed to your account will appear here."
                      : "Critical/warning alerts and maintenance assignments addressed to your account will appear here."
              }
              action={
                error ? (
                  <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchNotifications({}))} />
                ) : undefined
              }
            />
          )}

          {!initiating && !empty && (
            <>
              <View>{rows.map(renderRow)}</View>
              {rows.length > 0 && !error && (
                <Text className={`text-[10px] font-inter text-center py-2 ${darkMuted}`}>
                  {`${rows.length} of ${pagination.totalElements || rows.length} notifications`}
                </Text>
              )}
            </>
          )}
        </Card>

        <View className="flex-row items-center justify-between mt-3">
          <Text className={`text-xs font-inter ${darkMuted}`}>
            {liveConnected
              ? "Live updates for your account — assignments arrive in real time"
              : "Live feed offline — notifications refresh when you open this screen"}
          </Text>
        </View>
      </ScrollView>
    </AppShell>
  );
}
