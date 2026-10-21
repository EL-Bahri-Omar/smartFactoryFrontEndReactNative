// app/(app)/notifications.jsx
//
// Notifications — web + mobile (Sprint 5, CONFIRMED NotificationController).
//
// The backend persists each user's AppNotification rows:
// { id, userId, alertId?, machineId?, title, message,
//   type: ALERT_CRITICAL | ALERT_HIGH | MAINTENANCE_ASSIGNED | INFO,
//   isRead, createdAt }.
//
// Tabs: All · Alerts (ALERT_CRITICAL + ALERT_HIGH) · Maintenance
// (MAINTENANCE_ASSIGNED) · Info (INFO). Filtering is client-side — the REST
// endpoint has no type param. There is NO /topic/notifications STOMP
// publisher: the feed comes from GET /api/notifications only.
//
// Extra live context: while the app is open, recent /topic/alerts payloads
// are merged into the "Alerts" tab (marked read in sync with the Alerts
// screen) so nothing is missed between two REST syncs.
//
// Row tap → PUT /api/notifications/:id/read (CONFIRMED) + navigate to the
// related screen. "Mark all" walks unread rows (no batch endpoint).

import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Skeleton from "../../src/components/Skeleton";
import EmptyState from "../../src/components/EmptyState";
import FilterChips from "../../src/components/FilterChips";
import BusyRow from "../../src/components/BusyRow";
import { useDark } from "../../src/hooks/useDark";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useLiveTopic } from "../../src/hooks/useLiveTopic";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  refreshUnreadCount,
  setType,
} from "../../src/store/slices/notificationSlice";
import { fetchAlerts } from "../../src/store/slices/alertSlice";
import { normalizeAlert } from "../../src/store/services/alertService";
import { markAllRead } from "../../src/store/slices/liveSlice";
import { getAlertSeverity } from "../../src/lib/status";
import { relativeTime } from "../../src/lib/time";
import { formatNotificationTitle, formatNotificationMessage } from "../../src/lib/alertText";

const TABS = [
  { key: "ALL", label: "All" },
  { key: "ALERTS", label: "Alerts" },
  { key: "MAINTENANCE", label: "Maintenance" },
  { key: "INFO", label: "Info" },
];

/** Tab key ← backend notification type. */
function tabForType(type) {
  if (type === "ALERT_CRITICAL" || type === "ALERT_HIGH") return "ALERTS";
  if (type === "MAINTENANCE_ASSIGNED") return "MAINTENANCE";
  if (type === "INFO") return "INFO";
  return "INFO";
}

const TYPE_META = {
  ALERT_CRITICAL: { label: "Critical alert", color: "#DC2626", icon: "!" },
  ALERT_HIGH: { label: "Alert", color: "#EA580C", icon: "!" },
  MAINTENANCE_ASSIGNED: { label: "Maintenance", color: "#F59E0B", icon: "🔧" },
  INFO: { label: "Info", color: "#2563EB", icon: "•" },
};

function typeMeta(type) {
  return TYPE_META[type] || { label: type || "Info", color: "#94A3B8", icon: "•" };
}

export default function NotificationsScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dark = useDark();

  const { list, type, status, error, pagination } = useAppSelector((s) => s.notification);
  const { list: alertList } = useAppSelector((s) => s.alert);
  const liveConnected = useAppSelector((s) => s.live.connected);

  // Recent live alerts are ALSO merged into the Alerts tab (the backend
  // only mirrors CRITICAL/HIGH alerts into per-user notifications, and REST
  // sync runs on open).
  const liveMessage = useLiveTopic("/topic/alerts");
  const [seenLive, setSeenLive] = useState([]); // arrays of normalized live rows (session only)

  // Visiting the screen = caught up on the live bell counter badge + REST
  // unread count refresh.
  useEffect(() => {
    dispatch(markAllRead());
    dispatch(fetchNotifications({ page: 0, size: 50 }));
    dispatch(refreshUnreadCount()).catch(() => {});
  }, [dispatch]);

  // The Alerts tab mirrors the Alerts screen content; load the alert list
  // once if no other screen populated it (best effort — a 403 is fine).
  const alertCount = useAppSelector((s) => s.alert.list.length);
  const alertStatus = useAppSelector((s) => s.alert.status);
  useEffect(() => {
    if (alertCount === 0 && alertStatus === "idle") {
      dispatch(fetchAlerts({ page: 0, size: 100 })).catch(() => {});
    }
  }, [dispatch, alertCount, alertStatus]);

  // Live alert → prepend as an ALERT_* notification-shaped row (dedupes by
  // id inside the rows memo).
  useEffect(() => {
    if (!liveMessage) return;
    const row = normalizeAlert(liveMessage);
    if (!row) return;
    setSeenLive((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev].slice(0, 100)));
  }, [liveMessage]);

  /**
   * Rows displayed:
   *  - REST notifications (kind: notification)
   *  - live alert rows merged only into the Alerts tab (+ All) (kind: alert)
   *  - alertSlice rows (ALERT_* type) share the Alerts tab for consistency
   *    with the Alerts screen; deduped by alert id against the REST list.
   */
  const allRows = useMemo(() => {
    const restRows = list.map((n) => ({ kind: "notification", n }));
    const restAlertIds = new Set(list.map((n) => n.alertId).filter(Boolean));
    const liveRows = seenLive
      .filter((a) => !restAlertIds.has(a.id))
      .map((a) => ({
        kind: "alert",
        n: {
          id: `live-${a.id}`,
          type: String(a.severity).toUpperCase() === "CRITICAL" ? "ALERT_CRITICAL" : "ALERT_HIGH",
          title: "",
          message: a.message,
          isRead: a.status !== "ACTIVE",
          createdAt: a.timestamp,
          alertId: a.id,
          machineCode: a.machineCode,
          sensorType: a.sensorType,
        },
      }));
    const seenAlertIds = new Set(liveRows.map((r) => r.n.alertId));
    const alertSliceRows = alertList
      .filter((a) => a.id && !restAlertIds.has(a.id) && !seenAlertIds.has(a.id))
      .map((a) => ({
        kind: "alert",
        n: {
          id: `alert-${a.id}`,
          type: String(a.severity).toUpperCase() === "CRITICAL" ? "ALERT_CRITICAL" : "ALERT_HIGH",
          title: "",
          message: a.message,
          isRead: a.status !== "ACTIVE",
          createdAt: a.timestamp,
          alertId: a.id,
          machineCode: a.machineCode,
          sensorType: a.sensorType,
        },
      }));
    // Alert-tab rows: live + slice + rest alert notifications
    const alertsOnly = [
      ...liveRows,
      ...alertSliceRows,
      ...restRows.filter((r) => tabForType(r.n.type) === "ALERTS"),
    ];
    // All tab: everything, newest first
    const all = [...alertsOnly, ...restRows].sort(
      (a, b) => new Date(b.n.createdAt || 0) - new Date(a.n.createdAt || 0)
    );
    return { all: all, alertsOnly: alertsOnly };
  }, [list, seenLive, alertList]);

  const rows = useMemo(() => {
    if (type === "ALL") return allRows.all;
    if (type === "ALERTS") return allRows.alertsOnly;
    return allRows.all.filter(
      (row) => row.kind === "notification" && tabForType(row.n.type) === type
    );
  }, [allRows, type]);  const unreadCount = useMemo(() => {
    const c = { ALL: 0, ALERTS: 0, MAINTENANCE: 0, INFO: 0 };
    allRows.all.forEach((row) => {
      if (!row.n.isRead) {
        c.ALL += 1;
        const key = row.kind === "alert" ? "ALERTS" : tabForType(row.n.type);
        if (c[key] != null) c[key] += 1;
      }
    });
    return c;
  }, [allRows]);

  /**
   * Row press (item 12): mark as read, then jump to the screen the
   * notification is FOR.
   *  - ALERT_* → Alerts (opens that alert's detail sheet when we have its id)
   *  - MAINTENANCE_ASSIGNED → that intervention's detail when the row carries
   *    interventionId (backend TODO: persist it on AppNotification; until
   *    then the Maintenance list opens)
   *  - INFO with a machine → the machine detail
   */
  function handleRowPress(row) {
    const n = row.n;
    if (row.kind === "notification" && !n.isRead) {
      dispatch(markNotificationRead(n.id));
      dispatch(refreshUnreadCount()).catch(() => {});
    }
    const tab = row.kind === "alert" ? "ALERTS" : tabForType(n.type);
    if (tab === "ALERTS") {
      router.push(
        n.alertId
          ? { pathname: "/(app)/alerts", params: { alertId: String(n.alertId) } }
          : "/(app)/alerts"
      );
      return;
    }
    if (tab === "MAINTENANCE") {
      const interventionId = n.interventionId || n.targetId || n.relatedId;
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
      return;
    }
    // INFO without a target: the notifications screen itself is the place.
  }

  async function handleMarkAll() {
    try {
      await dispatch(markAllNotificationsRead()).unwrap();
      dispatch(refreshUnreadCount()).catch(() => {});
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
    let meta;
    if (row.kind === "alert") {
      // Live alert rows reuse the severity palette.
      const sev = getAlertSeverity(n.type === "ALERT_CRITICAL" ? "CRITICAL" : "HIGH");
      meta = { label: n.type === "ALERT_CRITICAL" ? "Critical alert" : "Alert", color: sev.color, icon: "!" };
    } else {
      meta = typeMeta(n.type);
    }
    const unread = !n.isRead;
    return (
      <Pressable
        key={`${n.id}-${index}-${n.createdAt}`}
        onPress={() => handleRowPress(row)}
        className={`flex-row items-center px-3 py-3 border-b ${dark ? "border-white/5" : "border-border/50"}`}
        // Unread = subtle primary left border + bold title (mobile pattern;
        // applied web + mobile).
        style={({ pressed }) => [
          unread ? { borderLeftWidth: 3, borderLeftColor: "#2563EB" } : null,
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
          <Text numberOfLines={1} className={`text-xs font-inter mt-0.5 ${darkMuted}`}>
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
      </Pressable>
    );
  }

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4 flex-row items-start justify-between">
          <View>
            <Text className={`text-xl font-bold font-inter ${darkText}`}>Notifications</Text>
            <Text className={`text-sm font-inter ${darkMuted}`}>
              Critical/high alerts and maintenance assignments sent to you.
            </Text>
          </View>
          <Pressable onPress={handleMarkAll} disabled={!hasUnread} className="self-start">
            <Text className={`text-sm font-inter text-primary ${hasUnread ? "" : "opacity-40"}`}>
              Mark all as read
            </Text>
          </Pressable>
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
                    : "Critical and high alerts are mirrored here when they arrive."
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
            {liveConnected ? "Live feed connected — Alerts tab updates in real time" : "Live feed offline — static REST rows"}
          </Text>
        </View>
      </ScrollView>
    </AppShell>
  );
}
