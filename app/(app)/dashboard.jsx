// app/(app)/dashboard.jsx
//
// Sprint 7 — Dashboard (US49 / US50 / US51 / US52) for web + mobile.
// Built from docs/prompts/12-dashboard.md + docs/ui/ui-notes.md §2.
//
// Data: dashboardSlice.fetchDashboard fans out over CONFIRMED endpoints
// (machines / alerts summary / newest active alerts / maintenance) and treats
// GET /api/dashboard/kpis as an OPTIONAL source — that one does not exist on
// the backend yet, so OEE and the delta chips stay empty (an em dash, never a
// fabricated number) until Sprint 7 ships. A 404 there is expected behaviour.
//
// Map: reuses src/components/FactoryMap.jsx with variant="compact" — the
// single source shared with Map & Zones. Zones are grouped client-side from
// the machine rows we already fetched (no extra /zones/:id/machines calls).
//
// Live: `/topic/dashboard` is ASSUMED (recorded in docs/api-contract.md). The
// KPI row shows a "Reconnecting…" chip whenever liveSlice.connected is false.

import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import EmptyState from "../../src/components/EmptyState";
import Skeleton from "../../src/components/Skeleton";
import KpiCard from "../../src/components/KpiCard";
import FactoryMap from "../../src/components/FactoryMap";
import Sparkline from "../../src/components/charts/Sparkline";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useRole, PERMISSIONS } from "../../src/hooks/useRole";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useLiveTopic } from "../../src/hooks/useLiveTopic";
import { useDialog } from "../../src/components/dialog/DialogContext";
import { fetchDashboard } from "../../src/store/slices/dashboardSlice";
import { fetchZones } from "../../src/store/slices/zoneSlice";
import { getMachineStatus } from "../../src/lib/status";
import { relativeTime, formatDate, formatTime } from "../../src/lib/time";

// FactoryMap lays machines out in four fixed slots; real Mongo zones are
// assigned to them by index (same rule as Map & Zones).
const SLOTS = ["A", "B", "C", "D"];

function greetingFor(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const dark = useDark();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dialog = useDialog();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const { canAccess, homeRoute, hasPermission, user } = useRole();

  const canView = canAccess("dashboard");
  const canReadMachines = hasPermission(PERMISSIONS.MACHINE_READ);
  const canReadAlerts = hasPermission(PERMISSIONS.ALERT_READ);
  const canReadMaintenance = hasPermission(PERMISSIONS.MAINTENANCE_READ);
  const canReadZones = hasPermission(PERMISSIONS.ZONE_READ);

  const { data, status, error } = useAppSelector((s) => s.dashboard);
  const { list: zones, status: zoneStatus } = useAppSelector((s) => s.zone);
  const liveConnected = useAppSelector((s) => s.live.connected);

  // ASSUMED destination — documents itself in liveSlice.messagesByTopic, which
  // is where the "live" state of this screen comes from.
  useLiveTopic("/topic/dashboard", { enabled: canView });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Mobile "View Dashboard" CTA scrolls to the Factory Overview block.
  // Declared up here with the other hooks: the early returns below must never
  // sit between two hook calls.
  const scrollRef = useRef(null);
  const [overviewY, setOverviewY] = useState(0);

  const load = useCallback(() => {
    dispatch(
      fetchDashboard({
        machines: canReadMachines,
        alerts: canReadAlerts,
        interventions: canReadMaintenance,
      })
    );
    if (canReadZones) dispatch(fetchZones());
  }, [dispatch, canReadMachines, canReadAlerts, canReadMaintenance, canReadZones]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  const darkText = dark ? "text-white" : "text-text";
  const darkMuted = dark ? "text-white/60" : "text-text-muted";

  if (!canView) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            icon={<Text className="text-3xl">🔒</Text>}
            title="Access restricted"
            message="Your role does not include the dashboard."
          />
          <Button
            title={`Go to ${homeRoute.replace("/(app)/", "")}`}
            variant="outline"
            size="sm"
            onPress={() => router.replace(homeRoute)}
          />
        </Card>
      </AppShell>
    );
  }

  const loading = (status === "loading" || status === "idle") && !data;
  const loadFailed = status === "error" && !data;
  const kpis = data?.kpis || null;
  const machineRows = data?.machineRows || [];
  const allMachines = data?.allMachines || [];
  const firstName = user?.firstName || "there";

  // ── KPI row ───────────────────────────────────────────────────────────────
  // Values come from the ASSUMED /api/dashboard/kpis when it exists, otherwise
  // from counts derived in dashboardSlice. `null` renders "—".
  const kpiDefs = [
    {
      key: "machines",
      label: "Total Machines",
      value: kpis?.totalMachines,
      delta: kpis?.deltas?.totalMachines,
      icon: "🏭",
      iconBgClass: "bg-primary/10",
    },
    {
      key: "availability",
      label: "Availability",
      value: kpis?.availability,
      unit: "%",
      delta: kpis?.deltas?.availability,
      icon: "⚡",
      iconBgClass: "bg-primary-soft",
    },
    {
      key: "alerts",
      label: "Active Alerts",
      value: kpis?.activeAlerts,
      delta: kpis?.deltas?.activeAlerts,
      icon: "🚨",
      iconBgClass: "bg-warning/10",
    },
    {
      key: "oee",
      label: "OEE",
      value: kpis?.oee,
      unit: "%",
      delta: kpis?.deltas?.oee,
      icon: "📈",
      iconBgClass: "bg-[#7C3AED]/10",
    },
  ];

  const kpiCards = kpiDefs.map((k) => (
    <KpiCard
      key={k.key}
      label={k.label}
      value={k.value}
      unit={k.unit}
      delta={k.delta}
      icon={k.icon}
      iconBgClass={k.iconBgClass}
      loading={loading}
    />
  ));

  const reconnectChip = !liveConnected ? (
    <View
      className={`self-start flex-row items-center gap-1.5 px-2.5 py-1 rounded-chip border ${
        dark ? "border-white/15 bg-white/5" : "border-border bg-bg"
      }`}
    >
      <View className="w-1.5 h-1.5 rounded-full bg-warning" />
      <Text className={`text-[11px] font-semibold font-inter ${darkMuted}`}>Reconnecting…</Text>
    </View>
  ) : null;

  // Two rows of two on mobile, one row of four from tablet up.
  const kpiRow = isMobile ? (
    <View className="gap-3">
      <View className="flex-row gap-3">{kpiCards.slice(0, 2)}</View>
      <View className="flex-row gap-3">{kpiCards.slice(2, 4)}</View>
      {reconnectChip}
    </View>
  ) : (
    <View className="gap-4">
      <View className="flex-row gap-4">{kpiCards}</View>
      {reconnectChip}
    </View>
  );

  // ── Factory Overview ──────────────────────────────────────────────────────
  // idle + a permitted fetch means "still to come" — don't flash an empty map.
  const zonesLoading = zoneStatus === "loading" || (zoneStatus === "idle" && canReadZones);
  const zonesFailed = zoneStatus === "error";
  const slotZones = SLOTS.map((slot, i) => (zones[i] ? { ...zones[i], slot } : null)).filter(Boolean);
  const slotMachines = {};
  slotZones.forEach((z) => {
    // Group the rows we already have — no extra per-zone request on landing.
    slotMachines[z.slot] = allMachines.filter((m) => m?.zoneId === z.id);
  });
  const mapZones = slotZones.map((z) => ({ ...z, id: z.slot, realId: z.id }));

  const factoryOverview = (
    <Card>
      <View className="flex-row items-center justify-between mb-3">
        <Text className={`text-base font-bold font-inter ${darkText}`}>Factory Overview</Text>
        <Button
          title="Open map"
          variant="ghost"
          size="sm"
          onPress={() => router.push("/(app)/map")}
        />
      </View>

      {zonesLoading ? (
        <Skeleton height={220} className="rounded-card" />
      ) : zonesFailed ? (
        <EmptyState
          icon={<Text className="text-3xl">🗺️</Text>}
          title="Zones unavailable"
          message="The factory layout could not be loaded."
          action={
            <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchZones())} />
          }
        />
      ) : !mapZones.length ? (
        <EmptyState
          icon={<Text className="text-3xl">🗺️</Text>}
          title="No zones yet"
          message="Zones appear here as soon as they are created."
        />
      ) : (
        <FactoryMap variant="compact" zones={mapZones} machinesByZone={slotMachines} />
      )}
    </Card>
  );

  // ── Machine Status list ───────────────────────────────────────────────────
  function StatusBadge({ status: raw }) {
    const s = getMachineStatus(raw);
    return (
      <View
        className="flex-row items-center gap-1 px-2 py-0.5 rounded-chip"
        style={{ backgroundColor: `${s.color}1F` }}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.color }} />
        <Text style={{ color: s.color }} className="text-[10px] font-bold font-inter">
          {s.label}
        </Text>
      </View>
    );
  }

  const machineStatus = (
    <Card>
      <View className="flex-row items-center justify-between mb-2">
        <Text className={`text-base font-bold font-inter ${darkText}`}>Machine Status</Text>
        {data?.machines ? (
          <Text className={`text-xs font-inter ${darkMuted}`}>
            {machineRows.length} / {data.machines.total}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <View className="gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={34} className="rounded-btn" />
          ))}
        </View>
      ) : !data?.machines ? (
        <EmptyState
          icon={<Text className="text-3xl">🏭</Text>}
          title="Machines unavailable"
          message={
            data?.failed?.machines
              ? "The machine list could not be read for your role."
              : "No machines to show yet."
          }
          action={
            <Button title="Retry" variant="outline" size="sm" onPress={load} />
          }
        />
      ) : !machineRows.length ? (
        <EmptyState
          icon={<Text className="text-3xl">🏭</Text>}
          title="No machines yet"
          message="Create a machine to see its status here."
        />
      ) : (
        <View>
          {machineRows.map((m, idx) => {
            const lastSeen = m?.lastSeen || m?.updatedAt || m?.createdAt;
            return (
              <View
                key={m?.id || m?.code || idx}
                className={`flex-row items-center py-2.5 ${
                  idx === machineRows.length - 1
                    ? ""
                    : dark
                      ? "border-b border-white/5"
                      : "border-b border-border/70"
                }`}
              >
                <Pressable
                  className="flex-1 mr-2"
                  onPress={() => {
                    if (m?.id) router.push(`/(app)/machines/${m.id}`);
                  }}
                >
                  <Text className={`text-sm font-bold font-inter ${darkText}`} numberOfLines={1}>
                    {m?.code || m?.name || "—"}
                  </Text>
                  <Text className={`text-[11px] font-inter ${darkMuted}`} numberOfLines={1}>
                    {m?.type || m?.name || "Machine"}
                  </Text>
                </Pressable>

                {/* Trend is rendered only when the backend sends points —
                    an empty sparkline would be invented data. */}
                <Sparkline
                  points={m?.spark || m?.trend || []}
                  width={56}
                  height={22}
                  color={getMachineStatus(m?.status).color}
                />

                <View className="items-end ml-2" style={{ minWidth: 96 }}>
                  <StatusBadge status={m?.status} />
                  <Text className={`text-[10px] font-inter mt-0.5 ${darkMuted}`} numberOfLines={1}>
                    {lastSeen ? `Updated ${relativeTime(lastSeen)}` : "No update yet"}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );

  // ── Mobile quick actions ──────────────────────────────────────────────────
  async function scanQr() {
    await dialog.alert(
      "Scan QR",
      "QR scanning isn't implemented yet. The machine list is the fastest way to find a machine."
    );
    router.push("/(app)/machines");
  }

  function goTo(path, allowed) {
    if (!allowed) {
      dialog.alert("Not available", "Your role does not have access to this screen.");
      return;
    }
    router.push(path);
  }

  const quickActions = [
    { key: "qr", icon: "📷", label: "Scan QR", onPress: scanQr },
    {
      key: "alerts",
      icon: "🚨",
      label: "View Alerts",
      onPress: () => goTo("/(app)/alerts", canReadAlerts),
    },
    {
      key: "maintenance",
      icon: "🔧",
      label: "Maintenance",
      onPress: () => goTo("/(app)/maintenance", canReadMaintenance),
    },
    { key: "reports", icon: "📄", label: "Reports", onPress: () => router.push("/(app)/reports") },
  ];

  function scrollToOverview() {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, overviewY - 72), animated: true });
    }
  }

  const quickActionGrid = (
    <View className="gap-3">
      <View className="flex-row gap-3">
        {quickActions.slice(0, 2).map((a) => (
          <QuickAction key={a.key} icon={a.icon} label={a.label} onPress={a.onPress} dark={dark} />
        ))}
      </View>
      <View className="flex-row gap-3">
        {quickActions.slice(2, 4).map((a) => (
          <QuickAction key={a.key} icon={a.icon} label={a.label} onPress={a.onPress} dark={dark} />
        ))}
      </View>
    </View>
  );

  // ── Error / retry ─────────────────────────────────────────────────────────
  if (loadFailed) {
    return (
      <AppShell>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Card>
            <EmptyState
              icon={<Text className="text-3xl">⚠️</Text>}
              title="Dashboard unavailable"
              message={error?.message || "Could not load the dashboard."}
              action={<Button title="Retry" variant="outline" size="sm" onPress={load} />}
            />
          </Card>
        </ScrollView>
      </AppShell>
    );
  }

  // ── Header (shared by both layouts) ──────────────────────────────────────
  const header = (
    <View className={`mb-5 ${isMobile ? "" : "flex-row items-start justify-between"}`}>
      <View className="flex-1">
        <Text className={`font-bold font-inter text-[28px] leading-9 ${darkText}`}>
          {greetingFor(now.getHours())}, {firstName} 👋
        </Text>
        <Text className={`text-sm font-inter mt-1 ${darkMuted}`}>
          Here's what's happening in your factory today.
        </Text>
      </View>
      <View className={isMobile ? "mt-2 flex-row items-center gap-3" : "items-end ml-4"}>
        <Text className={`text-sm font-inter ${darkMuted}`}>{formatDate(now)}</Text>
        <Text className={`text-sm font-bold font-inter ${darkText}`}>{formatTime(now)}</Text>
      </View>
    </View>
  );

  if (isMobile) {
    return (
      <AppShell>
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          {header}
          {kpiRow}

          <View className="mt-6 gap-4">
            <View>
              <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>Quick Actions</Text>
              {quickActionGrid}
            </View>

            <Button title="View Dashboard" onPress={scrollToOverview} />

            <View onLayout={(e) => setOverviewY(e.nativeEvent.layout.y)}>
              {factoryOverview}
            </View>

            {machineStatus}
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  // ── Web / tablet layout ───────────────────────────────────────────────────
  return (
    <AppShell>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      >
        {header}
        {kpiRow}

        {/* Row 2 — ~60 / 40 */}
        <View className="flex-row gap-4 mt-6" style={{ alignItems: "stretch" }}>
          <View style={{ flex: 0.6 }}>{factoryOverview}</View>
          <View style={{ flex: 0.4 }}>{machineStatus}</View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

/** 2×2 quick-action tile (mobile only). */
function QuickAction({ icon, label, onPress, dark }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={`flex-1 items-center justify-center py-4 rounded-card border ${
        dark ? "border-white/10 bg-white/5" : "border-border bg-surface"
      } ${pressed ? "opacity-70" : ""}`}
    >
      <Text className="text-2xl mb-1.5">{icon}</Text>
      <Text className={`text-xs font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
