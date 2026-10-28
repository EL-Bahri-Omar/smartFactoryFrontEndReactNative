// app/(app)/reports.jsx
//
// Sprint 7 — Reports (docs/prompts/13-reports.md + docs/ui/ui-notes.md §9),
// web + mobile.
//
// Rewritten: the screen used to call ASSUMED `/api/reports/*` routes that do
// not exist on the backend (no Report* controller), so every request 404'd
// and the page sat on "No data for this range" forever. It is now fed by
// reportSlice.fetchReport, which fans out over CONFIRMED endpoints in
// parallel:
//
//   GET /api/maintenance                  → downtime hours, counts, by type
//   GET /api/alerts                       → alerts by severity in the window
//   GET /api/machines                     → fleet donut (machines by status)
//   GET /api/dashboard/health-scores      → avg health + per-machine scores
//
// The range selector is a CLIENT-SIDE window over createdAt/timestamp, and the
// previous equal-length window supplies the delta chips.
//
// Charts: src/components/charts/DonutChart.jsx + BarChart.jsx (react-native-svg)
// and HealthGauge.jsx. Export builds a CSV client-side — no endpoint.

import { useCallback, useEffect } from "react";
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
import { INTERVENTION_TYPE_LABELS } from "../../src/lib/status";
import {
  fetchReport,
  setTab,
  setRange,
  setCustom,
  RANGES,
} from "../../src/store/slices/reportSlice";

const TABS = [
  { key: "maintenance", label: "Maintenance" },
  { key: "performance", label: "Performance" },
  { key: "fleet", label: "Fleet" },
  { key: "custom", label: "Custom" },
];

const TYPE_SERIES = [{ key: "count", label: "Interventions", color: "#3B82F6" }];
const SEVERITY_SERIES = [{ key: "count", label: "Alerts", color: "#F59E0B" }];

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csvRow = (cells) => cells.map(csvCell).join(",");

export default function ReportsScreen() {
  const dark = useDark();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === "mobile";
  const { canAccess, homeRoute } = useRole();

  const { report, range, tab, customFrom, customTo, status, error } =
    useAppSelector((s) => s.report);

  // Single phase: maintenance + alerts + machines (15–33 ms) with the health
  // score computed inside the thunk from those same rows (src/lib/health.js).
  // GET /api/dashboard/health-scores measured 151–339 s and is never called.
  const run = useCallback((args) => dispatch(fetchReport(args)), [dispatch]);

  // All hooks live above every early return (Rules of Hooks).
  // Key the effect on the BOOLEAN, not the function: `canAccess` is memoised
  // on `user`, so the session refresh that lands right after mount swaps the
  // function identity and used to fire this fetch a SECOND time.
  const canView = canAccess("reports");
  useEffect(() => {
    if (canView) run({ range });
  }, [run, range, canView]);

  const darkText = dark ? "text-white" : "text-text";
  const darkMuted = dark ? "text-white/60" : "text-text-muted";

  const loading = (status === "loading" || status === "idle") && !report;
  const m = report?.metrics || {};
  const partial = report?.partial || {};

  const retry = () => run({ range });

  /** CSV export of what is currently on screen (no backend needed). */
  async function handleExport() {
    const rows = [];
    rows.push(csvRow(["Report", `SmartFactory — ${tab}`]));
    rows.push(csvRow(["Range", report?.start ? `${report.start} .. ${report.end}` : range]));
    rows.push("");
    rows.push(csvRow(["Metric", "Value", "Delta %"]));
    rows.push(csvRow(["Total Downtime (h)", m.downtimeHours, m.downtimeDelta]));
    rows.push(csvRow(["Maintenance Count", m.maintenanceCount, m.maintenanceDelta]));
    rows.push(csvRow(["Avg Health Score", m.avgHealthScore, m.healthDelta]));
    rows.push("");
    rows.push(csvRow(["Machine", "Downtime (h)"]));
    (report?.byMachine || []).forEach((d) => rows.push(csvRow([d.label, d.value])));
    rows.push("");
    rows.push(csvRow(["Machine", "Health score"]));
    (report?.performance?.data || []).forEach((r) => rows.push(csvRow([r.label, r.values?.[0]])));
    rows.push("");
    rows.push(csvRow(["Machine status", "Machines"]));
    (report?.byStatus || []).forEach((d) => rows.push(csvRow([d.label, d.value])));
    rows.push("");
    rows.push(csvRow(["Alert severity", "Alerts"]));
    (report?.bySeverity || []).forEach((d) => rows.push(csvRow([d.label, d.value])));

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
        return "Report downloaded as CSV.";
      } catch {
        // falls through — the share sheet below is the mobile path
      }
    }

    try {
      await Share.share({ title: "SmartFactory report", message: csv });
      return "Report ready to share.";
    } catch {
      return null; // user dismissed the sheet
    }
  }

  // One export only (review: "Export and Generate do the same job, keep only
  // the Export on the top"). POST /api/reports/generate was never implemented
  // and the client-side CSV is the same file either way — handleExport above
  // is the single path.

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
      value: m.downtimeHours ?? null,
      unit: "h",
      delta: m.downtimeDelta ?? null,
      icon: "⏱️",
      iconBgClass: "bg-primary/10",
    },
    {
      label: "Maintenance Count",
      value: m.maintenanceCount ?? null,
      delta: m.maintenanceDelta ?? null,
      icon: "🔧",
      iconBgClass: "bg-warning/10",
    },
    {
      // "/100" is the score SCALE (review: the gauge never says the
      // denominator). MetricCard renders `unit` as light muted text beside the
      // big number — same slot that gives Total Downtime its "h".
      label: "Avg. Health Score",
      value: m.avgHealthScore ?? null,
      unit: "/100",
      delta: m.healthDelta ?? null,
      icon: "❤️",
      iconBgClass: "bg-success/10",
    },
  ];

  const metricCard = (def) => (
    <MetricCard
      key={def.label}
      label={def.label}
      value={def.value ?? "—"}
      unit={def.value != null ? def.unit : null}
      delta={def.delta}
      icon={def.icon}
      iconBgClass={def.iconBgClass}
    />
  );

  const metricsRow = loading ? (
    <View className={`gap-4 ${isMobile ? "" : "flex-row"}`}>
      {metricDefs.map((def) => (
        <View key={def.label} className={isMobile ? "" : "flex-1"}>
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
      {metricDefs.map((def) => (
        <View key={def.label} className="flex-row">
          {metricCard(def)}
        </View>
      ))}
    </View>
  ) : (
    <View className="flex-row gap-4">{metricDefs.map(metricCard)}</View>
  );

  // ── Tab bodies, all fed by the same real report object ────────────────────
  const downtimeCard = (
    <Card>
      <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>Downtime by Machine</Text>
      <DonutChart
        data={report?.byMachine || []}
        size={168}
        thickness={24}
        centerValue={m.downtimeHours != null ? `${m.downtimeHours} h` : null}
        centerLabel={m.downtimeHours != null ? "total downtime" : null}
        emptyMessage={
          status === "error"
            ? "Could not load downtime"
            : "No corrective downtime recorded for this range"
        }
      />
    </Card>
  );

  const typeCard = (
    <Card>
      <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>
        Interventions by Type
      </Text>
      <BarChart
        data={(report?.byType || []).map((d) => ({
          label: INTERVENTION_TYPE_LABELS[d.label] || d.label,
          values: [d.value],
        }))}
        series={TYPE_SERIES}
        yMax={0}
        height={200}
        emptyMessage="No interventions in this range"
      />
    </Card>
  );

  const healthCard = (
    <Card>
      <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>Health Score</Text>
      <View className="items-center">
        <HealthGauge value={m.avgHealthScore ?? null} size={140} />
        {/* Explicit scale indicator (review: "let health score in reports page
            have an indicator that the score scale is on 100") — the gauge alone
            never says what the denominator is. */}
        <View className="flex-row items-baseline gap-1 mt-2">
          <Text className={`text-2xl font-bold font-inter ${darkText}`}>
            {m.avgHealthScore == null ? "—" : Math.round(m.avgHealthScore)}
          </Text>
          <Text className={`text-sm font-inter ${darkMuted}`}>/ 100</Text>
        </View>
        <Text className={`text-sm font-inter mt-1 ${darkMuted}`}>
          {healthLabel(m.avgHealthScore ?? null)}
        </Text>
        <Text className={`text-xs font-inter mt-1 ${darkMuted}`}>
          {report?.totalMachines != null ? `${report.totalMachines} machines in the average` : ""}
        </Text>
      </View>
    </Card>
  );

  const performanceCard = (
    <Card>
      <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>
        Machine Health Score
      </Text>
      <BarChart
        data={report?.performance?.data || []}
        series={report?.performance?.series || []}
        yMax={100}
        height={200}
        emptyMessage="No machine health scores yet"
      />
    </Card>
  );

  const statusCard = (
    <Card>
      <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>Machines by Status</Text>
      <DonutChart
        data={report?.byStatus || []}
        size={168}
        thickness={24}
        centerValue={report?.totalMachines != null ? String(report.totalMachines) : null}
        centerLabel="machines"
        emptyMessage="No machines yet"
      />
    </Card>
  );

  const severityCard = (
    <Card>
      <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>
        Alerts by Severity
      </Text>
      <BarChart
        data={(report?.bySeverity || []).map((d) => ({ label: d.label, values: [d.value] }))}
        series={SEVERITY_SERIES}
        yMax={0}
        height={200}
        emptyMessage="No alerts in this range"
      />
    </Card>
  );

  const customCard =
    tab === "custom" ? (
      <Card>
        <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>Custom range</Text>
        <View className={`gap-3 ${isMobile ? "" : "flex-row"}`}>
          <View className={isMobile ? "" : "flex-1"}>
            <DateTimeInput
              value={customFrom}
              onChange={(v) => dispatch(setCustom({ from: v }))}
              placeholder="Select start date..."
            />
          </View>
          <View className={isMobile ? "" : "flex-1"}>
            <DateTimeInput
              value={customTo}
              onChange={(v) => dispatch(setCustom({ to: v }))}
              placeholder="Select end date..."
            />
          </View>
          <Button
            title="Apply"
            size="sm"
            loading={status === "loading"}
            onPress={() => run({ from: customFrom || undefined, to: customTo || undefined })}
          />
        </View>
      </Card>
    ) : null;

  const errorBanner =
    status === "error" && error ? (
      <Card className="border border-danger/40">
        <Text className={`text-sm font-bold font-inter ${darkText}`}>Reports unavailable</Text>
        <Text className={`text-sm font-inter mt-1 ${darkMuted}`}>{error.message}</Text>
        <View className="mt-3">
          <Button title="Retry" variant="outline" size="sm" onPress={retry} />
        </View>
      </Card>
    ) : null;

  const partialNote =
    status === "succeeded" && Object.values(partial).some(Boolean) ? (
      <Text className={`text-xs font-inter ${darkMuted}`}>
        Some sources are unavailable, so the sections below are incomplete.
      </Text>
    ) : null;

  const header = (
    <View
      className={`mb-4 ${isMobile ? "flex-row items-center gap-2" : "flex-row items-center justify-between"}`}
    >
      {isMobile ? (
        <Pressable onPress={() => router.back()} className="pr-2 py-1">
          <Text className={`text-xl font-bold ${darkText}`}>←</Text>
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text className={`text-2xl font-bold font-inter ${darkText}`}>Reports</Text>
        {!isMobile ? (
          <Text className={`text-sm font-inter mt-1 ${darkMuted}`}>
            Downtime, health and fleet summaries, built from live backend data.
          </Text>
        ) : null}
      </View>
      <Button
        title={isMobile ? "⤓" : "Export"}
        size="sm"
        onPress={handleExport}
        className={isMobile ? "px-3" : ""}
      />
    </View>
  );

  const tabsRow = <Tabs tabs={TABS} active={tab} onChange={(k) => dispatch(setTab(k))} scrollable={isMobile} />;

  const rangeRow =
    tab === "custom" ? null : (
      <View className="mt-4">
        <Tabs tabs={RANGES} active={range} onChange={(k) => dispatch(setRange(k))} scrollable={isMobile} />
      </View>
    );

  const charts =
    tab === "performance" ? (
      <View className={`gap-4 mt-4 ${isMobile ? "" : "flex-row"}`}>
        <View className={isMobile ? "" : "flex-[0.4]"}>{healthCard}</View>
        <View className={isMobile ? "" : "flex-[0.6]"}>{performanceCard}</View>
      </View>
    ) : tab === "fleet" ? (
      <View className={`gap-4 mt-4 ${isMobile ? "" : "flex-row"}`}>
        <View className={isMobile ? "" : "flex-1"}>{statusCard}</View>
        <View className={isMobile ? "" : "flex-1"}>{severityCard}</View>
      </View>
    ) : (
      <View className={`gap-4 mt-4 ${isMobile ? "" : "flex-row"}`}>
        <View className={isMobile ? "" : "flex-1"}>{downtimeCard}</View>
        <View className={isMobile ? "" : "flex-1"}>{typeCard}</View>
      </View>
    );

  const body = (
    <>
      {errorBanner}
      {partialNote}
      {customCard}
      <View className="mt-4">{metricsRow}</View>
      {loading ? <Skeleton height={240} className="rounded-card mt-4" /> : charts}
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
            {rangeRow}
            <View className="mt-4 gap-4">{body}</View>
          </ScrollView>
        </View>
      </AppShell>
    );
  }

  // ── Web: title + Export, tabs, rows — one export, top right ───────────────
  return (
    <AppShell>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      >
        {header}
        {tabsRow}
        {rangeRow}
        <View className="mt-5 gap-4">{body}</View>
      </ScrollView>
    </AppShell>
  );
}
