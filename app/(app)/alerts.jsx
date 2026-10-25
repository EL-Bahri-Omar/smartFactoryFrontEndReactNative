// app/(app)/alerts.jsx
//
// Alerts — web + mobile, same file (Sprint 5, prompt 09).
//
// Data paths:
//  - REST GET /api/alerts (CONFIRMED — AlertController).
//  - STOMP /topic/alerts (CONFIRMED) — new alerts prepend live through
//    alertSlice.prependAlert, and liveSlice.unreadCount feeds the bell.
//
// UX notes from review:
//  - One row per (machine · sensor · state): the backend creates ONE alert
//    per sensor episode and mutates it on WARNING → CRITICAL, so the screen
//    de-dupes client-side to at most one warning + one critical row per
//    sensor (lib/sensorAlerts.dedupeSensorAlerts).
//  - Only the row matching the sensor's CURRENT state shows the live dot:
//    it moves from warning to critical, and turns green when resolved. The
//    dot color matches the status palette (lib/status).
//  - Read vs unread (product spec): ACTIVE rows are unread (GRAY background +
//    bold title); ACKNOWLEDGED / RESOLVED rows are read (WHITE background +
//    light text). A Select mode marks any set of rows read at once.
//  - The detail sheet was redesigned (severity header, key/value grid) and
//    its "Create Intervention" jumps to the Maintenance screen's own create
//    button (alert → intervention link). Only the responsable industriel can
//    create an intervention, so the button is hidden for every other role.
//
// Access: every role EXCEPT OPERATOR can consult alerts (matches the backend
// AlertController guard). OPERATOR also has no Alerts navigation entry.
//
// Severity mapping (from the real STOMP payload): CRITICAL→High,
// WARNING→Medium, INFO→Low (lib/status).

import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Skeleton from "../../src/components/Skeleton";
import EmptyState from "../../src/components/EmptyState";
import FilterChips from "../../src/components/FilterChips";
import SeverityBadge from "../../src/components/SeverityBadge";
import BottomSheet from "../../src/components/BottomSheet";
import PaginationBar from "../../src/components/PaginationBar";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useRole, PERMISSIONS } from "../../src/hooks/useRole";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useLiveTopic } from "../../src/hooks/useLiveTopic";
import { formatAlertMessage } from "../../src/lib/alertText";
import { useDialog } from "../../src/components/dialog/DialogContext";
import {
  fetchAlerts,
  acknowledgeAlert,
  acknowledgeAllAlerts,
  resolveAlert,
  prependAlert,
  setFilter,
} from "../../src/store/slices/alertSlice";
import { fetchMachines } from "../../src/store/slices/machineSlice";
import { normalizeAlert } from "../../src/store/services/alertService";
import { getAlertSeverity, normalizeAlertSeverity, getAlertStatus } from "../../src/lib/status";
import {
  buildSensorStates,
  dedupeSensorAlerts,
  liveDotFor,
  sensorKey,
  UNKNOWN_DOT_COLOR,
} from "../../src/lib/sensorAlerts";
import { relativeTime } from "../../src/lib/time";

const FILTER_CHIPS = [
  { key: "ALL", label: "All" },
  { key: "CRITICAL", label: "Critical" },
  { key: "HIGH", label: "High" },
  { key: "MEDIUM", label: "Medium" },
  { key: "LOW", label: "Low" },
];

function humanize(value) {
  if (!value) return "";
  const s = String(value).replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AlertsScreen() {
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const isDesktop = useBreakpoint() === "desktop";
  const dark = useDark();
  const { hasPermission, isOperator, isResponsable, role } = useRole();
  // Backend AlertController: ADMIN / RESPONSABLE_INDUSTRIEL / TECHNICIAN only
  // (OPERATOR is explicitly excluded, even though its legacy role default
  // still contains ALERT_READ). Role membership is checked as well so a stale
  // permission list can never lock an allowed role out of alerts.
  const canRead =
    !isOperator &&
    (hasPermission(PERMISSIONS.ALERT_READ) ||
      ["ADMIN", "RESPONSABLE_INDUSTRIEL", "TECHNICIAN"].includes(role));
  const canAcknowledge = hasPermission(PERMISSIONS.ALERT_ACKNOWLEDGE);

  const { list, filter, status, error, ackStatus } = useAppSelector((s) => s.alert);
  const { list: machines } = useAppSelector((s) => s.machine);
  const connected = useAppSelector((s) => s.live.connected);

  const liveMessage = useLiveTopic("/topic/alerts", { enabled: canRead });
  const lastLiveRef = useRef(null);

  const [detailOpen, setDetailOpen] = useState(false); // mobile detail sheet
  const [selected, setSelected] = useState(null); // alert opened in the detail sheet
  const [sheetBusy, setSheetBusy] = useState(false);
  // Selection mode: pick several alerts and mark them read (acknowledge)
  // in one action — same UX as the Notifications screen.
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Client-side pagination over the deduped + filtered rows (review:
  // "add a pagination in the alerts and notification pages"). The feed
  // loads its history up front, so paging is a pure slice.
  const [page, setPage] = useState(0);

  // REST sync (CONFIRMED endpoint).
  useEffect(() => {
    if (canRead) dispatch(fetchAlerts({ page: 0, size: 100 }));
  }, [dispatch, canRead]);

  // Machine list for code/type resolution in rows — only if not already loaded.
  useEffect(() => {
    if (canRead && machines.length === 0) dispatch(fetchMachines({ size: 100 }));
  }, [dispatch, canRead, machines.length]);

  // Live feed → prepend to the list (dedupes inside the reducer).
  useEffect(() => {
    if (!liveMessage) return;
    // Include severity + status: the backend MUTATES the same alert id on
    // WARNING → CRITICAL, so the key must change for the transition to apply.
    const key = `${liveMessage.id || liveMessage.message}-${liveMessage.severity || ""}-${liveMessage.status || ""}-${liveMessage.timestamp || ""}`;
    if (lastLiveRef.current === key) return;
    lastLiveRef.current = key;
    dispatch(prependAlert(normalizeAlert(liveMessage)));
  }, [liveMessage, dispatch]);

  // Deep link: a notification press lands here with ?alertId=… — open that
  // alert's detail sheet (item 12). Runs once the list carries the row.
  const deepLinkAlertId = Array.isArray(routeParams.alertId)
    ? routeParams.alertId[0]
    : routeParams.alertId;
  useEffect(() => {
    if (!deepLinkAlertId || list.length === 0) return;
    const found = list.find((a) => a.id === deepLinkAlertId);
    if (found) {
      setSelected(found);
      if (!isDesktop) setDetailOpen(true); // mobile sheet; web shows on `selected` alone
      // eslint-disable-next-line no-unused-expressions
      router.setParams?.({ alertId: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkAlertId, list]);

  const machineById = useMemo(() => {
    const map = {};
    machines.forEach((m) => {
      if (m.id) map[m.id] = m;
      if (m.code) map[m.code] = m;
    });
    return map;
  }, [machines]);

  // Collapse repeated incidents (one warning + one critical per sensor max),
  // then order newest-first.
  const deduped = useMemo(() => dedupeSensorAlerts(list), [list]);

  // Live state per machine·sensor (drives the end-of-row dot).
  const sensorStates = useMemo(() => buildSensorStates(list), [list]);

  const counts = useMemo(() => {
    const c = { ALL: deduped.length, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    deduped.forEach((a) => {
      const key = normalizeAlertSeverity(a.severity);
      if (c[key] != null) c[key] += 1;
    });
    return c;
  }, [deduped]);

  const visibleAlerts = useMemo(() => {
    if (filter === "ALL") return deduped;
    return deduped.filter((a) => normalizeAlertSeverity(a.severity) === filter);
  }, [deduped, filter]);

  // Current page, clamped so a shrinking filter never leaves an empty page.
  const PAGE_SIZE = isDesktop ? 15 : 10;
  const alertPageCount = Math.max(1, Math.ceil(visibleAlerts.length / PAGE_SIZE));
  const safeAlertPage = Math.min(page, alertPageCount - 1);
  const pageAlerts = visibleAlerts.slice(
    safeAlertPage * PAGE_SIZE,
    (safeAlertPage + 1) * PAGE_SIZE
  );

  async function handleAcknowledge(alert) {
    setSelected(null);
    setDetailOpen(false);
    try {
      await dispatch(acknowledgeAlert({ id: alert.id })).unwrap();
    } catch (e) {
      dialog.alert("Failed", e?.message || "Could not acknowledge the alert.", "error");
    }
  }

  async function handleResolve(alert) {
    try {
      await dispatch(resolveAlert({ id: alert.id })).unwrap();
      // Close only after the server confirms, then SAY what happened —
      // the old instant-silent close made the button look like it did
      // nothing (review feedback).
      setSelected(null);
      setDetailOpen(false);
      dialog.alert(
        "Alert resolved",
        "The alert is now RESOLVED: it stays in the list as history (white/read row), leaves the active count, and the sensor keeps monitoring.",
        "success"
      );
    } catch (e) {
      dialog.alert("Failed", e?.message || "Could not resolve the alert.", "error");
    }
  }

  /**
   * Jump to the Maintenance screen's own "Create Intervention" button with
   * the alert context pre-filled (alert → intervention link).
   */
  function goToCreateIntervention(alert) {
    setSelected(null);
    setDetailOpen(false);
    const ui = normalizeAlertSeverity(alert.severity);
    const priority = ui === "CRITICAL" || ui === "HIGH" ? "HIGH" : ui === "LOW" ? "LOW" : "MEDIUM";
    const description =
      alert.value != null
        ? `${alert.sensorType || "Sensor"}: ${alert.value}${alert.threshold != null ? ` (threshold: ${alert.threshold})` : ""}`
        : "";
    router.push({
      pathname: "/(app)/maintenance",
      params: {
        alertId: alert.id || "",
        machineId: alert.machineId || "",
        machineCode: alert.machineCode || "",
        message: formatAlertMessage(alert.message) || "",
        description,
        priority,
      },
    });
  }

  async function handleMarkAllRead() {
    if (deduped.length === 0) return;
    setSheetBusy(true);
    try {
      await dispatch(acknowledgeAllAlerts()).unwrap();
    } catch (e) {
      dialog.alert("Failed", e?.message || "Could not acknowledge the alerts.", "error");
    } finally {
      setSheetBusy(false);
    }
  }

  function toggleSelectAlert(alert) {
    if (!alert?.id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(alert.id)) next.delete(alert.id);
      else next.add(alert.id);
      return next;
    });
  }

  /** Selection action: acknowledge every selected ACTIVE row (= mark read). */
  async function handleMarkSelectedRead() {
    const targets = deduped.filter((a) => selectedIds.has(a.id) && a.status === "ACTIVE");
    setSelectedIds(new Set());
    setSelecting(false);
    if (targets.length === 0) return;
    setSheetBusy(true);
    try {
      for (const alert of targets) {
        await dispatch(acknowledgeAlert({ id: alert.id })).unwrap();
      }
    } catch (e) {
      dialog.alert("Failed", e?.message || "Could not acknowledge the alerts.", "error");
    } finally {
      setSheetBusy(false);
    }
  }

  function exitSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  if (!canRead) {
    return (
      <AppShell>
        <Card className="my-4">
          <EmptyState
            title="Restricted area"
            message="Alerts are available to every role except operators. Ask an administrator if you need access."
          />
        </Card>
      </AppShell>
    );
  }

  const loading = status === "loading" && list.length === 0;
  const empty = status !== "loading" && deduped.length === 0;
  const darkText = dark ? "text-white" : "text-text";
  const darkMuted = dark ? "text-white/60" : "text-text-muted";
  // Read rows use a light (muted) title/body per the read-unread spec;
  // unread rows keep FULL strength (bold title + semibold body).
  const readTitleClass = dark ? "text-white/55" : "text-text-muted";
  const readBodyClass = dark ? "text-white/40" : "text-text-muted/70";
  const unreadBodyClass = dark ? "text-white/85" : "text-text";

  /** Shared row content resolver */
  function rowModel(alert) {
    const machine = machineById[alert.machineCode || alert.machineId] || null;
    const liveState = sensorStates.get(sensorKey(alert)) || null;
    return {
      alert,
      machineCode: alert.machineCode || machine?.code || (alert.machineId ? String(alert.machineId).slice(0, 8) : "Machine"),
      machineType: machine?.type ? humanize(machine.type) : "",
      sensorType: humanize(alert.sensorType),
      sevMeta: getAlertSeverity(alert.severity),
      statusMeta: getAlertStatus(alert.status),
      // Full sensor state (detail sheet) vs. the row-specific dot: only the
      // row matching the current state carries the dot.
      liveState,
      live: liveState || { color: UNKNOWN_DOT_COLOR, label: "Unknown" },
      dot: liveDotFor(alert, liveState),
    };
  }

  function alertTitle(alert) {
    // Backend messages are French — present them in English (lib/alertText).
    const english = formatAlertMessage(alert.message);
    if (english) return english;
    return `${humanize(alert.sensorType) || "Sensor"} alert`;
  }

  function renderRow(alert, onPressRow) {
    const m = rowModel(alert);
    const isActive = m.alert.status === "ACTIVE";
    const unread = isActive; // ACTIVE = unread · ACKNOWLEDGED/RESOLVED = read
    const dangerous = m.sevMeta.color === "#DC2626";
    const isSel = selectedIds.has(m.alert.id);
    // Read vs unread: unread = brighter/highlighted, read = plain base.
    const unreadBg = dark ? "#1E3A5F" : "#E0EDFF";
    const readBg = dark ? "#0F172A" : "#FFFFFF";
    // Status pill — makes "Resolve" visibly DO something: the chip flips
    // Active → Acknowledged → Resolved right on the row.
    const statusTint =
      m.alert.status === "RESOLVED"
        ? { bg: "rgba(22,163,74,0.15)", fg: "#16A34A" }
        : m.alert.status === "ACKNOWLEDGED"
          ? { bg: "rgba(37,99,235,0.15)", fg: "#2563EB" }
          : { bg: "rgba(220,38,38,0.15)", fg: "#DC2626" };

    return (
      <Pressable
        key={m.alert.id || `${m.alert.timestamp}-${m.alert.message}`}
        onPress={onPressRow}
        className={`flex-row items-center px-3 py-3 border-b ${dark ? "border-white/5" : "border-border/50"}`}
        style={({ pressed }) => [
          {
            borderLeftWidth: isSel ? 3 : unread ? 4 : 0,
            borderLeftColor: isSel ? "#2563EB" : unread ? "#3B82F6" : "transparent",
            backgroundColor: unread ? unreadBg : readBg,
            opacity: m.alert.status === "RESOLVED" ? 0.85 : 1,
          },
          pressed ? { opacity: 0.85 } : null,
        ]}
      >
        {/* Selection indicator — only in selection mode (whole row toggles). */}
        {selecting && (
          <View className="mr-3 items-center justify-center" style={{ width: 22, height: 22 }}>
            {isSel ? (
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 20, height: 20, backgroundColor: "#2563EB" }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "bold" }}>✓</Text>
              </View>
            ) : (
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: dark ? "rgba(255,255,255,0.4)" : "#94A3B8",
                }}
              />
            )}
          </View>
        )}

        {/* Severity icon circle */}
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: m.sevMeta.color + "26" }}
        >
          <Text style={{ fontSize: 16, color: m.sevMeta.color }}>
            {dangerous ? "⚠" : isActive ? "▲" : "✓"}
          </Text>
        </View>

        {/* Title + subline */}
        <View className="flex-1 mr-3">
          <Text
            numberOfLines={1}
            className={`text-sm font-inter ${unread ? "font-bold" : "font-medium"} ${
              unread ? darkText : readTitleClass
            }`}
          >
            {alertTitle(m.alert)}
          </Text>
          <Text
            numberOfLines={2}
            className={`text-xs font-inter mt-0.5 ${
              unread ? `font-semibold ${unreadBodyClass}` : readBodyClass
            }`}
          >
            {[
              m.machineCode,
              m.machineType || "",
              m.sensorType
                ? `${m.sensorType}: ${m.alert.value ?? "—"}${m.alert.threshold != null ? ` (threshold: ${m.alert.threshold})` : ""}`
                : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        {/* Right: severity chip + STATUS pill + relative time */}
        <View className="items-end gap-1">
          <SeverityBadge severity={m.alert.severity} />
          <View className="px-1.5 py-0.5 rounded-chip" style={{ backgroundColor: statusTint.bg }}>
            <Text className="text-[9px] font-bold font-inter" style={{ color: statusTint.fg }}>
              {m.statusMeta.label}
            </Text>
          </View>
          <Text className={`text-[10px] font-inter ${darkMuted}`}>{relativeTime(m.alert.timestamp)}</Text>
        </View>

        {/* Live state dot — ONLY on the row matching the sensor's current
            state, so warning → critical moves the dot instead of duplicating
            it. Color comes from the same status palette as the severity chip. */}
        <View className="items-center ml-2" style={{ width: 22 }}>
          {m.dot ? (
            <>
              <View
                accessibilityLabel={`Sensor currently ${m.dot.label}`}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: m.dot.color,
                  shadowColor: m.dot.color,
                  shadowOpacity: 0.7,
                  shadowRadius: 4,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 3,
                }}
              />
              <Text className={`text-[8px] font-inter mt-0.5 ${darkMuted}`}>{m.dot.label}</Text>
            </>
          ) : (
            <View style={{ width: 10, height: 10 }} />
          )}
        </View>

        {/* Row tap opens the detail sheet everywhere — the old ⋮ menu button
            is removed (top bar already owns navigation, sheet owns actions). */}
        {!isDesktop && <Text className={`ml-2 ${darkMuted}`}>›</Text>}
      </Pressable>
    );
  }

  function actionSheet(alert) {
    if (!alert) return null;
    const m = rowModel(alert);
    const editable = alert.status === "ACTIVE";
    const facts = [
      ["Sensor", m.sensorType || "—"],
      ["Value", alert.value ?? "—"],
      ["Threshold", alert.threshold ?? "—"],
      ["Status", m.statusMeta.label],
      ["Live state", m.live.label],
      ["Time", relativeTime(alert.timestamp)],
      ["Machine", m.machineCode],
      ["Type", m.machineType || "—"],
    ];
    return (
      <BottomSheet
        visible
        onClose={() => setSelected(null)}
        maxWidth={560}
        title={alertTitle(alert)}
        subtitle={m.machineCode ? `Machine ${m.machineCode}` : "Sensor alert"}
        footer={
          <View className="flex-row flex-wrap gap-2 justify-end">
            <Button title="Close" variant="ghost" size="sm" onPress={() => setSelected(null)} />
            {canAcknowledge && editable && (
              <Button
                title={ackStatus === "loading" ? "Acknowledging…" : "Acknowledge"}
                variant="outline"
                size="sm"
                onPress={() => handleAcknowledge(alert)}
                loading={ackStatus === "loading"}
              />
            )}
            {canAcknowledge && alert.status !== "RESOLVED" && (
              <Button
                title={ackStatus === "loading" ? "Resolving…" : "Resolve"}
                variant="outline"
                size="sm"
                onPress={() => handleResolve(alert)}
                loading={ackStatus === "loading"}
                disabled={ackStatus === "loading"}
              />
            )}
            {/* Only the responsable industriel creates interventions. */}
            {isResponsable && (
              <Button
                title="+ Create Intervention"
                variant="primary"
                size="sm"
                onPress={() => goToCreateIntervention(alert)}
              />
            )}
          </View>
        }
      >
        {/* Compact severity strip: one line, not a whole block */}
        <View
          className="flex-row items-center gap-2 px-3 py-2 rounded-btn mb-3"
          style={{ backgroundColor: m.sevMeta.color + "14" }}
        >
          <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.sevMeta.color }} />
          <Text className={`text-xs font-bold font-inter ${darkText}`}>
            {m.sevMeta.label}
          </Text>
          <Text className={`text-xs font-inter ${darkMuted}`}>·</Text>
          <Text className={`text-xs font-inter ${darkMuted}`} numberOfLines={1} style={{ flex: 1 }}>
            {alert.status === "RESOLVED" ? "Resolved" : editable ? "Active" : humanize(alert.status)}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: m.live.color,
              }}
            />
            <Text className={`text-[10px] font-inter ${darkMuted}`}>{m.live.label}</Text>
          </View>
        </View>

        {/* Two-column fact grid — half the height of the old stacked list */}
        <View className="flex-row flex-wrap gap-2">
          {facts.map(([k, v]) => (
            <View
              key={k}
              className={`rounded-btn px-3 py-2 ${dark ? "bg-white/5" : "bg-bg"}`}
              style={{ width: "48%" }}
            >
              <Text className={`text-[10px] font-inter ${darkMuted}`}>{k}</Text>
              <Text className={`text-xs font-bold font-inter mt-0.5 ${darkText}`} numberOfLines={1}>
                {v}
              </Text>
            </View>
          ))}
        </View>
      </BottomSheet>
    );
  }

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header — same compact recipe as Notifications: title + small
            actions on ONE row, no description sentence (review). */}
        <View className="mb-4 flex-row items-center justify-between gap-2 flex-wrap">
          <View className="flex-row items-center gap-2">
            <Text className={`text-xl font-bold font-inter ${darkText}`}>Alerts</Text>
            {connected && <View className="w-2 h-2 rounded-full" style={{ backgroundColor: "#16A34A" }} />}
          </View>
          {canAcknowledge &&
            (selecting ? (
              <View className="flex-row gap-2">
                <Button title="Cancel" variant="outline" size="sm" onPress={exitSelecting} />
                <Button
                  title={`Mark as read${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
                  variant="primary"
                  size="sm"
                  loading={sheetBusy}
                  disabled={selectedIds.size === 0}
                  onPress={handleMarkSelectedRead}
                />
              </View>
            ) : (
              <View className="flex-row gap-2">
                <Button
                  title="Select"
                  variant="outline"
                  size="sm"
                  disabled={deduped.length === 0}
                  onPress={() => {
                    setSelected(null); // make sure no detail sheet is open
                    setDetailOpen(false);
                    setSelecting(true);
                  }}
                />
                <Button
                  title={sheetBusy ? "Marking…" : "Mark all as read"}
                  variant="outline"
                  size="sm"
                  loading={sheetBusy}
                  disabled={deduped.length === 0}
                  onPress={handleMarkAllRead}
                />
              </View>
            ))}
        </View>

        {/* Filter chips */}
        <FilterChips
          chips={FILTER_CHIPS.map((c) => ({ ...c, count: counts[c.key] ?? 0 }))}
          active={filter}
          onChange={(key) => {
            dispatch(setFilter(key));
            setPage(0);
          }}
          className="mb-4"
        />

        <Card className="mb-4">
          {loading && (
            <View className="p-3 gap-3">
              {[1, 2, 3].map((i) => (
                <View key={i} className="flex-row items-center gap-3">
                  <Skeleton width={40} height={40} rounded />
                  <View className="flex-1 gap-1">
                    <Skeleton width="60%" height={14} />
                    <Skeleton width="85%" height={10} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {empty && (
            <EmptyState
              icon={
                <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(22,163,74,0.12)" }}>
                  <Text className="text-3xl">✓</Text>
                </View>
              }
              title={error ? "Alerts unavailable" : "No alerts — all good"}
              message={
                error && !connected
                  ? "Could not load the alert history and the live feed is offline. Retry, or check your connection."
                  : error
                    ? "Could not load the alert history — live alerts will still accumulate while the feed is connected."
                    : "Threshold breaches, offline sensors and machine events will show up here automatically."
              }
              action={
                error && !connected ? (
                  <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchAlerts({}))} />
                ) : undefined
              }
            />
          )}

          {!loading && !empty && (
            <View>
              {visibleAlerts.length === 0 ? (
                <EmptyState
                  title={`No ${FILTER_CHIPS.find((c) => c.key === filter)?.label.toLowerCase() || ""} severity alerts`}
                  message="Try another filter."
                />
              ) : (
                pageAlerts.map((alert) =>
                  renderRow(alert, () => {
                    // Selection mode: the whole row toggles the checkbox.
                    if (selecting) {
                      toggleSelectAlert(alert);
                      return;
                    }
                    if (isDesktop) {
                      setSelected(alert); // sheet opens on `selected` (web)
                    } else {
                      setSelected(alert);
                      setDetailOpen(true);
                    }
                  })
                )
              )}
            </View>
          )}

          {/* Prev / "Page X of Y" / Next — hidden automatically on a single
              page. The negative margins cancel the card's p-4 so the bar sits
              edge-to-edge, matching the notifications list card. */}
          {!loading && !empty && visibleAlerts.length > 0 && (
            <PaginationBar
              page={safeAlertPage}
              totalPages={alertPageCount}
              onPageChange={setPage}
              className="-mx-4 -mb-4"
            />
          )}
        </Card>

        {/* Adaptive action/detail sheet — anchored menu substitute (web) or
            tap-to-open bottom sheet (mobile) */}
        {selected && (isDesktop ? !detailOpen : detailOpen) && actionSheet(selected)}
      </ScrollView>
    </AppShell>
  );
}
