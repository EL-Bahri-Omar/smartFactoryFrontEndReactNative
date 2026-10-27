// app/(app)/reports.jsx
//
// Sprint 7 — Reports (docs/prompts/13-reports.md + docs/ui/ui-notes.md §9),
// web + mobile.
//
// Data: reportSlice → reportService → ASSUMED endpoints
//   GET  /api/reports/downtime?from=&to=
//   GET  /api/reports/performance?range=
//   POST /api/reports/generate
// None of them exist on the backend yet (verified: no Report* controller), so
// a 404 is EXPECTED and renders the empty state ("No data for this range"),
// not a bug. Real errors (5xx / network) show a retry banner.
//
// Charts: src/components/charts/DonutChart.jsx + BarChart.jsx (react-native-svg,
// built for this screen) and HealthGauge.jsx (reused from prompt 08).
//
// Export: builds a CSV of whatever is on screen — client-side, no endpoint.

import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Platform, Share, Pressable } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import EmptyState from "../../src/components/EmptyState";
import Skeleton from "../../src/components/Skeleton";
import MetricCard from "../../src/components/MetricCard";
import Tabs from "../../src/components/Tabs";
import DateTimeInput from "../../src/components/DateTimeInput";
import DonutChart from "../../src/components/charts/DonutChart";
import BarChart from "../../src/components/charts/BarChart";
import HealthGauge, { healthLabel } from "../../src/components/charts/HealthGauge";
import { useDark } from "../../src/hooks/useDark";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useRole } from "../../src/hooks/useRole";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import {
  fetchDowntime,
  fetchPerformance,
  generateReport,
  setTab,
  setRange,
  RANGES,
} from "../../src/store/slices/reportSlice";

const TABS = [
  { key: "maintenance", label: "Maintenance" },
  { key: "performance", label: "Performance" },
  { key: "production", label: "Production" },
  { key: "custom", label: "Custom" },
];

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csvRow = (cells) => cells.map(csvCell).join(",");

export default function ReportsScreen() {
  const dark = useDark();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const { canAccess, homeRoute } = useRole();

  const {
    downtime,
    performance: perf,
    range,
    tab,
    status,
    perfStatus,
    error,
    perfError,
    downtimeAvailable,
    performanceAvailable,
    generating,
    generateError,
    generated,
  } = useAppSelector((s) => s.report);

  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // All hooks live above every early return (Rules of Hooks).
  useEffect(() => {
    if (canAccess("reports")) dispatch(fetchDowntime({}));
  }, [dispatch, canAccess]);

  useEffect(() => {
    if (canAccess("reports")) dispatch(fetchPerformance({ range }));
  }, [dispatch, range, canAccess]);

  const darkText = dark ? "text-white" : "text-text";
  const darkMuted = dark ? "text-white/60" : "text-text-muted";

  const loadingMetrics = (status === "loading" || status === "idle") && !downtime;
  const loadingPerf = (perfStatus === "loading" || perfStatus === "idle") && !perf;

  /** CSV export of what is currently on screen (no backend needed). */
  async function handleExport() {
    const rows = [];
    rows.push(csvRow(["Metric", "Value", "Delta %"]));
    rows.push(csvRow(["Total Downtime (h)", downtime?.totalHours, downtime?.deltaPercent]));
    rows.push(csvRow(["Maintenance Count", downtime?.maintenanceCount, downtime?.maintenanceDeltaPercent]));
    rows.push(csvRow(["Avg Health Score", downtime?.avgHealthScore, downtime?.healthDeltaPercent]));
    rows.push("");
    rows.push(csvRow(["Machine", "Downtime (h)"]));
    (downtime?.byMachine || []).forEach((d) => rows.push(csvRow([d.label, d.value])));
    rows.push("");
    rows.push(csvRow(["Machine", ...(perf?.series || []).map((s) => s.label)]));
    (perf?.data || []).forEach((r) =>
      rows.push(csvRow([r.label, ...(r.values || []).map((v) => (v == null ? "" : v))]))
    );

    const csv = rows.join("\n");

    if (Platform.OS === "web") {
      try {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `smartfactory-report-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // falls through — the share sheet below is the mobile path
      }
      return;
    }

    try {
      await Share.share({ title: "SmartFactory report", message: csv });
    } catch {
      // user dismissed the sheet — nothing to do
    }
  }

  async function handleGenerate() {
    await dispatch(generateReport({ tab, range, from: customFrom || undefined, to: customTo || undefined, format: "CSV" }));
  }

  if (!canAccess("reports")) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            icon={<Text className="text-3xl">🔒</Text>}
            title="Access restricted"
            message="Reports are available to the Responsable Industriel and Admin roles."
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

  // ── Row 1: three metric cards ─────────────────────────────────────────────
  const metricDefs = [
    {
      label: "Total Downtime",
      value: downtime?.totalHours,
      unit: "h",
      delta: downtime?.deltaPercent,
      icon: "⏱️",
      iconBgClass: "bg-primary/10",
    },
    {
      label: "Maintenance Count",
      value: downtime?.maintenanceCount,
      delta: downtime?.maintenanceDeltaPercent,
      icon: "🔧",
      iconBgClass: "bg-warning/10",
    },
    {
      label: "Avg. Health Score",
      value: downtime?.avgHealthScore,
      delta: downtime?.healthDeltaPercent,
      icon: "❤️",
      iconBgClass: "bg-success/10",
    },
  ];

  const metricCard = (m) => (
    <MetricCard
      key={m.label}
      label={m.label}
      value={m.value ?? "—"}
      unit={m.value != null ? m.unit : null}
      delta={m.delta}
      icon={m.icon}
      iconBgClass={m.iconBgClass}
    />
  );

  const metricsRow = loadingMetrics ? (
    <View className={`gap-4 ${isMobile ? "" : "flex-row"}`}>
      {metricDefs.map((m) => (
        <View key={m.label} className={isMobile ? "" : "flex-1"}>
          <Card>
            <Skeleton width="60%" height={12} className="mb-3" />
            <Skeleton width="45%" height={26} className="mb-3" />
            <Skeleton width={72} height={20} rounded />
          </Card>
        </View>
      ))}
    </View>
  ) : isMobile ? (
    <View className="gap-3">
      {metricDefs.map((m) => (
        <View key={m.label} className="flex-row">
          {metricCard(m)}
        </View>
      ))}
    </View>
  ) : (
    <View className="flex-row gap-4">{metricDefs.map(metricCard)}</View>
  );

  // ── Row 2: donut + grouped bar ────────────────────────────────────────────
  const downtimeCard = (
    <Card>
      <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>Downtime by Machine</Text>
      <DonutChart
        data={downtime?.byMachine || []}
        size={168}
        thickness={24}
        centerValue={downtime?.totalHours != null ? `${downtime.totalHours} h` : null}
        centerLabel={downtime?.totalHours != null ? "total downtime" : null}
        emptyMessage={
          status === "error"
            ? "Could not load downtime"
            : downtimeAvailable
              ? "No downtime recorded for this range"
              : "No data for this range"
        }
      />
      {status === "error" ? (
        <View className="items-center mt-3">
          <Button
            title="Retry"
            variant="outline"
            size="sm"
            onPress={() => dispatch(fetchDowntime({ from: customFrom || undefined, to: customTo || undefined }))}
          />
        </View>
      ) : null}
    </Card>
  );

  const performanceCard = (
    <Card>
      <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>Machine Performance</Text>
      <Tabs tabs={RANGES} active={range} onChange={(k) => dispatch(setRange(k))} scrollable={isMobile} />
      <View className="mt-3">
        {loadingPerf ? (
          <Skeleton height={200} className="rounded-card" />
        ) : (
          <BarChart
            data={perf?.data || []}
            series={perf?.series || []}
            yMax={100}
            height={200}
            emptyMessage={
              perfStatus === "error"
                ? "Could not load performance"
                : performanceAvailable
                  ? "No data for this range"
                  : "No data for this range"
            }
          />
        )}
      </View>
      {perfStatus === "error" ? (
        <View className="items-center mt-3">
          <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchPerformance({ range }))} />
        </View>
      ) : null}
    </Card>
  );

  const healthCard = (
    <Card>
      <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>Health Score</Text>
      <View className="items-center">
        <HealthGauge value={downtime?.avgHealthScore ?? null} size={140} />
        <Text className={`text-sm font-inter mt-2 ${darkMuted}`}>
          {healthLabel(downtime?.avgHealthScore ?? null)}
        </Text>
      </View>
    </Card>
  );

  const customCard = tab === "custom" ? (
    <Card>
      <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>Custom range</Text>
      <View className={`gap-3 ${isMobile ? "" : "flex-row"}`}>
        <View className={isMobile ? "" : "flex-1"}>
          <DateTimeInput value={customFrom} onChange={setCustomFrom} placeholder="Select start date..." />
        </View>
        <View className={isMobile ? "" : "flex-1"}>
          <DateTimeInput value={customTo} onChange={setCustomTo} placeholder="Select end date..." />
        </View>
        <Button
          title="Apply"
          size="sm"
          onPress={() => dispatch(fetchDowntime({ from: customFrom || undefined, to: customTo || undefined }))}
        />
      </View>
    </Card>
  ) : null;

  const productionCard = tab === "production" ? (
    <Card>
      <EmptyState
        icon={<Text className="text-3xl">📦</Text>}
        title="No data for this range"
        message="Production figures need a /api/reports/production endpoint — it isn't on the backend yet."
      />
    </Card>
  ) : null;

  const showCharts = tab !== "production";

  const errorBanner =
    status === "error" && error ? (
      <Card className="border border-danger/40">
        <Text className={`text-sm font-bold font-inter ${darkText}`}>Reports unavailable</Text>
        <Text className={`text-sm font-inter mt-1 ${darkMuted}`}>{error.message}</Text>
        <View className="mt-3">
          <Button
            title="Retry"
            variant="outline"
            size="sm"
            onPress={() => dispatch(fetchDowntime({ from: customFrom || undefined, to: customTo || undefined }))}
          />
        </View>
      </Card>
    ) : null;

  const generateNote = generateError ? (
    <Text className={`text-xs font-inter text-center mt-2 ${dark ? "text-white/60" : "text-text-muted"}`}>
      {generateError.message}
    </Text>
  ) : generated ? (
    <Text className="text-xs font-inter text-center mt-2 text-success">
      {generated?.message || "Report generated."}
    </Text>
  ) : null;

  const generateBlock = (
    <View className={isMobile ? "" : "items-center"}>
      <Button title="Generate Report" onPress={handleGenerate} loading={generating} className={isMobile ? "w-full" : ""} />
      {generateNote}
    </View>
  );

  const header = (
    <View className={`mb-4 ${isMobile ? "flex-row items-center gap-2" : "flex-row items-center justify-between"}`}>
      {isMobile ? (
        <Pressable onPress={() => router.back()} className="pr-2 py-1">
          <Text className={`text-xl font-bold ${darkText}`}>←</Text>
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text className={`text-2xl font-bold font-inter ${darkText}`}>Reports</Text>
        {!isMobile ? (
          <Text className={`text-sm font-inter mt-1 ${darkMuted}`}>
            Downtime, performance and exportable summaries.
          </Text>
        ) : null}
      </View>
      <Button
        title={isMobile ? "⤓" : "Export"}
        variant="outline"
        size="sm"
        onPress={handleExport}
        className={isMobile ? "px-3" : ""}
      />
    </View>
  );

  const tabsRow = (
    <Tabs tabs={TABS} active={tab} onChange={(k) => dispatch(setTab(k))} scrollable={isMobile} />
  );

  const body = (
    <>
      {errorBanner}
      {customCard}
      {showCharts ? metricsRow : null}
      {productionCard}

      {showCharts ? (
        tab === "performance" ? (
          <View className={`gap-4 mt-4 ${isMobile ? "" : "flex-row"}`}>
            <View className={isMobile ? "" : "flex-[0.4]"}>{healthCard}</View>
            <View className={isMobile ? "" : "flex-[0.6]"}>{performanceCard}</View>
          </View>
        ) : (
          <View className={`gap-4 mt-4 ${isMobile ? "" : "flex-row"}`}>
            <View className={isMobile ? "" : "flex-1"}>{downtimeCard}</View>
            <View className={isMobile ? "" : "flex-1"}>{performanceCard}</View>
          </View>
        )
      ) : null}
    </>
  );

  // ── Mobile: header back arrow, chips, sticky Generate button ─────────────
  if (isMobile) {
    return (
      <AppShell>
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          >
            {header}
            {tabsRow}
            <View className="mt-4 gap-4">{body}</View>
          </ScrollView>

          <View
            className={`border-t px-4 py-3 ${dark ? "border-white/10 bg-[#0B1D3A]" : "border-border bg-surface"}`}
          >
            {generateBlock}
          </View>
        </View>
      </AppShell>
    );
  }

  // ── Web: title + Export, tabs, rows, Generate Report at the bottom ───────
  return (
    <AppShell>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      >
        {header}
        {tabsRow}
        <View className="mt-5 gap-4">{body}</View>
        <View className="mt-6">{generateBlock}</View>
      </ScrollView>
    </AppShell>
  );
}
