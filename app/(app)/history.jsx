// app/(app)/history.jsx
//
// History & Analytics — web + mobile.
// US27 (History), US28 (Charts), US29 (Period filter).
//
// Data source: readings timeseries + thresholds (all CONFIRMED endpoints).
// Analytics are computed client-side (no /api/analytics backend):
//   averages, breach counts, health score, CSV export.
//
// Layout:
//   Web: header + period picker, metric cards, sensor charts (2×2),
//         measurements table, anomaly detection card + health gauge.
//   Mobile: header, period picker, metric cards (2×2), charts stacked,
//           measurements table, anomaly + health below.

import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Share, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Select from "../../src/components/Select";
import Skeleton from "../../src/components/Skeleton";
import BusyRow from "../../src/components/BusyRow";
import EmptyState from "../../src/components/EmptyState";
import MetricCard from "../../src/components/MetricCard";
import RangeTabs from "../../src/components/RangeTabs";
import SensorChart from "../../src/components/charts/SensorChart";
import HealthGauge from "../../src/components/charts/HealthGauge";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useRole, PERMISSIONS } from "../../src/hooks/useRole";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { fetchMachines } from "../../src/store/slices/machineSlice";
import { fetchReadings } from "../../src/store/slices/readingSlice";
import { fetchThresholds } from "../../src/store/slices/thresholdSlice";
import {
  SERIES_META,
  mergeReadings,
  groupBySensor,
  buildMetrics,
} from "../../src/utils/readingSeries";
import {
  computeAverages,
  countBreaches,
  computeHealthScore,
  generateCSV,
  downloadCSV,
} from "../../src/utils/analyticsCalc";
import { useDialog } from "../../src/components/dialog/DialogContext";
import { formatNumber } from "../../src/utils/formatHelper";
import DateTimeInput from "../../src/components/DateTimeInput";

const RANGES = [
  { key: "1h", label: "1 Hour" },
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];

function formatTimestamp(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const TABS = [
  { key: "parameters", label: "Parameters" },
  { key: "anomalies", label: "Anomalies" },
  { key: "events", label: "Events" },
];

const TABLE_PAGE_SIZE = 15;

export default function HistoryScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dialog = useDialog();
  const params = useLocalSearchParams();
  const isDesktop = useBreakpoint() === "desktop";
  const dark = useDark();
  const { hasPermission } = useRole();
  const canRead = hasPermission(PERMISSIONS.READINGS_READ);

  const { list: machines, status: machineStatus } = useAppSelector((s) => s.machine);
  const { list: readings, status: readingStatus, error: readingError } =
    useAppSelector((s) => s.reading);
  const { list: thresholdList } = useAppSelector((s) => s.threshold);

  const [selectedMachine, setSelectedMachine] = useState(params.machineId || "");
  const [range, setRange] = useState("24h");
  const [tab, setTab] = useState("parameters");
  const [exporting, setExporting] = useState(false);
  const [tablePage, setTablePage] = useState(0);
  const [tableSensorFilter, setTableSensorFilter] = useState(null);
  // Per-chart individual ranges (overrides global range)
  const [chartRanges, setChartRanges] = useState({});
  // Custom date picker
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customApplied, setCustomApplied] = useState(false);

  // Fetch machines for the selector
  useEffect(() => {
    if (machines.length === 0) dispatch(fetchMachines({ size: 100 }));
  }, [dispatch, machines.length]);

  // Auto-select first machine
  useEffect(() => {
    if (!selectedMachine && machines.length > 0) {
      setSelectedMachine(machines[0].id || machines[0].code);
    }
  }, [machines, selectedMachine]);

  // Fetch readings when machine or range changes. The server caps a page at
  // 100 rows — asking for 500 only produced an extra oversized request.
  useEffect(() => {
    if (!selectedMachine || !canRead) return;
    dispatch(fetchReadings({ machineId: selectedMachine, range, size: 100 }));
    dispatch(fetchThresholds(selectedMachine));
  }, [dispatch, selectedMachine, range, canRead]);

  // Reset table page when machine/range changes
  useEffect(() => {
    setTablePage(0);
  }, [selectedMachine, range]);

  const machine = machines.find(
    (m) => m.id === selectedMachine || m.code === selectedMachine
  );
  const machineCode = machine?.code || machine?.machineCode || selectedMachine;

  // Build groups and analytics from readings
  const merged = useMemo(() => mergeReadings(readings, []), [readings]);
  const groups = useMemo(() => groupBySensor(merged), [merged]);
  const metrics = useMemo(() => buildMetrics(groups), [groups]);

  // Analytics calculations (client-side)
  const averages = useMemo(() => computeAverages(groups), [groups]);
  const breaches = useMemo(
    () => countBreaches(groups, thresholdList),
    [groups, thresholdList]
  );
  const health = useMemo(() => computeHealthScore(breaches), [breaches]);

  // Loading states — two distinct cases (per UX rules):
  //   readingsInitializing: fetch with NO data yet → skeletons/empty states
  //   readingsRefreshing:   fetch while OLD data is on screen (period/search
  //                         change on an already-loaded machine → can take
  //                         seconds) → spinner banner + dimmed stale content,
  //                         so the user always knows data is coming.
  const readingsBusy = readingStatus === "loading";
  const readingsLoading = readingsBusy && merged.length === 0;
  const readingsRefreshing = readingsBusy && merged.length > 0;
  const readingsEmpty = readingStatus === "succeeded" && merged.length === 0;
  const readingsFailed = readingStatus === "error" && merged.length === 0;

  const periodLabel = RANGES.find((r) => r.key === range)?.label || "selected period";

  const machineOptions = machines.map((m) => ({
    value: m.id || m.code,
    label: `${m.code || m.machineCode || m.id} — ${m.name || m.type || "Machine"}`,
  }));

  // Table data (most recent first, optionally filtered by sensor)
  const tableData = useMemo(() => {
    let data = [...merged].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    if (tableSensorFilter) {
      data = data.filter((r) => r.sensorType === tableSensorFilter);
    }
    return data;
  }, [merged, tableSensorFilter]);

  const tableTotalPages = Math.max(1, Math.ceil(tableData.length / TABLE_PAGE_SIZE));
  const tableItems = tableData.slice(
    tablePage * TABLE_PAGE_SIZE,
    tablePage * TABLE_PAGE_SIZE + TABLE_PAGE_SIZE
  );

  function handleMachineChange(val) {
    setSelectedMachine(val);
    setChartRanges({});
    setTablePage(0);
  }

  function handleRangeChange(val) {
    setRange(val);
    setChartRanges({}); // reset per-chart overrides when global changes
    setCustomApplied(false);
  }

  function handleChartRange(sensorType, newRange) {
    setChartRanges((prev) => ({ ...prev, [sensorType]: newRange }));
  }

  async function handleExport() {
    if (merged.length === 0) return;
    setExporting(true);
    try {
      const csv = generateCSV(merged, machineCode);
      const filename = `${machineCode}_${range}_readings.csv`;
      const downloaded = downloadCSV(csv, filename);
      if (!downloaded) {
        await Share.share({ message: csv, title: filename });
      }
      dialog.alert("Exported", `${merged.length} readings exported.`, "success");
    } catch {
      dialog.alert("Export failed", "Could not export data.", "error");
    } finally {
      setExporting(false);
    }
  }

  function avgMetricCards() {
    return SERIES_META.map((meta) => {
      const avg = averages.find((a) => a.sensorType === meta.id);
      const breach = breaches.find((b) => b.sensorType === meta.id);
      const decimals = meta.id === "RPM" ? 0 : 1;
      return {
        ...meta,
        value: avg?.avg != null ? formatNumber(avg.avg, decimals) : "—",
        unit: avg?.unit || meta.unit,
        breachCount: (breach?.warnings || 0) + (breach?.criticals || 0),
        count: avg?.count || 0,
      };
    });
  }

  const avgCards = avgMetricCards();

  function formatTimestamp(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  if (!canRead) {
    return (
      <AppShell>
        <Card className="m-4">
          <EmptyState
            title="Restricted"
            message="You need READINGS_READ permission to view history."
          />
        </Card>
      </AppShell>
    );
  }

  // Sensor filter options for the table
  const sensorFilterOptions = [
    { value: null, label: "All Sensors" },
    ...SERIES_META.map((m) => ({ value: m.id, label: m.label })),
  ];

  return (
    <AppShell>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: isDesktop ? 24 : 16 }}
      >
        {/* Header */}
        <View className={`mb-4 ${isDesktop ? "flex-row items-center justify-between" : ""}`}>
          <View className="mb-2">
            <Text className={`text-xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
              History & Analytics
            </Text>
            <Text className={`text-sm font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
              Sensor data trends, anomaly detection, and machine health
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Button
              title={exporting ? "Exporting…" : "Export CSV"}
              variant="primary"
              size="sm"
              disabled={exporting || merged.length === 0}
              onPress={handleExport}
            />
          </View>
        </View>

        {/* Machine selector + period picker */}
        <View className={`mb-4 ${isDesktop ? "flex-row items-end gap-4" : "gap-3"}`}>
          <View style={isDesktop ? { width: 320 } : undefined}>
            <Text className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}>
              Machine
            </Text>
            <Select
              value={selectedMachine}
              onValueChange={handleMachineChange}
              options={machineOptions}
              placeholder="Select a machine…"
            />
          </View>
          <View>
            <Text className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}>
              Period
            </Text>
            <View className="flex-row items-center gap-2">
              <RangeTabs
                ranges={RANGES}
                active={range}
                onChange={handleRangeChange}
              />
              <Pressable
                onPress={() => setShowCustom(!showCustom)}
                className={`px-3 py-1.5 rounded-chip ${
                  showCustom
                    ? "bg-primary"
                    : dark ? "bg-white/5 border border-white/15" : "bg-bg border border-border"
                }`}
              >
                <Text className={`text-xs font-semibold font-inter ${
                  showCustom ? "text-white" : dark ? "text-white/60" : "text-text-muted"
                }`}>
                  Custom
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Custom date range picker */}
        {showCustom && (
          <Card className="mb-4">
            <Text className={`text-sm font-bold font-inter mb-2 ${dark ? "text-white" : "text-text"}`}>
              Custom Period
            </Text>
            <View className={`${isDesktop ? "flex-row items-end gap-3" : "gap-3"}`}>
              <View className="flex-1">
                <Text className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}>{'From'}</Text>
                <DateTimeInput value={customFrom} onChange={setCustomFrom} placeholder="Select start date..." />
              </View>
              <View className="flex-1">
                <Text className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}>{'To'}</Text>
                <DateTimeInput value={customTo} onChange={setCustomTo} placeholder="Select end date..." />
              </View>
              {/* Boolean guards: a plain `customFrom && ...` chain yields the
                  empty STRING "" (not false) when the fields are empty —
                  React renders "" as a text node, which crashes the View
                  ("Unexpected text node"). Coerce to real booleans. */}
              {(customFrom !== "" && customTo !== "") && (
                <View className={`flex-row items-center gap-2 py-2 px-3 rounded-btn mt-2 ${dark ? "bg-success/10" : "bg-green-50"}`}>
                  <Text style={{ fontSize: 14, color: "#22C55E" }}>{"✓"}</Text>
                  <Text className={`text-xs font-inter ${dark ? "text-white/80" : "text-text"}`}>
                    {`Selected: ${new Date(customFrom).toLocaleString()} → ${new Date(customTo).toLocaleString()}`}
                  </Text>
                </View>
              )}
              <View className="flex-row gap-2 mt-2">
                <Button
                  title="Apply Filter"
                  variant="primary"
                  size="sm"
                  disabled={!customFrom || !customTo}
                  onPress={() => {
                    if (selectedMachine && customFrom && customTo) {
                      dispatch(fetchReadings({
                        machineId: selectedMachine,
                        range: "custom",
                        size: 100,
                        customFrom,
                        customTo,
                      }));
                      setShowCustom(false);
                      setCustomApplied(true);
                    }
                  }}
                />
                <Button
                  title="Cancel"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    setShowCustom(false);
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                />
              </View>
            </View>
          </Card>
        )}

        {/* Custom filter applied feedback */}
        {customApplied && !showCustom && (
          <View className={`flex-row items-center justify-between py-2 px-4 rounded-btn mb-4 ${dark ? "bg-success/15 border border-success/30" : "bg-green-50 border border-green-200"}`}>
            <View className="flex-row items-center gap-2">
              <Text style={{ fontSize: 16, color: "#22C55E" }}>{"✓"}</Text>
              <Text className={`text-sm font-semibold font-inter ${dark ? "text-success" : "text-green-700"}`}>
                {"Custom filter applied"}
              </Text>
              <Text className={`text-xs font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                {`${new Date(customFrom).toLocaleDateString()} – ${new Date(customTo).toLocaleDateString()}`}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setCustomApplied(false);
                setCustomFrom("");
                setCustomTo("");
                if (selectedMachine) {
                  dispatch(fetchReadings({ machineId: selectedMachine, range }));
                }
              }}
            >
              <Text className={`text-xs font-bold font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>{"✕ Clear"}</Text>
            </Pressable>
          </View>
        )}

        {/* Tabs */}
        <View className="flex-row gap-1 mb-4">
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              className={`px-4 py-2 rounded-t-lg ${
                tab === t.key
                  ? dark ? "bg-slate-700 border-b-2 border-primary" : "bg-white border-b-2 border-primary"
                  : dark ? "bg-white/5" : "bg-bg"
              }`}
            >
              <Text
                className={`text-sm font-inter ${
                  tab === t.key
                    ? "text-primary font-bold"
                    : dark ? "text-white/60" : "text-text-muted"
                }`}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Refresh banner — shown while a fetch runs and OLD data is still
            displayed (period/filter change on a loaded machine). Satisfies
            "show a loading circle so the user knows data is coming". */}
        {readingsRefreshing && (
          <BusyRow
            label={`Loading ${periodLabel.toLowerCase()} data…`}
            className="mb-3"
          />
        )}

        {!selectedMachine && (
          <Card>
            <EmptyState
              title="Select a machine"
              message="Choose a machine from the dropdown to view its history."
            />
          </Card>
        )}

        {!!selectedMachine && tab === "parameters" && (
          <View>
            {/* Metric cards */}
            {readingsLoading ? (
              <View className={`gap-3 mb-4 ${isDesktop ? "flex-row" : ""}`}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} className="flex-1">
                    <Card>
                      <Skeleton width="50%" height={14} className="mb-2" />
                      <Skeleton width="70%" height={28} />
                    </Card>
                  </View>
                ))}
              </View>
            ) : (
              <View
                className={`mb-4 ${isDesktop ? "flex-row gap-3" : ""}`}
                // Metric cards stay fully opaque while a filter re-fetches.
                // Dimming them made the white cards read as gray padding
                // inside the card as soon as a filter was selected.
              >
                {isDesktop ? (
                  avgCards.map((m) => (
                    <MetricCard
                      key={m.id}
                      label={`Avg. ${m.label}`}
                      value={m.value}
                      unit={m.unit}
                      delta={null}
                      icon={m.icon}
                      iconBgClass={m.iconBgClass}
                    />
                  ))
                ) : (
                  <View className="gap-3">
                    <View className="flex-row gap-3">
                      {avgCards.slice(0, 2).map((m) => (
                        <MetricCard
                          key={m.id}
                          label={`Avg. ${m.label}`}
                          value={m.value}
                          unit={m.unit}
                          delta={null}
                          icon={m.icon}
                          iconBgClass={m.iconBgClass}
                        />
                      ))}
                    </View>
                    <View className="flex-row gap-3">
                      {avgCards.slice(2, 4).map((m) => (
                        <MetricCard
                          key={m.id}
                          label={`Avg. ${m.label}`}
                          value={m.value}
                          unit={m.unit}
                          delta={null}
                          icon={m.icon}
                          iconBgClass={m.iconBgClass}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Main content: charts + side panel */}
            <View className={isDesktop ? "flex-row gap-4" : "gap-4"}>
              {/* Left: Sensor Data Trends (charts) */}
              <View style={isDesktop ? { flex: 0.65 } : undefined}>
                <Card className="mb-4">
                  <View className={`flex-row items-center justify-between mb-3`}>
                    <Text className={`text-base font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                      Sensor Data Trends
                    </Text>
                    {readingsRefreshing && (
                      <View className="flex-row items-center gap-2">
                        <ActivityIndicator size="small" color={dark ? "#60A5FA" : "#2563EB"} />
                        <Text className={`text-xs font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                          Updating charts…
                        </Text>
                      </View>
                    )}
                  </View>

                  {readingsLoading && (
                    <View className="gap-3">
                      {SERIES_META.map((m) => (
                        <Skeleton key={m.id} width="100%" height={180} />
                      ))}
                    </View>
                  )}

                  {readingsFailed && (
                    <View>
                      <Text className="text-sm text-danger font-inter mb-3">
                        {readingError?.message || "Failed to load readings"}
                      </Text>
                      <Button
                        title="Retry"
                        variant="outline"
                        size="sm"
                        onPress={() =>
                          dispatch(fetchReadings({ machineId: selectedMachine, range }))
                        }
                      />
                    </View>
                  )}

                  {readingsEmpty && (
                    <EmptyState
                      icon={
                        <View
                          className="w-16 h-16 rounded-full items-center justify-center"
                          style={{ backgroundColor: "rgba(148,163,184,0.15)" }}
                        >
                          <Text className="text-3xl">📭</Text>
                        </View>
                      }
                      title={`No data for ${periodLabel}`}
                      message={`${machineCode || "This machine"} has no readings in the ${periodLabel.toLowerCase()} window. Try a longer period such as 7 or 30 days, or pick another machine.`}
                      action={
                        <View className="flex-row gap-2">
                          {range !== "7d" && (
                            <Button title="Try 7 Days" variant="outline" size="sm" onPress={() => handleRangeChange("7d")} />
                          )}
                          {range === "7d" && (
                            <Button title="Try 30 Days" variant="outline" size="sm" onPress={() => handleRangeChange("30d")} />
                          )}
                        </View>
                      }
                    />
                  )}

                  {(readingsLoading || readingsRefreshing) && (
                    <>
                      {readingsLoading
                        ? /* cold load: nothing on screen yet → skeleton charts */
                          <View className="gap-3">
                            {SERIES_META.map((m) => (
                              <Skeleton key={m.id} width="100%" height={180} />
                            ))}
                          </View>
                        : /* refreshing: keep the stale charts visible but clearly dimmed */
                          <View style={{ opacity: 0.35 }} className="gap-3" pointerEvents="none">
                            {SERIES_META.map((meta) => {
                              const pts = (groups[meta.id] || []).map((r) => ({
                                x: new Date(r.timestamp).getTime(),
                                y: r.value,
                              }));
                              const thold = (thresholdList || []).find(
                                (t) => t.sensorType === meta.id
                              );
                              const lastPt = (groups[meta.id] || []).at(-1);
                              return (
                                <View
                                  key={meta.id}
                                  style={isDesktop ? { width: "48%" } : undefined}
                                >
                                  <SensorChart
                                    sensorType={meta.id}
                                    data={pts}
                                    threshold={thold}
                                    height={isDesktop ? 200 : 170}
                                    currentValue={lastPt?.value}
                                    compact={!isDesktop}
                                  />
                                </View>
                              );
                            })}
                          </View>
                      }
                    </>
                  )}

                  {!readingsBusy && !readingsFailed && !readingsEmpty && (
                    <View className={isDesktop ? "flex-row flex-wrap gap-3" : "gap-3"}>
                      {SERIES_META.map((meta) => {
                        const pts = (groups[meta.id] || []).map((r) => ({
                          x: new Date(r.timestamp).getTime(),
                          y: r.value,
                        }));
                        const thold = (thresholdList || []).find(
                          (t) => t.sensorType === meta.id
                        );
                        const lastPt = (groups[meta.id] || []).at(-1);
                        return (
                          <View
                            key={meta.id}
                            style={isDesktop ? { width: "48%" } : undefined}
                          >
                            <SensorChart
                              sensorType={meta.id}
                              data={pts}
                              threshold={thold}
                              height={isDesktop ? 200 : 170}
                              currentValue={lastPt?.value}
                              compact={!isDesktop}
                            />
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Card>
              </View>

              {/* Right: Anomaly Detection + Health Score */}
              <View style={isDesktop ? { flex: 0.35 } : undefined}>
                {/* Anomaly Detection */}
                <Card className="mb-4">
                  <Text className={`text-base font-bold font-inter mb-3 ${dark ? "text-white" : "text-text"}`}>
                    Anomaly Detection
                  </Text>
                  {readingsRefreshing && (
                    <View className="flex-row items-center gap-2 mb-2">
                      <ActivityIndicator size="small" color={dark ? "#60A5FA" : "#2563EB"} />
                      <Text className={`text-xs font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                        Updating…
                      </Text>
                    </View>
                  )}
                  {readingsEmpty ? (
                    <EmptyState
                      title="No data for this period"
                      message="Anomalies need readings. Try a longer period or another machine."
                      icon={<Text className="text-2xl">📭</Text>}
                      className="py-6"
                    />
                  ) : health.totalBreaches === 0 ? (
                    <View className="items-center py-4">
                      <View className="w-12 h-12 rounded-full bg-success/15 items-center justify-center mb-2">
                        <Text style={{ fontSize: 24 }}>{"✓"}</Text>
                      </View>
                      <Text className={`text-sm font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                        No anomalies detected
                      </Text>
                      <Text className={`text-xs font-inter mt-1 ${dark ? "text-white/60" : "text-text-muted"}`}>
                        All readings within normal range
                      </Text>
                    </View>
                  ) : (
                    <View className="py-2">
                      <View className="flex-row items-center gap-2 mb-3">
                        <View className="w-10 h-10 rounded-full bg-danger/15 items-center justify-center">
                          <Text style={{ fontSize: 20 }}>{"⚠️"}</Text>
                        </View>
                        <View>
                          <Text className={`text-sm font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                            {health.totalBreaches} threshold {health.totalBreaches === 1 ? "breach" : "breaches"}
                          </Text>
                          <Text className={`text-xs font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                            detected in the selected period
                          </Text>
                        </View>
                      </View>
                      {breaches
                        .filter((b) => b.warnings > 0 || b.criticals > 0)
                        .map((b) => {
                          const meta = SERIES_META.find((m) => m.id === b.sensorType);
                          return (
                            <View key={b.sensorType} className={`flex-row items-center gap-2 py-1.5 px-2 rounded-btn mb-1 ${dark ? "bg-white/5" : "bg-bg"}`}>
                              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: meta?.color || "#999" }} />
                              <Text className={`text-xs font-inter flex-1 ${dark ? "text-white" : "text-text"}`}>
                                {meta?.label || b.sensorType}
                              </Text>
                              {b.criticals > 0 && (
                                <View className="px-1.5 py-0.5 rounded bg-danger/15">
                                  <Text className="text-[10px] font-bold text-danger">{b.criticals} critical</Text>
                                </View>
                              )}
                              {b.warnings > 0 && (
                                <View className="px-1.5 py-0.5 rounded bg-warning/15">
                                  <Text className="text-[10px] font-bold text-warning">{b.warnings} warning</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                    </View>
                  )}
                </Card>

                {/* Health Score */}
                <Card>
                  <Text className={`text-base font-bold font-inter mb-3 ${dark ? "text-white" : "text-text"}`}>
                    Health Score
                  </Text>
                  {readingsEmpty ? (
                    <EmptyState
                      title="No data"
                      message="The health score needs at least one reading in the selected period."
                      icon={<Text className="text-2xl">❓</Text>}
                      className="py-6"
                    />
                  ) : (
                    <View
                      className="items-center py-2"
                      style={readingsRefreshing ? { opacity: 0.5 } : undefined}
                    >
                      <HealthGauge value={health.score} size={150} />
                      <Text className={`text-xs font-inter mt-3 text-center ${dark ? "text-white/60" : "text-text-muted"}`}>
                        {`Based on ${merged.length} reading${merged.length === 1 ? "" : "s"}. Score = 100 − (breach penalty / total).`}
                      </Text>
                    </View>
                  )}
                </Card>
              </View>
            </View>

            {/* Measurements Table */}
            <Card className="mt-4">
              <View className={`${isDesktop ? "flex-row items-center justify-between" : ""} mb-3`}>
                <Text className={`text-base font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                  Measurements
                  <Text className={`text-sm font-normal ${dark ? "text-white/50" : "text-text-muted"}`}>
                    {` (${tableData.length} readings)`}
                  </Text>
                </Text>
                <View className="flex-row items-center gap-2 mt-1">
                  <View style={{ width: 160 }}>
                    <Select
                      value={tableSensorFilter}
                      onValueChange={(val) => { setTableSensorFilter(val); setTablePage(0); }}
                      options={sensorFilterOptions}
                      placeholder="All Sensors"
                    />
                  </View>
                </View>
              </View>

              {tableData.length === 0 ? (
                <EmptyState title="No measurements" message="No data available for the selected period." />
              ) : (
                <View>
                  {/* Table header */}
                  <View className={`flex-row items-center py-2 px-3 border-b ${dark ? "border-white/10 bg-white/[0.03]" : "border-border bg-slate-50"} rounded-t-lg`}>
                    <Text className={`flex-1 text-[11px] font-bold font-inter uppercase ${dark ? "text-white/60" : "text-text-muted"}`} style={{ letterSpacing: 0.5 }}>
                      Timestamp
                    </Text>
                    <Text className={`text-[11px] font-bold font-inter uppercase ${dark ? "text-white/60" : "text-text-muted"}`} style={{ width: 100, letterSpacing: 0.5 }}>
                      Sensor
                    </Text>
                    <Text className={`text-[11px] font-bold font-inter uppercase text-right ${dark ? "text-white/60" : "text-text-muted"}`} style={{ width: 90, letterSpacing: 0.5 }}>
                      Value
                    </Text>
                    <Text className={`text-[11px] font-bold font-inter uppercase text-right ${dark ? "text-white/60" : "text-text-muted"}`} style={{ width: 60, letterSpacing: 0.5 }}>
                      Unit
                    </Text>
                  </View>

                  {/* Table rows */}
                  {tableItems.map((row, idx) => {
                    const meta = SERIES_META.find((m) => m.id === row.sensorType);
                    return (
                      <View
                        key={`${row.sensorType}-${row.timestamp}-${idx}`}
                        className={`flex-row items-center py-2 px-3 border-b ${dark ? "border-white/5" : "border-border/50"}`}
                      >
                        <Text className={`flex-1 text-xs font-inter ${dark ? "text-white/80" : "text-text"}`}>
                          {formatTimestamp(row.timestamp)}
                        </Text>
                        <View className="flex-row items-center gap-1.5" style={{ width: 100 }}>
                          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: meta?.color || "#999" }} />
                          <Text className={`text-xs font-inter ${dark ? "text-white/80" : "text-text"}`}>
                            {meta?.label || row.sensorType}
                          </Text>
                        </View>
                        <Text className={`text-xs font-inter font-medium text-right ${dark ? "text-white" : "text-text"}`} style={{ width: 90 }}>
                          {typeof row.value === "number" ? row.value.toFixed(meta?.id === "RPM" ? 0 : 2) : row.value}
                        </Text>
                        <Text className={`text-xs font-inter text-right ${dark ? "text-white/50" : "text-text-muted"}`} style={{ width: 60 }}>
                          {row.unit || SENSOR_UNIT[row.sensorType] || ""}
                        </Text>
                      </View>
                    );
                  })}

                  {/* Table pagination */}
                  {tableTotalPages > 1 && (
                    <View className="flex-row items-center justify-center mt-3 gap-4">
                      <Pressable
                        onPress={() => setTablePage((p) => Math.max(0, p - 1))}
                        disabled={tablePage === 0}
                        className={`px-3 py-1.5 rounded-btn ${tablePage === 0 ? "opacity-40" : ""} ${dark ? "bg-white/5" : "bg-bg"}`}
                      >
                        <Text className={`text-xs font-bold font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                          {"‹ Prev"}
                        </Text>
                      </Pressable>
                      <Text className={`text-xs font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                        {`Page ${tablePage + 1} of ${tableTotalPages}`}
                      </Text>
                      <Pressable
                        onPress={() => setTablePage((p) => Math.min(tableTotalPages - 1, p + 1))}
                        disabled={tablePage >= tableTotalPages - 1}
                        className={`px-3 py-1.5 rounded-btn ${tablePage >= tableTotalPages - 1 ? "opacity-40" : ""} ${dark ? "bg-white/5" : "bg-bg"}`}
                      >
                        <Text className={`text-xs font-bold font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                          {"Next ›"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </Card>
          </View>
        )}

        {!!selectedMachine && tab === "anomalies" && (
          <View>
            <Card className="mb-4">
              <Text className={`text-base font-bold font-inter mb-3 ${dark ? "text-white" : "text-text"}`}>
                {"Threshold Breaches"}
              </Text>
              {readingsLoading && (
                <BusyRow label="Loading anomaly data…" className="mb-2" />
              )}
              {readingsEmpty ? (
                <EmptyState
                  title="No data for this period"
                  message="Anomalies need readings. Try a longer period such as 7 or 30 days."
                />
              ) : health.totalBreaches === 0 ? (
                <EmptyState
                  title="No anomalies"
                  message="All readings are within normal range for the selected period."
                />
              ) : (
                <View>
                  <View className={`flex-row items-center gap-2 py-2 px-3 mb-2 rounded-btn ${dark ? "bg-danger/10" : "bg-red-50"}`}>
                    <Text className="text-sm font-inter">{'⚠️'}</Text>
                    <Text className={`text-sm font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                      {`${health.totalBreaches} threshold breach${health.totalBreaches === 1 ? "" : "es"} detected`}
                    </Text>
                  </View>
                  {breaches
                    .filter((b) => b.warnings > 0 || b.criticals > 0)
                    .map((b) => {
                      const meta = SERIES_META.find((m) => m.id === b.sensorType);
                      const sensorPoints = groups[b.sensorType] || [];
                      const breachPoints = sensorPoints.filter((p) => {
                        const thr = (thresholdList || []).find((t) => t.sensorType === b.sensorType);
                        if (!thr) return false;
                        const v = Number(p.value);
                        const cMax = thr.criticalMax != null ? Number(thr.criticalMax) : null;
                        const wMax = thr.warningMax != null ? Number(thr.warningMax) : null;
                        const cMin = thr.criticalMin != null ? Number(thr.criticalMin) : null;
                        const wMin = thr.warningMin != null ? Number(thr.warningMin) : null;
                        return (cMax != null && v >= cMax) || (wMax != null && v >= wMax) || (cMin != null && v <= cMin) || (wMin != null && v <= wMin);
                      });
                      return (
                        <Card key={b.sensorType} className="mb-2">
                          <View className="flex-row items-center gap-2 mb-2">
                            <View className="w-3 h-3 rounded-full" style={{ backgroundColor: meta?.color || "#999" }} />
                            <Text className={`text-sm font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                              {meta?.label || b.sensorType}
                            </Text>
                            {b.criticals > 0 && (
                              <View className="px-2 py-0.5 rounded-full bg-danger/15">
                                <Text className="text-[10px] font-bold text-danger font-inter">{`${b.criticals} critical`}</Text>
                              </View>
                            )}
                            {b.warnings > 0 && (
                              <View className="px-2 py-0.5 rounded-full bg-warning/15">
                                <Text className="text-[10px] font-bold text-warning font-inter">{`${b.warnings} warning`}</Text>
                              </View>
                            )}
                          </View>
                          {breachPoints.slice(0, 5).map((bp, idx) => (
                            <View key={idx} className={`flex-row items-center py-1.5 px-2 rounded mb-1 ${dark ? "bg-white/5" : "bg-bg"}`}>
                              <Text className={`flex-1 text-xs font-inter ${dark ? "text-white/80" : "text-text"}`}>
                                {formatTimestamp(bp.timestamp)}
                              </Text>
                              <Text className={`text-xs font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                                {typeof bp.value === "number" ? bp.value.toFixed(2) : bp.value}
                              </Text>
                            </View>
                          ))}
                          {breachPoints.length > 5 && (
                            <Text className={`text-xs font-inter mt-1 ${dark ? "text-white/50" : "text-text-muted"}`}>
                              {`+ ${breachPoints.length - 5} more breach readings`}
                            </Text>
                          )}
                        </Card>
                      );
                    })}
                </View>
              )}
            </Card>
          </View>
        )}

        {!!selectedMachine && tab === "events" && (
          <View>
            <Card>
              <Text className={`text-base font-bold font-inter mb-3 ${dark ? "text-white" : "text-text"}`}>
                {"Machine Events"}
              </Text>
              {readingsLoading && <BusyRow label="Loading events…" className="mb-2" />}
              {readingsBusy && merged.length > 0 && (
                <BusyRow label="Updating events…" className="mb-2" />
              )}
              {merged.length === 0 && !readingsBusy ? (
                <EmptyState
                  title="No events"
                  message="No events recorded for this machine in the selected period."
                />
              ) : (
                <View>
                  <View className={`flex-row items-center py-2 px-3 border-b ${dark ? "border-white/10 bg-white/[0.03]" : "border-border bg-slate-50"} rounded-t-lg`}>
                    <Text className={`flex-1 text-[11px] font-bold font-inter uppercase ${dark ? "text-white/60" : "text-text-muted"}`}>{'Timestamp'}</Text>
                    <Text className={`text-[11px] font-bold font-inter uppercase ${dark ? "text-white/60" : "text-text-muted"}`} style={{ width: 100 }}>{'Type'}</Text>
                    <Text className={`text-[11px] font-bold font-inter uppercase text-right ${dark ? "text-white/60" : "text-text-muted"}`} style={{ width: 80 }}>{'Value'}</Text>
                  </View>
                  {[...merged]
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, 20)
                    .map((row, idx) => {
                      const meta = SERIES_META.find((m) => m.id === row.sensorType);
                      const thr = (thresholdList || []).find((t) => t.sensorType === row.sensorType);
                      let severity = "normal";
                      if (thr) {
                        const v = Number(row.value);
                        const cMax = thr.criticalMax != null ? Number(thr.criticalMax) : null;
                        const wMax = thr.warningMax != null ? Number(thr.warningMax) : null;
                        if (cMax != null && v >= cMax) severity = "critical";
                        else if (wMax != null && v >= wMax) severity = "warning";
                      }
                      return (
                        <View
                          key={`${row.sensorType}-${row.timestamp}-${idx}`}
                          className={`flex-row items-center py-2 px-3 border-b ${dark ? "border-white/5" : "border-border/50"}`}
                          style={severity === "critical" ? { backgroundColor: "rgba(220,38,38,0.06)" } : severity === "warning" ? { backgroundColor: "rgba(245,158,11,0.06)" } : undefined}
                        >
                          <Text className={`flex-1 text-xs font-inter ${dark ? "text-white/80" : "text-text"}`}>{formatTimestamp(row.timestamp)}</Text>
                          <View className="flex-row items-center gap-1" style={{ width: 100 }}>
                            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: meta?.color || "#999" }} />
                            <Text className={`text-xs font-inter ${dark ? "text-white/80" : "text-text"}`}>{meta?.label || row.sensorType}</Text>
                          </View>
                          <Text className={`text-xs font-bold font-inter text-right ${severity === "critical" ? "text-danger" : severity === "warning" ? "text-warning" : dark ? "text-white" : "text-text"}`} style={{ width: 80 }}>
                            {typeof row.value === "number" ? row.value.toFixed(2) : row.value}
                          </Text>
                        </View>
                      );
                    })}
                </View>
              )}
            </Card>
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}
