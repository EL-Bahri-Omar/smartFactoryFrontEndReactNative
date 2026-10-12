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
import { View, Text, ScrollView, Pressable, Share, Modal, useWindowDimensions } from "react-native";
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
import { useDark } from "../../../src/hooks/useDark";
import { useRole, PERMISSIONS } from "../../../src/hooks/useRole";
import { useDialog } from "../../../src/components/dialog/DialogContext";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { useLiveTopic } from "../../../src/hooks/useLiveTopic";
import { fetchMachineById, deleteMachine } from "../../../src/store/slices/machineSlice";
import { fetchReadings } from "../../../src/store/slices/readingSlice";
import { fetchMachineSensors } from "../../../src/store/slices/sensorSlice";
import { fetchThresholds, saveThreshold, deleteThreshold } from "../../../src/store/slices/thresholdSlice";
import { getSensorStatus } from "../../../src/lib/status";
import { relativeTime } from "../../../src/lib/time";
import { SENSOR_TYPE, SENSOR_UNIT } from "../../../src/constants/roles";
import Input from "../../../src/components/Input";
import Toggle from "../../../src/components/Toggle";
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
  { key: "settings", label: "Settings" },
];

const THRESHOLD_TYPES = [
  SENSOR_TYPE.TEMPERATURE,
  SENSOR_TYPE.VIBRATION,
  SENSOR_TYPE.CURRENT,
  SENSOR_TYPE.RPM,
];

/** Build the editor form from the fetched threshold list. */
function formFromThresholds(list) {
  const out = {};
  for (const type of THRESHOLD_TYPES) {
    const found = (list || []).find((t) => t.sensorType === type);
    out[type] = {
      warningMin: found?.warningMin ?? "",
      warningMax: found?.warningMax ?? "",
      criticalMin: found?.criticalMin ?? "",
      criticalMax: found?.criticalMax ?? "",
      active: found?.active ?? true,
      configured: !!found,
    };
  }
  return out;
}

function numOrNull(x) {
  if (x === "" || x == null) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

/** Mirror of the backend validation (criticalMin<=warningMin<=warningMax<=criticalMax). */
function validateApiThresholds(values) {
  for (const type of THRESHOLD_TYPES) {
    const v = values?.[type] || {};
    const wMin = numOrNull(v.warningMin);
    const wMax = numOrNull(v.warningMax);
    const cMin = numOrNull(v.criticalMin);
    const cMax = numOrNull(v.criticalMax);
    for (const [key, n] of [["warning min", wMin], ["warning max", wMax], ["critical min", cMin], ["critical max", cMax]]) {
      if (Number.isNaN(n)) return `${type}: ${key} must be a number.`;
    }
    if (wMin != null && wMax != null && wMin > wMax) return `${type}: warning min cannot exceed warning max.`;
    if (cMin != null && cMax != null && cMin > cMax) return `${type}: critical min cannot exceed critical max.`;
    if (cMin != null && wMin != null && cMin > wMin) return `${type}: critical min cannot exceed warning min.`;
    if (wMax != null && cMax != null && wMax > cMax) return `${type}: warning max cannot exceed critical max.`;
  }
  return null;
}

export default function MachineDetailScreen() {
  const { id } = useLocalSearchParams();
  const machineId = Array.isArray(id) ? id[0] : id;
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dialog = useDialog();
  const { canAccess, homeRoute, hasPermission } = useRole();
  const isDesktop = useBreakpoint() === "desktop";
  const dark = useDark();

  const canWriteMachines = hasPermission(PERMISSIONS.MACHINE_WRITE);
  const canReadMachines = canAccess("machines");
  const canReadTelemetry = hasPermission(PERMISSIONS.READINGS_READ);
  const canReadThresholds = hasPermission(PERMISSIONS.THRESHOLD_READ);
  const canWriteThresholds = hasPermission(PERMISSIONS.THRESHOLD_WRITE);

  const {
    current,
    currentStatus,
    currentError,
    list,
  } = useAppSelector((s) => s.machine);
  const { list: readings, status: readingStatus, error: readingError } =
    useAppSelector((s) => s.reading);
  const { list: sensors, status: sensorStatus } = useAppSelector((s) => s.sensor);
  const { list: thresholdList, status: thresholdStatus } = useAppSelector((s) => s.threshold);
  const liveConnected = useAppSelector((s) => s.live.connected);

  const [tab, setTab] = useState("overview");
  const [chartRange, setChartRange] = useState("6h");
  const [livePoints, setLivePoints] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null); // { top, right } screen coords for the dropdown
  const [editOpen, setEditOpen] = useState(false);
  const lastLiveRef = useRef(null);
  const menuBtnRef = useRef(null);
  const { width: winWidth } = useWindowDimensions();

  // Open the ⋮ menu under its button (measured on screen so the Modal can
  // place it exactly). Falls back to a fixed top-right spot if measure fails.
  function toggleMenu() {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const node = menuBtnRef.current;
    if (node && node.measureInWindow) {
      node.measureInWindow((x, y, w, h) => {
        setMenuPos({ top: y + h + 6, right: Math.max(8, winWidth - (x + w)) });
        setMenuOpen(true);
      });
    } else {
      setMenuPos(null);
      setMenuOpen(true);
    }
  }

  // Threshold editor state — API model per type:
  // { warningMin, warningMax, criticalMin, criticalMax, active }.
  const [thr, setThr] = useState(null);
  const [thrError, setThrError] = useState(null);
  const [thrSaving, setThrSaving] = useState(false);

  const machineFromList = list.find(
    (m) => m.id === machineId || m.code === machineId || m.machineCode === machineId
  );
  const machine =
    current && (current.id === machineId || current.code === machineId || current.machineCode === machineId)
      ? current
      : machineFromList;

  // The backend broadcasts every reading to BOTH the Mongo-id topic and the
  // code topic. Prefer the code topic (stable, human-readable) once loaded.
  const destination = machine?.code
    ? `/topic/machines/${machine.code}/readings`
    : machineId
      ? `/topic/machines/${machineId}/readings`
      : null;
  const liveMessage = useLiveTopic(destination, { enabled: Boolean(destination) && canReadTelemetry });
  // Sensor ONLINE/OFFLINE flips arrive here (US19) — refresh the chips.
  const sensorTopic = machine?.code ? `/topic/machines/${machine.code}/sensors` : null;
  const sensorLiveMessage = useLiveTopic(sensorTopic, { enabled: Boolean(sensorTopic) });

  useEffect(() => {
    if (!machineId || !canReadMachines) return;
    dispatch(fetchMachineById(machineId));
    if (canReadTelemetry) dispatch(fetchReadings({ machineId, range: chartRange }));
  }, [dispatch, machineId, chartRange, canReadTelemetry, canReadMachines]);

  // Sensors resolve by Mongo id only — wait until the machine is loaded.
  useEffect(() => {
    if (machine?.id && canReadMachines) dispatch(fetchMachineSensors(machine.id));
  }, [dispatch, machine?.id, canReadMachines]);

  // Thresholds live in the `machine_thresholds` collection (THRESHOLD_READ).
  useEffect(() => {
    if (machine?.id && canReadThresholds) dispatch(fetchThresholds(machine.id));
  }, [dispatch, machine?.id, canReadThresholds]);

  // Threshold editor starts from the fetched thresholds.
  useEffect(() => {
    setThr(formFromThresholds(thresholdList));
    setThrError(null);
  }, [thresholdList]);

  // A sensor status push means something flipped — re-read the list.
  useEffect(() => {
    if (sensorLiveMessage && machine?.id) dispatch(fetchMachineSensors(machine.id));
  }, [dispatch, sensorLiveMessage, machine?.id]);

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

  // Save per-machine thresholds via PUT .../thresholds/:sensorType
  // (THRESHOLD_WRITE, upsert). Effective on the very next MQTT reading.
  async function handleSaveThresholds() {
    if (!machine?.id || !thr) return;
    const validationError = validateApiThresholds(thr);
    if (validationError) {
      setThrError(validationError);
      return;
    }
    setThrError(null);
    setThrSaving(true);
    try {
      for (const type of THRESHOLD_TYPES) {
        const v = thr[type];
        await dispatch(
          saveThreshold({
            machineId: machine.id,
            sensorType: type,
            body: {
              sensorType: type,
              warningMin: numOrNull(v.warningMin),
              warningMax: numOrNull(v.warningMax),
              criticalMin: numOrNull(v.criticalMin),
              criticalMax: numOrNull(v.criticalMax),
              unit: SENSOR_UNIT[type],
              active: v.active !== false,
            },
          })
        ).unwrap();
      }
      await dispatch(fetchThresholds(machine.id));
      dialog.alert("Thresholds saved", `Alert limits for ${code} apply from the next reading.`, "success");
    } catch (e) {
      setThrError(e?.message || "Failed to save thresholds.");
    } finally {
      setThrSaving(false);
    }
  }

  async function handleResetThreshold(type) {
    if (!machine?.id) return;
    const ok = await dialog.confirm(
      "Reset threshold",
      `Remove the stored ${type} limits for ${code}? The backend falls back to its reference defaults.`,
      { confirmText: "Reset" }
    );
    if (!ok) return;
    try {
      await dispatch(deleteThreshold({ machineId: machine.id, sensorType: type })).unwrap();
      await dispatch(fetchThresholds(machine.id));
    } catch (e) {
      setThrError(e?.message || "Failed to reset threshold.");
    }
  }

  function OverviewBody() {
    const sensorByType = {};
    (sensors || []).forEach((s) => {
      if (s?.type) sensorByType[s.type] = s;
    });

    function SensorChips() {
      if (sensorStatus === "loading" && sensors.length === 0) {
        return (
          <Card className="mb-4">
            <Skeleton width="40%" height={16} className="mb-3" />
            <Skeleton width="100%" height={44} />
          </Card>
        );
      }
      if (sensors.length === 0) {
        return (
          <Card className="mb-4">
            <EmptyState
              title="No sensors yet"
              message="Sensors provision automatically once this machine publishes its first reading."
            />
          </Card>
        );
      }
      return (
        <Card className="mb-4">
          <Text className={`text-base font-bold font-inter mb-1 ${dark ? "text-white" : "text-text"}`}>Sensors</Text>
          <Text className={`text-xs font-inter mb-3 ${dark ? "text-white/60" : "text-text-muted"}`}>
            Live ONLINE / OFFLINE state from the backend (US19).
          </Text>
          <View className={`${isDesktop ? "flex-row gap-2" : "gap-2"}`}>
            {SERIES_META.map((meta) => {
              const s = sensorByType[meta.id];
              const st = getSensorStatus(s?.status);
              return (
                <View
                  key={meta.id}
                  className={`flex-row items-center gap-2 px-3 py-2 rounded-btn border ${dark ? "border-white/10 bg-white/5" : "border-border bg-bg"} ${isDesktop ? "flex-1" : ""}`}
                >
                  <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: st.dotColor }} />
                  <View className="flex-1">
                    <Text className={`text-sm font-bold font-inter ${dark ? "text-white" : "text-text"}`}>{meta.label}</Text>
                    <Text className={`text-[11px] font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                      {s ? `${st.label} · ${s.unit || meta.unit} · seen ${s.lastSeen ? relativeTime(s.lastSeen) : "—"}` : "Not provisioned yet"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      );
    }

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

        {SensorChips()}

        {!canReadTelemetry ? (
          <Card>
            <EmptyState
              title="Restricted area"
              message="Telemetry requires the READINGS_READ permission."
            />
          </Card>
        ) : (
        <Card>
          <View className={`${isDesktop ? "flex-row items-center justify-between mb-3" : "mb-3"}`}>
            <View className="flex-row items-center gap-2 mb-2">
              <Text className={`text-base font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
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
        )}
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

  function SettingsBody() {
    if (!machine) {
      return (
        <Card>
          <Skeleton width="60%" height={16} />
        </Card>
      );
    }
    if (!canReadThresholds) {
      return (
        <Card>
          <EmptyState
            title="Restricted area"
            message="Viewing thresholds requires the THRESHOLD_READ permission."
          />
        </Card>
      );
    }
    const custom = thresholdList.length > 0;
    const units = {
      [SENSOR_TYPE.TEMPERATURE]: "°C",
      [SENSOR_TYPE.VIBRATION]: "mm/s",
      [SENSOR_TYPE.CURRENT]: "A",
      [SENSOR_TYPE.RPM]: "RPM",
    };
    const editable = canWriteThresholds && !thrSaving;
    function setThrValue(type, key, text) {
      setThr((prev) => ({ ...prev, [type]: { ...prev?.[type], [key]: text } }));
    }
    // Plain helper (called as a function, not <ThrField/>) so the
    // TextInputs keep focus while typing.
    function ThrField({ type, fieldKey, label }) {
      return (
        <View className="flex-1">
          <Input
            label={`${label} (${units[type]})`}
            placeholder="—"
            value={thr?.[type]?.[fieldKey] === "" || thr?.[type]?.[fieldKey] == null ? "" : String(thr[type][fieldKey])}
            onChangeText={(t) => setThrValue(type, fieldKey, t)}
            keyboardType="numeric"
            disabled={!editable}
          />
        </View>
      );
    }
    function TypeSection({ type, fields }) {
      const configured = (thresholdList || []).some((t) => t.sensorType === type);
      return (
        <View key={type} className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: configured ? "#16A34A" : "#94A3B8" }}
              />
              <Text className={`text-sm font-bold font-inter capitalize ${dark ? "text-white" : "text-text"}`}>
                {type.toLowerCase()}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              {configured && canWriteThresholds && (
                <Pressable onPress={() => handleResetThreshold(type)}>
                  <Text className="text-xs text-danger font-medium font-inter">Reset</Text>
                </Pressable>
              )}
              <Toggle
                value={thr?.[type]?.active !== false}
                onChange={(v) => setThrValue(type, "active", v)}
                disabled={!editable}
              />
            </View>
          </View>
          <View className="flex-row gap-3 mb-3">
            {fields.slice(0, 2).map((f) => ThrField({ type, fieldKey: f.key, label: f.label }))}
          </View>
          {fields.length > 2 && (
            <View className="flex-row gap-3">
              {fields.slice(2).map((f) => ThrField({ type, fieldKey: f.key, label: f.label }))}
            </View>
          )}
        </View>
      );
    }
    return (
      <Card>
        <View className="flex-row items-center gap-2 mb-1">
          <Text className={`text-base font-bold font-inter ${dark ? "text-white" : "text-text"}`}>Alert Thresholds</Text>
          <View className={`px-2 py-0.5 rounded-chip ${custom ? "bg-success/15" : dark ? "bg-white/10" : "bg-bg"}`}>
            <Text className={`text-[11px] font-medium font-inter ${custom ? "text-success" : dark ? "text-white/60" : "text-text-muted"}`}>
              {custom ? "custom" : "backend defaults"}
            </Text>
          </View>
        </View>
        <Text className={`text-xs font-inter mb-4 ${dark ? "text-white/60" : "text-text-muted"}`}>
          Per-machine alert limits, stored in the database. The backend enforces
          them from the very next reading.
          {!canWriteThresholds && " Only users with THRESHOLD_WRITE can change them."}
        </Text>

        {thresholdStatus === "loading" && !thr && (
          <View className="gap-3 mb-4">
            <Skeleton width="100%" height={52} />
            <Skeleton width="100%" height={52} />
          </View>
        )}

        {thrError && (
          <View className="rounded-btn px-3 py-2.5 mb-4" style={{ backgroundColor: "rgba(220,38,38,0.1)", borderWidth: 1, borderColor: "rgba(220,38,38,0.3)" }}>
            <Text className="text-sm text-danger font-inter">{thrError}</Text>
          </View>
        )}

        {[SENSOR_TYPE.TEMPERATURE, SENSOR_TYPE.VIBRATION, SENSOR_TYPE.CURRENT].map((type) =>
          TypeSection({
            type,
            fields: [
              { key: "warningMax", label: "Warning ≥" },
              { key: "criticalMax", label: "Critical ≥" },
            ],
          })
        )}
        {TypeSection({
          type: SENSOR_TYPE.RPM,
          fields: [
            { key: "warningMin", label: "Warn low ≤" },
            { key: "warningMax", label: "Warn high ≥" },
            { key: "criticalMin", label: "Critical low ≤" },
            { key: "criticalHigh", label: "Critical high ≥" },
          ],
        })}

        {canWriteThresholds && (
          <Button
            title="Save Thresholds"
            variant="primary"
            onPress={handleSaveThresholds}
            loading={thrSaving}
            disabled={!thr}
          />
        )}
      </Card>
    );
  }

  if (!canAccess("machines")) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            title="Restricted area"
            message="Machine details require the MACHINE_READ permission."
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
                <Text className={`text-2xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>{code}</Text>
                <Text className={`text-sm font-inter mt-0.5 ${dark ? "text-white/60" : "text-text-muted"}`}>
                  {typeLabel}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                {status ? <StatusBadge status={status} /> : null}
                <Pressable
                  onPress={handleShare}
                  accessibilityLabel="Share machine"
                  className={`w-9 h-9 rounded-btn border items-center justify-center ${dark ? "border-white/15 bg-white/5" : "border-border bg-surface"}`}
                >
                  <Text className={dark ? "text-white/70" : "text-text-muted"}>↗</Text>
                </Pressable>
                <Pressable
                  ref={menuBtnRef}
                  onPress={toggleMenu}
                  accessibilityLabel="Machine actions"
                  className={`w-9 h-9 rounded-btn border items-center justify-center ${dark ? "border-white/15 bg-white/5" : "border-border bg-surface"}`}
                >
                  <Text className={dark ? "text-white/70" : "text-text-muted"}>⋮</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center flex-1 mr-2">
              <Pressable onPress={() => router.back()} className="pr-3 py-1">
                <Text className={`text-xl ${dark ? "text-white" : "text-text"}`}>←</Text>
              </Pressable>
              <Text className={`text-lg font-bold font-inter ${dark ? "text-white" : "text-text"}`} numberOfLines={1}>
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

        {tab === "overview" ? OverviewBody() : tab === "settings" ? SettingsBody() : ComingSoon()}
      </ScrollView>
      {/* ⋮ dropdown — Modal so it floats above everything (never clipped)
          and any tap outside closes it. */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setMenuOpen(false)}
          />
          <View
            className={`absolute rounded-card overflow-hidden border ${dark ? "bg-darkcard border-white/15" : "bg-surface border-border"}`}
            style={{
              top: menuPos?.top ?? 120,
              right: menuPos?.right ?? 16,
              width: 210,
              shadowColor: "#0F172A",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.18,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            {canWriteMachines && (
              <Pressable
                onPress={() => { setMenuOpen(false); setEditOpen(true); }}
                className={`px-4 py-3 border-b ${dark ? "border-white/10" : "border-border"}`}
                style={({ pressed }) => (pressed ? { backgroundColor: dark ? "rgba(255,255,255,0.08)" : "#F0F4FA" } : {})}
              >
                <Text className={`text-sm font-inter ${dark ? "text-white" : "text-text"}`}>Edit machine</Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleCopyCode}
              className={canWriteMachines ? `px-4 py-3 border-b ${dark ? "border-white/10" : "border-border"}` : "px-4 py-3"}
              style={({ pressed }) => (pressed ? { backgroundColor: dark ? "rgba(255,255,255,0.08)" : "#F0F4FA" } : {})}
            >
              <Text className={`text-sm font-inter ${dark ? "text-white" : "text-text"}`}>Copy machine code</Text>
            </Pressable>
            {canWriteMachines && (
              <Pressable
                onPress={handleDelete}
                className="px-4 py-3"
                style={({ pressed }) => (pressed ? { backgroundColor: "rgba(220,38,38,0.08)" } : {})}
              >
                <Text className="text-sm text-danger font-medium font-inter">Delete machine</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
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
