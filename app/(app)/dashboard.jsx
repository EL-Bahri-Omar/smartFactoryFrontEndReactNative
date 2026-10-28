// app/(app)/dashboard.jsx
//
// Sprint 7 — Dashboard (US49 / US50 / US51 / US52) for web + mobile.
// Built from docs/prompts/12-dashboard.md + docs/ui/ui-notes.md §2.
//
// Data: dashboardSlice.fetchDashboard fans out over CONFIRMED endpoints —
// machines / alerts summary / newest active alerts / maintenance, plus the
// Sprint 7 DashboardController routes (/overview, /kpis, /kpis/history).
// Those three are ADMIN | RESPONSABLE | TECHNICIAN only, so a role that
// cannot call them still gets a usable page from the derived counts.
//
// OEE was REMOVED from this screen (review: "remove the oee and its
// unavailable status") — the backend declares it UNAVAILABLE by business rule
// and a badge saying so is still noise. In its place: the three real charts
// (Availability Over Time first) with a slim MTBF / MTTR / Downtime / Failures
// card row underneath.
//
// Map: reuses src/components/FactoryMap.jsx with variant="compact" — the
// single source shared with Map & Zones. Zones are grouped client-side from
// the machine rows we already fetched (no extra /zones/:id/machines calls).
//
// The greeting moved to TopBar (review: "move Good afternoon, Admin 👋 to the
// top bar"), which is what freed this much vertical space.
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
import StatusCountCard from "../../src/components/StatusCountCard";
import FactoryMap from "../../src/components/FactoryMap";
import Sparkline from "../../src/components/charts/Sparkline";
import BarChart from "../../src/components/charts/BarChart";
import LineChart from "../../src/components/charts/LineChart";
import ChartLegend from "../../src/components/charts/ChartLegend";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useRole, PERMISSIONS } from "../../src/hooks/useRole";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useLiveTopic } from "../../src/hooks/useLiveTopic";
import { useDialog } from "../../src/components/dialog/DialogContext";
import { fetchDashboard } from "../../src/store/slices/dashboardSlice";
import { useReconnecting } from "../../src/hooks/useReconnecting";
import { fetchZones } from "../../src/store/slices/zoneSlice";
import { setFilters } from "../../src/store/slices/machineSlice";
import { getMachineStatus } from "../../src/lib/status";
import { relativeTime } from "../../src/lib/time";

// FactoryMap lays machines out in four fixed slots; real Mongo zones are
// assigned to them by index (same rule as Map & Zones).
const SLOTS = ["A", "B", "C", "D"];

/** Rounded-up axis maximum so bar charts get human tick labels (10, 25, 60…). */
function niceMax(value) {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return 100;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return steps.map((s) => s * pow).find((c) => c >= v) || v;
}

/** Weekday label for the /kpis/history buckets (Mon, Tue, …). */
function weekdayLabel(ts) {
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { weekday: "short" });
}

export default function DashboardScreen() {
  const dark = useDark();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dialog = useDialog();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const { canAccess, homeRoute, hasPermission } = useRole();

  const canView = canAccess("dashboard");
  const canReadMachines = hasPermission(PERMISSIONS.MACHINE_READ);
  const canReadAlerts = hasPermission(PERMISSIONS.ALERT_READ);
  const canReadMaintenance = hasPermission(PERMISSIONS.MAINTENANCE_READ);
  const canReadZones = hasPermission(PERMISSIONS.ZONE_READ);

  const { data, status, error } = useAppSelector((s) => s.dashboard);
  const { list: zones, status: zoneStatus } = useAppSelector((s) => s.zone);
  // Only a genuine DROP (connected → dropped) shows a badge; the first
  // connect is startup and must not flash "Reconnecting…".
  const reconnecting = useReconnecting();

  // ASSUMED destination — documents itself in liveSlice.messagesByTopic, which
  // is where the "live" state of this screen comes from.
  useLiveTopic("/topic/dashboard", { enabled: canView });

  // Mobile "View Dashboard" CTA scrolls to the Factory Overview block.
  // Declared up here with the other hooks: the early returns below must never
  // sit between two hook calls.
  const scrollRef = useRef(null);
  const [overviewY, setOverviewY] = useState(0);

  const load = useCallback(() => {
    // One parallel fan-out. The Factory Health Score is computed INSIDE this
    // thunk from the fleet + alert rows it already fetches (src/lib/health.js)
    // — the backend health route measured 151–339 s and is never called.
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
  const history = data?.history || [];
  const machineRows = data?.machineRows || [];
  const allMachines = data?.allMachines || [];

  // ── Machine status cards — ONE line (docs/ui/machines_count_cards.png) ────
  // Real counts. `statusCounts` comes from GET /api/dashboard/overview (whole
  // fleet) and falls back to the counted GET /api/machines page.
  // "To be repaired" = FAILURE (broken, nobody on it yet), "Under Repair" =
  // MAINTENANCE (technician on it) — same split as the image. OFFLINE is a
  // connectivity state, NOT a repair job, so it stays out of this tile.
  const mc = data?.statusCounts || null;
  const statusCardCls = isMobile ? "w-[152px]" : "flex-1 min-w-[116px]";
  // Each tile jumps to the Machines screen with its status pre-selected
  // (review: "total machines -> machines page, working -> filter=running").
  // "To be repaired" spans two statuses, so the machines fetch filters those
  // client-side — see fetchMachines in machineSlice.js.
  const goMachines = (status) => () => {
    dispatch(setFilters({ status, search: "", zoneId: null }));
    router.push("/(app)/machines");
  };
  const statusDefs = [
    { key: "total", label: "Total Machines", value: mc ? mc.total : null, icon: "🏭", color: "#0EA5A4", status: null },
    { key: "working", label: "Working", value: mc ? mc.RUNNING : null, icon: "✅", color: "#16A34A", status: "RUNNING" },
    { key: "idle", label: "Idle", value: mc ? mc.IDLE : null, icon: "⏸️", color: "#0EA5E9", status: "IDLE" },
    { key: "repair", label: "Under Repair", value: mc ? mc.MAINTENANCE : null, icon: "🔧", color: "#F59E0B", status: "MAINTENANCE" },
    {
      key: "toberepaired",
      label: "To be repaired",
      value: mc ? mc.FAILURE : null,
      icon: "📖",
      color: "#DC2626",
      status: "FAILURE",
    },
  ];

  const statusCards = statusDefs.map((c) => (
    <StatusCountCard
      key={c.key}
      className={statusCardCls}
      label={c.label}
      value={c.value}
      icon={c.icon}
      color={c.color}
      loading={loading}
      onPress={goMachines(c.status)}
    />
  ));

  // Always a single horizontal line — never a 1/2/1 grid. On narrow screens
  // the line scrolls sideways instead of wrapping.
  const statusRow = isMobile ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-3 pr-4">{statusCards}</View>
    </ScrollView>
  ) : (
    <View className="flex-row gap-3">{statusCards}</View>
  );

  // ── KPI line — Machines Availability · Active Alerts · Factory Health
  // Score, all in ONE line (review: "rename Availability to Machines
  // Availability, and add factory health score card in the same line").
  // Real numbers: availability from /kpis, alerts from /alerts/summary,
  // health computed client-side (src/lib/health.js) — the backend route that
  // did it measured 151–339 s and is no longer called.
  const kpiDefs = [
    {
      key: "availability",
      label: "Machines Availability",
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
      key: "health",
      label: "Factory Health Score",
      // FRONTEND calculation (src/lib/health.js): mean of every machine's
      // score. The backend route for this measured 151–339 s and is not used.
      value: kpis?.healthScore,
      unit: "/100",
      // Circular gauge, red / orange / green by score band (review).
      ring: true,
    },
  ];

  // Every card is a door (review: "let the dashboards cards be clickable and
  // take to the right destination"). The status tiles land on the Machines
  // screen with that status already selected; the KPI line lands on the map
  // (availability), the alerts list and the reports.
  const kpiCards = kpiDefs.map((k) => (
    <KpiCard
      key={k.key}
      label={k.label}
      value={k.value}
      unit={k.unit}
      delta={k.delta}
      icon={k.icon}
      iconBgClass={k.iconBgClass}
      ring={Boolean(k.ring)}
      loading={loading}
      onPress={
        k.key === "availability"
          ? () => router.push("/(app)/map")
          : k.key === "alerts"
            ? () => router.push("/(app)/alerts")
            : k.key === "health"
              ? () => router.push("/(app)/reports")
              : undefined
      }
      // Mobile renders the line inside a horizontal ScrollView, where flex-1
      // has no bounded width to grow into — give it an explicit one.
      className={isMobile ? "w-[176px]" : ""}
    />
  ));

  const reconnectChip = reconnecting ? (
    <View
      className={`self-start flex-row items-center gap-1.5 px-2.5 py-1 rounded-chip border ${
        dark ? "border-white/15 bg-white/5" : "border-border bg-bg"
      }`}
    >
      <View className="w-1.5 h-1.5 rounded-full bg-warning" />
      <Text className={`text-[11px] font-semibold font-inter ${darkMuted}`}>Reconnecting…</Text>
    </View>
  ) : null;

  const kpiRow = (
    <View className="gap-3">
      {statusRow}
      {isMobile ? (
        <View className="gap-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-3 pr-4">{kpiCards}</View>
          </ScrollView>
          {reconnectChip}
        </View>
      ) : (
        <View className="flex-row gap-4 items-start">
          {kpiCards}
          {reconnectChip}
        </View>
      )}
    </View>
  );

  // ── Zone grouping — shared by the "Machines by Zone" chart below and the
  // Factory Overview map. Grouped CLIENT-SIDE from the machine rows we already
  // fetched, so the chart costs no extra request.
  const zonesLoading = zoneStatus === "loading" || (zoneStatus === "idle" && canReadZones);
  const zonesFailed = zoneStatus === "error";
  const slotZones = SLOTS.map((slot, i) => (zones[i] ? { ...zones[i], slot } : null)).filter(Boolean);
  const slotMachines = {};
  slotZones.forEach((z) => {
    // Group the rows we already have — no extra per-zone request on landing.
    slotMachines[z.slot] = allMachines.filter((m) => m?.zoneId === z.id);
  });
  const mapZones = slotZones.map((z) => ({ ...z, id: z.slot, realId: z.id }));

  // ── Charts — Availability Over Time is first (review), then the downtime
  // bars, then the per-zone split. Real series from /kpis/history + the
  // machine rows already on screen; no demo figures exist here.
  const chartEmpty = (text) => (
    <View className="items-center justify-center" style={{ height: 112 }}>
      <Text className={`text-xs font-inter ${darkMuted}`}>{text}</Text>
    </View>
  );

  // Real downtime series from GET /api/dashboard/kpis/history.
  const downtime = history.map((p) => Number(p?.downtimeMinutes) || 0);
  const maxDowntime = downtime.reduce((m, v) => Math.max(m, v), 0);

  // Real per-zone status split, counted from the machine rows on screen.
  // `id` doubles as the ChartLegend key and the status matcher.
  const ZONE_SERIES = [
    { id: "RUNNING", label: "Running", color: "#16A34A" },
    { id: "IDLE", label: "Idle", color: "#0EA5E9" },
    { id: "MAINTENANCE", label: "Maintenance", color: "#F59E0B" },
    { id: "FAILURE", label: "Failure", color: "#DC2626" },
    { id: "OFFLINE", label: "Offline", color: "#64748B" },
  ];
  const zoneChart = slotZones.map((z) => {
    const rows = slotMachines[z.slot] || [];
    return {
      label: z?.name || `Zone ${z.slot}`,
      values: ZONE_SERIES.map((s) =>
        rows.filter((m) => String(m?.status || "").toUpperCase() === s.id).length
      ),
    };
  });
  const zoneTotal = zoneChart.reduce(
    (m, r) => Math.max(m, r.values.reduce((a, b) => a + b, 0)),
    0
  );

  // Real availability series — same buckets as the downtime bars, so cards 1
  // and 3 share the Mon…Sun axis. Points with an unreadable timestamp are
  // dropped: a NaN x would collapse the whole line chart.
  const availabilityPoints = history.filter(
    (p) =>
      p?.availability != null &&
      p?.timestamp &&
      !Number.isNaN(new Date(p.timestamp).getTime())
  );
  const bucketLabels = history.map((p) => (p?.timestamp ? weekdayLabel(p.timestamp) : ""));

  const oeeCards = [
    {
      // FIRST card, per review: "let the Availability Over Time be first".
      key: "availability",
      title: "Availability Over Time",
      icon: "📈",
      legend: [{ id: "availability", label: "Availability %", color: "#22C55E" }],
      body:
        availabilityPoints.length > 1 ? (
          <LineChart
            series={[
              {
                id: "availability",
                color: "#22C55E",
                data: availabilityPoints.map((p) => ({
                  x: new Date(p.timestamp).getTime(),
                  y: p.availability,
                })),
              },
            ]}
            xTickValues={availabilityPoints.map((p) => new Date(p.timestamp).getTime())}
            xTickFormat={weekdayLabel}
            yMin={0}
            yMax={100}
            yTickCount={6}
            height={118}
          />
        ) : (
          chartEmpty("Not enough history yet.")
        ),
    },
    {
      key: "downtime",
      title: "Downtime by Day",
      icon: "📊",
      legend: [{ id: "downtime", label: "Downtime (min)", color: "#F59E0B" }],
      body:
        history.length && maxDowntime > 0 ? (
          <BarChart
            data={history.map((p, i) => ({
              label: bucketLabels[i] || `${i + 1}`,
              values: [Number(p?.downtimeMinutes) || 0],
            }))}
            series={[{ label: "Downtime (min)", color: "#F59E0B" }]}
            yMax={niceMax(maxDowntime)}
            height={112}
            groupWidth={30}
          />
        ) : (
          chartEmpty(history.length ? "No downtime in this period." : "No KPI history yet.")
        ),
    },
    {
      key: "zones",
      title: "Machines by Zone",
      icon: "🏭",
      legend: ZONE_SERIES,
      body: zoneTotal > 0 ? (
        <BarChart
          data={zoneChart}
          series={ZONE_SERIES}
          yMax={Math.max(1, zoneTotal)}
          height={112}
          groupWidth={54}
          stacked
        />
      ) : (
        chartEmpty("No machines grouped by zone yet.")
      ),
    },
  ];

  // MTBF · MTTR · Downtime · Failures — slim cards, all on ONE line, sitting
  // UNDER the charts (review: "keep the chart over them").
  const slimStats = [
    { key: "mtbf", label: "MTBF", value: kpis?.mtbf != null ? `${kpis.mtbf} h` : "—" },
    { key: "mttr", label: "MTTR", value: kpis?.mttr != null ? `${kpis.mttr} min` : "—" },
    {
      key: "down",
      label: "Downtime",
      value: kpis?.downtimeMinutes != null ? `${kpis.downtimeMinutes} min` : "—",
    },
    {
      key: "fail",
      label: "Failures",
      value: kpis?.mtbfFailures != null ? String(kpis.mtbfFailures) : "—",
    },
  ];

  const slimRow = isMobile ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-3 pr-4">
        {slimStats.map((s) => (
          <SlimStat key={s.key} label={s.label} value={s.value} dark={dark} />
        ))}
      </View>
    </ScrollView>
  ) : (
    <View className="flex-row gap-3">
      {slimStats.map((s) => (
        <SlimStat key={s.key} label={s.label} value={s.value} dark={dark} />
      ))}
    </View>
  );

  const chartsBlock = (
    <View className="mt-6">
      {isMobile ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3 pr-4">
            {oeeCards.map((c) => (
              <OeeCard key={c.key} card={c} dark={dark} className="w-[300px]" />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-row gap-4">
          {oeeCards.map((c) => (
            <OeeCard key={c.key} card={c} dark={dark} className="flex-1 min-w-[240px]" />
          ))}
        </View>
      )}
      <View className="mt-3">{slimRow}</View>
    </View>
  );

  // ── Factory Overview ──────────────────────────────────────────────────────
  // idle + a permitted fetch means "still to come" — don't flash an empty map.
  // Zones / slotMachines / mapZones are grouped above (shared with the chart).
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

  // ── Header note ───────────────────────────────────────────────────────────
  // The greeting + date/time block used to live here; it moved to TopBar
  // (review: "move Good afternoon, Admin 👋 to the top bar … so now we have
  // more space in dashboard screen"), so this screen now starts at the cards.

  if (isMobile) {
    return (
      <AppShell>
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        >
          {kpiRow}
          {chartsBlock}

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
        {kpiRow}
        {chartsBlock}

        {/* Factory Overview + Machine Status side by side again (review:
            "i want Machine Status back beside the map overview"). */}
        <View className="flex-row gap-4 mt-6" style={{ alignItems: "stretch" }}>
          <View style={{ flex: 0.6 }}>{factoryOverview}</View>
          <View style={{ flex: 0.4 }}>{machineStatus}</View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

/**
 * Slim MTBF / MTTR / Downtime / Failures card — one line UNDER the charts
 * (review: "let these have slim cards all over the line … keep the chart over
 * them"). Label and value sit on ONE line, side by side, so the row reads
 * like a strip of figures instead of two stacked lines per card.
 */
function SlimStat({ label, value, dark }) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <View className="flex-row items-center justify-between gap-2">
        <Text
          className={`text-[11px] font-inter shrink ${dark ? "text-white/55" : "text-text-muted"}`}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          className={`text-sm font-bold font-inter shrink-0 ${dark ? "text-white" : "text-text"}`}
          numberOfLines={1}
        >
          {value ?? "—"}
        </Text>
      </View>
    </Card>
  );
}

/**
 * OEE.png-style chart card — green square icon · bold title · ⓘ, legend,
 * then the chart. Kept as a module-level component (not declared inside the
 * screen) so React keeps the chart's layout state across re-renders.
 */
function OeeCard({ card, dark, className = "" }) {
  const darkText = dark ? "text-white" : "text-text";
  const darkMuted = dark ? "text-white/50" : "text-text-muted";
  return (
    <Card className={className}>
      <View className="flex-row items-center gap-2 mb-2">
        <View
          className="w-6 h-6 rounded-md items-center justify-center"
          style={{ backgroundColor: "#22C55E26" }}
        >
          <Text className="text-[11px]">{card.icon}</Text>
        </View>
        <Text
          className={`text-[13px] font-bold font-inter flex-1 ${darkText}`}
          numberOfLines={1}
        >
          {card.title}
        </Text>
        <Text className={`text-xs ${darkMuted}`}>ⓘ</Text>
      </View>
      <ChartLegend items={card.legend} className="mb-2" />
      {card.body}
    </Card>
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
