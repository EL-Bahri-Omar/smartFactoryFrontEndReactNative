// app/(app)/machines/[id].jsx
//
// Machine Details + Live Sensor — web + mobile, same file.
// Overview is fully built. Other tabs show EmptyState "Coming soon".
//
// Screen -> dispatch fetchMachineById / fetchReadings
//        -> machineSlice.current + readingSlice
//        -> useLiveTopic('/topic/machines/{id}/readings')
// Chart merges historical readings with live points.

import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AppShell from "../../../src/components/AppShell";
import Card from "../../../src/components/Card";
import Button from "../../../src/components/Button";
import StatusBadge from "../../../src/components/StatusBadge";
import Skeleton from "../../../src/components/Skeleton";
import EmptyState from "../../../src/components/EmptyState";
import Breadcrumb from "../../../src/components/Breadcrumb";
import Tabs from "../../../src/components/Tabs";
import RangeTabs from "../../../src/components/RangeTabs";
import MetricCard from "../../../src/components/MetricCard";
import AddMachineModal from "../../../src/components/AddMachineModal";
import LineChart from "../../../src/components/charts/LineChart";
import ChartLegend from "../../../src/components/charts/ChartLegend";
import { useBreakpoint } from "../../../src/hooks/useBreakpoint";
import { useRole } from "../../../src/hooks/useRole";
import { useDialog } from "../../../src/components/dialog/DialogContext";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { useLiveTopic } from "../../../src/hooks/useLiveTopic";
import { fetchMachineById, deleteMachine } from "../../../src/store/slices/machineSlice";
import { fetchReadings } from "../../../src/store/slices/readingSlice";
import {
  SERIES_META,
  mergeReadings,
  groupBySensor,
  buildChartSeries,
  buildMetrics,
  incomingToList,
} from "../../../src/utils/readingSeries";

const WEB_TABS = [
  { key: "overview", label: "Overview" },
  { key: "live", label: "Live Data" },
  { key: "history", label: "History" },
  { key: "maintenance", label: "Maintenance" },
  { key: "settings", label: "Settings" },
];

const MOBILE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "live", label: "Sensor Data" },
  { key: "history", label: "History" },
];

export default function MachineDetailScreen() {
  const { id } = useLocalSearchParams();
  const machineId = Array.isArray(id) ? id[0] : id;
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dialog = useDialog();
  const { isAdmin } = useRole();
  const { canAccess, homeRoute } = useRole();
  const isDesktop = useBreakpoint() === "desktop";

  const {
    current,
    currentStatus,
    currentError,
    list,
  } = useAppSelector((s) => s.machine);
  const { list: readings, status: readingStatus, error: readingError } =
    useAppSelector((s) => s.reading);
  const liveConnected = useAppSelector((s) => s.live.connected);

  const [tab, setTab] = useState("overview");
  const [chartRange, setChartRange] = useState("6h");
  const [livePoints, setLivePoints] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const lastLiveRef = useRef(null);

  const destination = machineId ? `/topic/machines/${machineId}/readings` : null;
  const liveMessage = useLiveTopic(destination, { enabled: Boolean(machineId) });

  useEffect(() => {
    if (!machineId) return;
    dispatch(fetchMachineById(machineId));
    dispatch(fetchReadings({ machineId, range: chartRange }));
  }, [dispatch, machineId, chartRange]);

  useEffect(() => {
    setLivePoints([]);
    lastLiveRef.current = null;
  }, [machineId, chartRange]);

  useEffect(() => {
    if (!liveMessage || !destination) return;
    if (lastLiveRef.current === liveMessage) return;
    lastLiveRef.current = liveMessage;
    setLivePoints((prev) => [...prev, ...incomingToList(liveMessage)]);
  }, [dispatch, destination, liveMessage]);

  const machineFromList = list.find(
    (m) => m.id === machineId || m.code === machineId || m.machineCode === machineId
  );
  const machine =
    current && (current.id === machineId || current.code === machineId || current.machineCode === machineId)
      ? current
      : machineFromList;

  const code = machine?.code || machine?.machineCode || machine?.id || machineId || "—";
  const typeLabel = machine?.type || machine?.name || "Machine";
  const status = machine?.status;

  const merged = useMemo(
    () => mergeReadings(readings, livePoints),
    [readings, livePoints]
  );
  const groups = useMemo(() => groupBySensor(merged), [merged]);
  const chartSeries = useMemo(() => buildChartSeries(groups), [groups]);
  const metrics = useMemo(() => buildMetrics(groups), [groups]);
  const legendItems = SERIES_META.map((m) => ({
    id: m.id,
    label: m.label,
    color: m.color,
  }));

  const machineLoading = currentStatus === "loading" && !machine;
  const machineError = currentStatus === "error" && !machine;
  const readingsLoading = readingStatus === "loading" && readings.length === 0;
  const readingsEmpty =
    readingStatus === "succeeded" && merged.length === 0;
  const readingsFailed = readingStatus === "error" && merged.length === 0;

  function handleRangeChange(next) {
    setChartRange(next);
  }

  function summaryText() {
    return `${code} (${typeLabel}) — Status: ${status || "unknown"}`;
  }

  // ↗ Share the machine summary (native sheet, web navigator.share,
  // clipboard fallback with confirmation dialog).
  async function handleShare() {
    const text = summaryText();
    try {
      const result = await Share.share({ message: text });
      if (result.action === Share.dismissedAction) return;
    } catch {
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ title: code, text });
          return;
        }
        throw new Error("no-share");
      } catch {
        try {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            dialog.alert("Copied", "Machine summary copied to clipboard.", "success");
          } else {
            dialog.alert("Share", text);
          }
        } catch {
          dialog.alert("Share", text);
        }
      }
    }
  }

  async function handleCopyCode() {
    setMenuOpen(false);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(String(code));
        dialog.alert("Copied", `Machine code ${code} copied to clipboard.`, "success");
      } else {
        dialog.alert("Machine code", String(code));
      }
    } catch {
      dialog.alert("Machine code", String(code));
    }
  }

  async function handleDelete() {
    setMenuOpen(false);
    if (!machine) return;
    const ok = await dialog.confirm("Delete machine", `Remove ${code}? This cannot be undone.`, {
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await dispatch(deleteMachine(machine.id)).unwrap();
      router.replace("/(app)/machines");
    } catch {
      // Slice error state surfaces the failure.
    }
  }

  function OverviewBody() {
    return (
      <View>
        <View className={`mb-4 ${isDesktop ? "flex-row gap-3" : ""}`}>
          {isDesktop ? (
            metrics.map((m) => (
              <MetricCard
                key={m.id}
                label={m.label}
                value={m.value}
                unit={m.unit}
                delta={m.delta}
                icon={m.icon}
                iconBgClass={m.iconBgClass}
              />
            ))
          ) : (
            <View className="gap-3">
              <View className="flex-row gap-3">
                {metrics.slice(0, 2).map((m) => (
                  <MetricCard
                    key={m.id}
                    label={m.label}
                    value={m.value}
                    unit={m.unit}
                    delta={m.delta}
                    icon={m.icon}
                    iconBgClass={m.iconBgClass}
                  />
                ))}
              </View>
              <View className="flex-row gap-3">
                {metrics.slice(2, 4).map((m) => (
                  <MetricCard
                    key={m.id}
                    label={m.label}
                    value={m.value}
                    unit={m.unit}
                    delta={m.delta}
                    icon={m.icon}
                    iconBgClass={m.iconBgClass}
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        <Card>
          <View className={`${isDesktop ? "flex-row items-center justify-between mb-3" : "mb-3"}`}>
            <View className="flex-row items-center gap-2 mb-2">
              <Text className="text-base font-bold text-text font-inter">
                Live Sensor Data
              </Text>
              {!liveConnected && (
                <View className="px-2 py-0.5 rounded-chip bg-warning/15">
                  <Text className="text-[11px] font-medium text-warning font-inter">
                    reconnecting…
                  </Text>
                </View>
              )}
              {liveConnected && (
                <View className="px-2 py-0.5 rounded-chip bg-success/15">
                  <Text className="text-[11px] font-medium text-success font-inter">
                    live
                  </Text>
                </View>
              )}
            </View>
            <RangeTabs active={chartRange} onChange={handleRangeChange} />
          </View>

          {isDesktop && <ChartLegend items={legendItems} className="mb-2" />}

          {readingsLoading && (
            <View className="py-4">
              <Skeleton width="100%" height={16} className="mb-3" />
              <Skeleton width="100%" height={220} />
            </View>
          )}

          {readingsFailed && (
            <View className="py-4">
              <Text className="text-sm text-danger font-inter mb-3">
                {readingError?.message || "Failed to load readings"}
              </Text>
              <Button
                title="Retry"
                variant="outline"
                size="sm"
                onPress={() =>
                  dispatch(fetchReadings({ machineId, range: chartRange }))
                }
              />
            </View>
          )}

          {readingsEmpty && (
            <EmptyState
              title="No readings yet"
              message="Historical and live sensor points will appear here once the backend publishes data."
            />
          )}

          {!readingsLoading && !readingsFailed && !readingsEmpty && (
            <>
              <LineChart
                series={chartSeries}
                height={isDesktop ? 280 : 240}
                yMin={0}
                yMax={200}
                pulseLast={liveConnected}
              />
              {!isDesktop && <ChartLegend items={legendItems} className="mt-3" />}
            </>
          )}
        </Card>
      </View>
    );
  }

  function ComingSoon() {
    return (
      <Card>
        <EmptyState title="Coming soon" message="This tab is not built yet." />
      </Card>
    );
  }

  if (!canAccess("machines")) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            title="Restricted area"
            message="Machine details are visible to administrators and responsables industriels."
            action={<Button title="Go to Factory Map" variant="primary" size="sm" onPress={() => router.replace(homeRoute)} />}
          />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {isDesktop ? (
          <View className="mb-4">
            <Breadcrumb
              items={[
                { label: "Machines", onPress: () => router.push("/(app)/machines") },
                { label: String(code) },
              ]}
            />
            <View className="flex-row items-start justify-between">
              <View className="flex-1 mr-4">
                <Text className="text-2xl font-bold text-text font-inter">{code}</Text>
                <Text className="text-sm text-text-muted font-inter mt-0.5">
                  {typeLabel}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                {status ? <StatusBadge status={status} /> : null}
                <Pressable
                  onPress={handleShare}
                  accessibilityLabel="Share machine"
                  className="w-9 h-9 rounded-btn border border-border items-center justify-center bg-surface"
                >
                  <Text className="text-text-muted">↗</Text>
                </Pressable>
                <View className="relative">
                  <Pressable
                    onPress={() => setMenuOpen((v) => !v)}
                    accessibilityLabel="Machine actions"
                    className="w-9 h-9 rounded-btn border border-border items-center justify-center bg-surface"
                  >
                    <Text className="text-text-muted">⋮</Text>
                  </Pressable>
                  {menuOpen && (
                    <View
                      className="absolute right-0 bg-surface border border-border rounded-card overflow-hidden"
                      style={{ top: 40, width: 180, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6, zIndex: 20 }}
                    >
                      {isAdmin && (
                        <Pressable
                          onPress={() => { setMenuOpen(false); setEditOpen(true); }}
                          className="px-4 py-3 border-b border-border"
                        >
                          <Text className="text-sm text-text font-inter">Edit machine</Text>
                        </Pressable>
                      )}
                      <Pressable onPress={handleCopyCode} className="px-4 py-3 border-b border-border">
                        <Text className="text-sm text-text font-inter">Copy machine code</Text>
                      </Pressable>
                      {isAdmin && (
                        <Pressable onPress={handleDelete} className="px-4 py-3">
                          <Text className="text-sm text-danger font-medium font-inter">Delete machine</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center flex-1 mr-2">
              <Pressable onPress={() => router.back()} className="pr-3 py-1">
                <Text className="text-xl text-text">←</Text>
              </Pressable>
              <Text className="text-lg font-bold text-text font-inter" numberOfLines={1}>
                {code}
              </Text>
            </View>
            {status ? <StatusBadge status={status} /> : null}
          </View>
        )}

        {machineLoading && (
          <Card className="mb-4">
            <Skeleton width="40%" height={20} className="mb-2" />
            <Skeleton width="60%" height={14} />
          </Card>
        )}

        {machineError && (
          <Card className="mb-4">
            <Text className="text-sm text-danger font-inter mb-3">
              {currentError?.message || "Failed to load machine"}
            </Text>
            <Button
              title="Retry"
              variant="outline"
              size="sm"
              onPress={() => dispatch(fetchMachineById(machineId))}
            />
          </Card>
        )}

        <View className="mb-4">
          <Tabs
            tabs={isDesktop ? WEB_TABS : MOBILE_TABS}
            active={tab}
            onChange={setTab}
            scrollable={!isDesktop}
          />
        </View>

        {tab === "overview" ? <OverviewBody /> : <ComingSoon />}
      </ScrollView>
      <AddMachineModal
        visible={editOpen}
        machine={machine}
        onClose={() => {
          setEditOpen(false);
          if (machineId) dispatch(fetchMachineById(machineId));
        }}
      />
    </AppShell>
  );
}
