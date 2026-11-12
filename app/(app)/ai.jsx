// app/(app)/ai.jsx — Sprint 11: AI Analytics & Predictions
//
// Real-time AI predictions from the SmartFactory inference service.
// Shows per-machine fault classification results, anomaly scores,
// and live prediction updates via WebSocket.
//
// Data sources:
//   REST: GET /api/anomalies (filtered for thresholdType=AI_MODEL)
//   WS:   /topic/ai-predictions (global AI prediction feed)

import { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, TextInput } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import EmptyState from "../../src/components/EmptyState";
import StatusBadge from "../../src/components/StatusBadge";
import SeverityBadge from "../../src/components/SeverityBadge";
import Skeleton from "../../src/components/Skeleton";
import Tabs from "../../src/components/Tabs";
import InterventionModal from "../../src/components/InterventionModal";
import { useDark } from "../../src/hooks/useDark";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useRole } from "../../src/hooks/useRole";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useLiveTopic } from "../../src/hooks/useLiveTopic";
import { fetchAiPredictions, pushLivePrediction } from "../../src/store/slices/aiSlice";
import { fetchMachines } from "../../src/store/slices/machineSlice";
import { relativeTime } from "../../src/lib/time";

// ── Constants ──────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  normal: { label: "Normal", color: "#22C55E", bgLight: "bg-green-50", bgDark: "bg-success/10", textColor: "text-success" },
  degradation: { label: "Degradation", color: "#F59E0B", bgLight: "bg-amber-50", bgDark: "bg-warning/10", textColor: "text-warning" },
  anomaly: { label: "Anomaly", color: "#F97316", bgLight: "bg-orange-50", bgDark: "bg-orange-500/10", textColor: "text-orange-500" },
  failure: { label: "Failure", color: "#EF4444", bgLight: "bg-red-50", bgDark: "bg-danger/10", textColor: "text-danger" },
};

const TABS = [
  { key: "live", label: "Live Predictions" },
  { key: "history", label: "Prediction History" },
];

const SEVERITY_FILTERS = [
  { key: "all", label: "All" },
  { key: "HIGH", label: "High" },
  { key: "WARNING", label: "Medium" },
];

// ── Helpers ────────────────────────────────────────────────────────────

function getStatusConfig(status) {
  return STATUS_CONFIG[status?.toLowerCase()] || STATUS_CONFIG.normal;
}

function confidencePercent(confidence) {
  if (confidence == null) return "—";
  return `${(confidence * 100).toFixed(1)}%`;
}

function anomalyScoreLabel(score) {
  if (score == null) return "—";
  return score.toFixed(3);
}

/** Format estimated hours to a human-readable string */
function formatTimeToEvent(hours) {
  if (hours == null) return null;
  if (hours <= 0) return "Imminent";
  if (hours < 1) return `in ~${Math.round(hours * 60)} min`;
  if (hours < 2) return `in ~${hours.toFixed(1)} hour`;
  return `in ~${hours.toFixed(1)} hours`;
}

/** Format estimated hours to minutes string */
function formatMinutes(hours) {
  if (hours == null) return null;
  if (hours <= 0) return "< 1 min";
  const mins = Math.round(hours * 60);
  if (mins < 60) return `~${mins} min`;
  return `~${hours.toFixed(1)} hours`;
}

/** Extract problem sensor types from driving sensors or features */
function getProblemSensors(prediction) {
  const sensors = [];
  const ds = prediction.drivingSensors || [];
  ds.forEach((s) => {
    if (s.sensor && s.sensor !== "model" && s.sensor !== "all") {
      sensors.push(s.sensor.charAt(0).toUpperCase() + s.sensor.slice(1));
    }
  });
  // Fallback: check feature values if no driving sensors
  if (sensors.length === 0) {
    if (prediction.temperatureMean != null && prediction.temperatureMean > 60) sensors.push("Temperature");
    if (prediction.vibrationRms != null && prediction.vibrationRms > 5) sensors.push("Vibration");
    if (prediction.currentMean != null && prediction.currentMean > 8) sensors.push("Current");
    if (prediction.rpmMean != null && prediction.rpmMean < 800) sensors.push("RPM");
  }
  return sensors;
}

// ── Components ─────────────────────────────────────────────────────────

/** AI Status badge with color coding. */
function AiStatusBadge({ status }) {
  const dark = useDark();
  const cfg = getStatusConfig(status);
  return (
    <View className={`px-2.5 py-1 rounded-chip ${dark ? cfg.bgDark : cfg.bgLight}`}>
      <Text className={`text-xs font-semibold font-inter ${cfg.textColor}`}>
        {cfg.label}
      </Text>
    </View>
  );
}

/** Summary KPI card for the top row. */
function KpiCard({ label, value, sublabel, color }) {
  const dark = useDark();
  return (
    <Card className="flex-1 min-w-[140px]">
      <Text className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}>
        {label}
      </Text>
      <Text
        className="text-2xl font-bold font-inter"
        style={{ color: color || (dark ? "#fff" : "#1a1a1a") }}
      >
        {value}
      </Text>
      {sublabel && (
        <Text className={`text-[11px] font-inter mt-0.5 ${dark ? "text-white/40" : "text-text-muted"}`}>
          {sublabel}
        </Text>
      )}
    </Card>
  );
}

/** Single AI prediction card — one per machine. */
function PredictionCard({ prediction, isLive, onPress, onCreateIntervention }) {
  const dark = useDark();
  const isDesktop = useBreakpoint() === "desktop";

  const machineCode = prediction.machineCode || prediction.machineId || "—";
  const status = prediction.predictedStatus || prediction.message?.match(/normal|degradation|anomaly|failure/i)?.[0] || "unknown";
  const confidence = prediction.confidence ?? prediction.observedValue;
  const anomalyScore = prediction.anomalyScore ?? prediction.thresholdValue;
  const severity = prediction.severity;
  const timestamp = prediction.timestamp || prediction.createdAt;
  const tempMean = prediction.temperatureMean;
  const vibRms = prediction.vibrationRms;
  const currentMean = prediction.currentMean;
  const rpmMean = prediction.rpmMean;
  const estimatedHours = prediction.estimatedHoursToEvent;
  const drivingSensors = prediction.drivingSensors || [];
  const recommendedFix = prediction.recommendedFix;
  const cfg = getStatusConfig(status);
  const timeLabel = formatTimeToEvent(estimatedHours);
  const problemSensors = getProblemSensors(prediction);
  const etaMinutes = formatMinutes(estimatedHours);

  return (
    <Pressable onPress={onPress}>
      <Card className="mb-3">
        {/* Header: machine code + status badge + severity + timestamp */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2 flex-1">
            {/* AI pulsing dot for live predictions */}
            {isLive && (
              <View
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
            )}
            <Text className={`text-base font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
              {machineCode}
            </Text>
            <AiStatusBadge status={status} />
            {severity && severity !== "INFO" && <SeverityBadge severity={severity} />}
          </View>
          <Text className={`text-[11px] font-inter ${dark ? "text-white/40" : "text-text-muted"}`}>
            {timestamp ? relativeTime(timestamp) : "—"}
          </Text>
        </View>

        {/* Time-to-event banner */}
        {timeLabel && status !== "normal" && (
          <View
            className="flex-row items-center gap-2 px-3 py-2 rounded-btn mb-2"
            style={{ backgroundColor: cfg.color + "18" }}
          >
            <Text style={{ fontSize: 14 }}>⏱️</Text>
            <Text className="text-xs font-bold font-inter" style={{ color: cfg.color }}>
              {status === "failure" ? "Failure" : status === "anomaly" ? "Anomaly" : "Degradation"} predicted {timeLabel}
            </Text>
          </View>
        )}

        {/* Problem details: sensor type + estimated time in minutes */}
        {status !== "normal" && (problemSensors.length > 0 || etaMinutes) && (
          <View className={`flex-row flex-wrap items-center gap-2 mb-2 px-1`}>
            {problemSensors.length > 0 && (
              <View className="flex-row items-center gap-1">
                <Text style={{ fontSize: 11 }}>🔍</Text>
                <Text className={`text-[11px] font-semibold font-inter ${dark ? "text-white/70" : "text-text"}`}>
                  Problem: {problemSensors.join(", ")}
                </Text>
              </View>
            )}
            {etaMinutes && (
              <View className="flex-row items-center gap-1">
                <Text style={{ fontSize: 11 }}>⏳</Text>
                <Text className={`text-[11px] font-semibold font-inter ${dark ? "text-white/70" : "text-text"}`}>
                  ETA: {etaMinutes}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Metrics row */}
        <View className={`${isDesktop ? "flex-row gap-4" : "flex-row flex-wrap gap-3"}`}>
          <View className="min-w-[80px]">
            <Text className={`text-[10px] font-inter uppercase ${dark ? "text-white/40" : "text-text-muted"}`}>
              Confidence
            </Text>
            <Text className={`text-sm font-semibold font-inter ${dark ? "text-white" : "text-text"}`}>
              {confidencePercent(confidence)}
            </Text>
          </View>
          <View className="min-w-[80px]">
            <Text className={`text-[10px] font-inter uppercase ${dark ? "text-white/40" : "text-text-muted"}`}>
              Anomaly Score
            </Text>
            <Text className={`text-sm font-semibold font-inter ${dark ? "text-white" : "text-text"}`}>
              {anomalyScoreLabel(anomalyScore)}
            </Text>
          </View>
          {tempMean != null && (
            <View className="min-w-[70px]">
              <Text className={`text-[10px] font-inter uppercase ${dark ? "text-white/40" : "text-text-muted"}`}>
                Temp
              </Text>
              <Text className={`text-sm font-inter ${dark ? "text-white/80" : "text-text"}`}>
                {tempMean.toFixed(1)}°C
              </Text>
            </View>
          )}
          {vibRms != null && (
            <View className="min-w-[70px]">
              <Text className={`text-[10px] font-inter uppercase ${dark ? "text-white/40" : "text-text-muted"}`}>
                Vibration
              </Text>
              <Text className={`text-sm font-inter ${dark ? "text-white/80" : "text-text"}`}>
                {vibRms.toFixed(2)} mm/s
              </Text>
            </View>
          )}
          {currentMean != null && (
            <View className="min-w-[70px]">
              <Text className={`text-[10px] font-inter uppercase ${dark ? "text-white/40" : "text-text-muted"}`}>
                Current
              </Text>
              <Text className={`text-sm font-inter ${dark ? "text-white/80" : "text-text"}`}>
                {currentMean.toFixed(1)} A
              </Text>
            </View>
          )}
          {rpmMean != null && (
            <View className="min-w-[70px]">
              <Text className={`text-[10px] font-inter uppercase ${dark ? "text-white/40" : "text-text-muted"}`}>
                RPM
              </Text>
              <Text className={`text-sm font-inter ${dark ? "text-white/80" : "text-text"}`}>
                {rpmMean.toFixed(0)}
              </Text>
            </View>
          )}
        </View>

        {/* Driving sensors detail */}
        {drivingSensors.length > 0 && (
          <View className={`mt-2 pt-2 ${dark ? "border-t border-white/10" : "border-t border-border/50"}`}>
            <Text className={`text-[10px] font-inter uppercase mb-1.5 ${dark ? "text-white/40" : "text-text-muted"}`}>
              Driving Sensors
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {drivingSensors.map((s, i) => {
                const sensorName = String(s.sensor || "sensor").charAt(0).toUpperCase() + String(s.sensor || "sensor").slice(1);
                const timeStr = s.estimatedHours != null ? formatTimeToEvent(s.estimatedHours) : null;
                const isExceeded = s.status === "exceeded";
                return (
                  <View
                    key={i}
                    className="px-2 py-1.5 rounded-btn"
                    style={{ backgroundColor: dark ? "rgba(255,255,255,0.06)" : "#F1F5F9" }}
                  >
                    <View className="flex-row items-center gap-1">
                      <Text style={{ fontSize: 8, color: isExceeded ? "#EF4444" : s.trendDirection === "rising" ? "#F59E0B" : "#94A3B8" }}>
                        {isExceeded ? "🔴" : s.trendDirection === "rising" ? "📈" : "—"}
                      </Text>
                      <Text className={`text-[11px] font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                        {sensorName}
                      </Text>
                    </View>
                    {s.currentValue != null && (
                      <Text className={`text-[10px] font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                        {s.currentValue} → {s.threshold}
                      </Text>
                    )}
                    {timeStr && !isExceeded && (
                      <Text className="text-[10px] font-bold font-inter" style={{ color: "#F59E0B" }}>
                        {timeStr}
                      </Text>
                    )}
                    {isExceeded && (
                      <Text className="text-[10px] font-bold font-inter" style={{ color: "#EF4444" }}>
                        Threshold exceeded
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Recommended fix */}
        {recommendedFix && (
          <View
            className={`mt-2 pt-2 ${dark ? "border-t border-white/10" : "border-t border-border/50"}`}
          >
            <View
              className={`rounded-lg p-3 ${dark ? "bg-primary/10" : "bg-indigo-50"}`}
            >
              <View className="flex-row items-center gap-1.5 mb-1">
                <Text style={{ fontSize: 12 }}>💡</Text>
                <Text className={`text-[10px] font-bold font-inter uppercase ${dark ? "text-primary" : "text-indigo-700"}`}>
                  Recommended Fix
                </Text>
              </View>
              <Text
                className={`text-xs font-inter leading-4 ${dark ? "text-white/80" : "text-gray-700"}`}
                numberOfLines={6}
              >
                {recommendedFix}
              </Text>
            </View>
          </View>
        )}

        {/* Message */}
        {prediction.message && (
          <Text
            className={`text-xs font-inter mt-2 ${dark ? "text-white/50" : "text-text-muted"}`}
            numberOfLines={2}
          >
            {prediction.message}
          </Text>
        )}

        {/* Create Intervention button — only for non-normal predictions */}
        {status !== "normal" && onCreateIntervention && (
          <View className={`mt-3 pt-2 ${dark ? "border-t border-white/10" : "border-t border-border/30"}`}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onCreateIntervention(prediction);
              }}
              className={`flex-row items-center justify-center gap-2 py-2.5 px-4 rounded-btn ${
                dark ? "bg-primary/20" : "bg-primary/10"
              }`}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={{ fontSize: 14 }}>🔧</Text>
              <Text className="text-xs font-bold font-inter text-primary">
                Create Intervention
              </Text>
            </Pressable>
          </View>
        )}
      </Card>
    </Pressable>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────

export default function AiAnalyticsScreen() {
  const dark = useDark();
  const isDesktop = useBreakpoint() === "desktop";
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { role } = useRole();

  const { list, liveByMachine, status, error } = useAppSelector((s) => s.ai);
  const machines = useAppSelector((s) => s.machines?.list || []);
  const [tab, setTab] = useState("live");
  const [refreshing, setRefreshing] = useState(false);

  // Sprint 11 — History tab filters
  const [historySeverityFilter, setHistorySeverityFilter] = useState("all");
  const [historyMachineFilter, setHistoryMachineFilter] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");

  // Intervention modal state
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [interventionPrefill, setInterventionPrefill] = useState(null);

  // Subscribe to global AI predictions topic
  const livePrediction = useLiveTopic("/topic/ai-predictions", { enabled: true });

  // Push live predictions to the AI slice
  useEffect(() => {
    if (livePrediction && livePrediction.eventType === "AI_PREDICTION") {
      dispatch(pushLivePrediction(livePrediction));
    }
  }, [dispatch, livePrediction]);

  // Fetch historical AI predictions + machines list on mount
  useEffect(() => {
    dispatch(fetchAiPredictions({ status: "", size: 200 }));
    dispatch(fetchMachines({ size: 500 }));
  }, [dispatch]);

  // Pull-to-refresh
  async function handleRefresh() {
    setRefreshing(true);
    await dispatch(fetchAiPredictions({ status: "", size: 200 })).unwrap().catch(() => {});
    setRefreshing(false);
  }

  // Deduplicate live predictions — liveByMachine dual-indexes by machineId AND machineCode
  const livePredictions = useMemo(() => {
    const seen = new Set();
    return Object.values(liveByMachine)
      .filter((p) => {
        const uid = p.machineId || p.machineCode;
        if (seen.has(uid)) return false;
        seen.add(uid);
        return true;
      })
      .sort(
        (a, b) => new Date(b.timestamp || b.receivedAt) - new Date(a.timestamp || a.receivedAt)
      );
  }, [liveByMachine]);

  const historicalPredictions = useMemo(() => {
    return [...list].sort(
      (a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt)
    );
  }, [list]);

  // Sprint 11 — filtered history (severity + machine dropdown + date range)
  const filteredHistory = useMemo(() => {
    let result = historicalPredictions;

    // Severity filter
    if (historySeverityFilter !== "all") {
      result = result.filter((p) => p.severity === historySeverityFilter);
    }

    // Machine filter (by code from dropdown)
    if (historyMachineFilter) {
      result = result.filter((p) => {
        const code = p.machineCode || p.machineId || "";
        return code === historyMachineFilter;
      });
    }

    // Date range
    if (historyDateFrom) {
      const from = new Date(historyDateFrom);
      if (!isNaN(from.getTime())) {
        result = result.filter((p) => new Date(p.timestamp || p.createdAt) >= from);
      }
    }
    if (historyDateTo) {
      const to = new Date(historyDateTo);
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        result = result.filter((p) => new Date(p.timestamp || p.createdAt) <= to);
      }
    }
    return result;
  }, [historicalPredictions, historySeverityFilter, historyMachineFilter, historyDateFrom, historyDateTo]);

  // Unique machine codes from predictions for the dropdown
  const historyMachineCodes = useMemo(() => {
    const codes = new Set();
    historicalPredictions.forEach((p) => {
      const c = p.machineCode || p.machineId;
      if (c) codes.add(c);
    });
    return [...codes].sort();
  }, [historicalPredictions]);

  // KPI calculations
  const kpis = useMemo(() => {
    const allPreds = livePredictions.length > 0 ? livePredictions : historicalPredictions;
    const total = allPreds.length;
    const byStatus = { normal: 0, degradation: 0, anomaly: 0, failure: 0 };
    allPreds.forEach((p) => {
      const s = (p.predictedStatus || "normal").toLowerCase();
      if (byStatus[s] !== undefined) byStatus[s]++;
    });
    const abnormal = byStatus.degradation + byStatus.anomaly + byStatus.failure;
    return { total, ...byStatus, abnormal };
  }, [livePredictions, historicalPredictions]);

  const loading = status === "loading" && list.length === 0;
  const isEmpty = status === "succeeded" && list.length === 0 && livePredictions.length === 0;

  function navigateToMachine(prediction) {
    const id = prediction.machineId || prediction.machineCode;
    if (id) router.push(`/(app)/machines/${id}`);
  }

  // Create intervention from prediction
  const handleCreateIntervention = useCallback((prediction) => {
    const machineCode = prediction.machineCode || prediction.machineId || "";
    const status = (prediction.predictedStatus || "").toLowerCase();
    const problemSensors = getProblemSensors(prediction);
    const etaMin = prediction.estimatedHoursToEvent != null
      ? formatMinutes(prediction.estimatedHoursToEvent)
      : "";

    const title = `AI Prediction — ${status.charAt(0).toUpperCase() + status.slice(1)} detected on ${machineCode}`;
    const descParts = [`AI predicted ${status} on machine ${machineCode}.`];
    if (problemSensors.length > 0) descParts.push(`Problem sensors: ${problemSensors.join(", ")}.`);
    if (etaMin) descParts.push(`Estimated time to event: ${etaMin}.`);
    if (prediction.recommendedFix) descParts.push(`Recommended fix: ${prediction.recommendedFix}`);

    setInterventionPrefill({
      machineId: prediction.machineId || prediction.machineCode,
      machineCode,
      anomalyId: prediction.anomalyId || prediction.id,
      title,
      description: descParts.join("\n"),
      priority: status === "failure" ? "HIGH" : status === "anomaly" ? "HIGH" : "MEDIUM",
    });
    setInterventionOpen(true);
  }, []);

  const hasActiveFilters = historySeverityFilter !== "all" || historyMachineFilter || historyDateFrom || historyDateTo;

  return (
    <AppShell>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <Text className={`text-2xl font-bold font-inter mb-1 ${dark ? "text-white" : "text-text"}`}>
          AI Analytics
        </Text>
        <Text className={`text-sm font-inter mb-5 ${dark ? "text-white/60" : "text-text-muted"}`}>
          Real-time fault classification and anomaly detection powered by the SmartFactory AI model.
        </Text>

        {/* KPI Summary Cards */}
        <View className={`mb-4 ${isDesktop ? "flex-row gap-3" : "gap-3"}`}>
          {isDesktop ? (
            <>
              <KpiCard label="Machines Monitored" value={kpis.total} sublabel="Active AI predictions" />
              <KpiCard label="Normal" value={kpis.normal} color="#22C55E" sublabel="Healthy machines" />
              <KpiCard label="Degradation" value={kpis.degradation} color="#F59E0B" sublabel="Warning level" />
              <KpiCard label="Anomaly / Failure" value={kpis.anomaly + kpis.failure} color="#EF4444" sublabel="Requires attention" />
            </>
          ) : (
            <>
              <View className="flex-row gap-3">
                <KpiCard label="Monitored" value={kpis.total} />
                <KpiCard label="Normal" value={kpis.normal} color="#22C55E" />
              </View>
              <View className="flex-row gap-3">
                <KpiCard label="Degradation" value={kpis.degradation} color="#F59E0B" />
                <KpiCard label="Critical" value={kpis.anomaly + kpis.failure} color="#EF4444" />
              </View>
            </>
          )}
        </View>

        {/* Tabs */}
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-4" />

        {/* Loading state */}
        {loading && (
          <View className="gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <Skeleton width="60%" height={18} className="mb-2" />
                <Skeleton width="100%" height={50} />
              </Card>
            ))}
          </View>
        )}

        {/* Error state */}
        {status === "error" && (
          <Card>
            <Text className="text-sm text-danger font-inter mb-2">
              {typeof error === "string" ? error : "Failed to load AI predictions."}
            </Text>
            <Button
              title="Retry"
              variant="outline"
              size="sm"
              onPress={() => dispatch(fetchAiPredictions({ status: "", size: 200 }))}
            />
          </Card>
        )}

        {/* Empty state */}
        {isEmpty && !loading && (
          <Card>
            <EmptyState
              title="No AI predictions yet"
              message="Predictions will appear here once the SmartFactory AI inference service is running and processing sensor data from the MQTT broker."
              action={
                <View className="flex-row gap-2">
                  <Button
                    title="Open Alerts"
                    variant="primary"
                    size="sm"
                    onPress={() => router.push("/(app)/alerts")}
                  />
                  <Button
                    title="View Machines"
                    variant="outline"
                    size="sm"
                    onPress={() => router.push("/(app)/machines")}
                  />
                </View>
              }
            />
          </Card>
        )}

        {/* Live Predictions Tab */}
        {tab === "live" && !loading && (
          <View>
            {livePredictions.length > 0 ? (
              <>
                <View className={`flex-row items-center gap-2 mb-3 px-1`}>
                  <View className="w-2 h-2 rounded-full bg-success" />
                  <Text className={`text-xs font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                    {livePredictions.length} live prediction{livePredictions.length !== 1 ? "s" : ""} — updates in real-time via WebSocket
                  </Text>
                </View>
                {livePredictions.map((pred, idx) => (
                  <PredictionCard
                    key={`live-${pred.machineId || pred.machineCode || idx}`}
                    prediction={pred}
                    isLive
                    onPress={() => navigateToMachine(pred)}
                    onCreateIntervention={handleCreateIntervention}
                  />
                ))}
              </>
            ) : (
              <Card>
                <EmptyState
                  title="Waiting for live predictions"
                  message="Live AI predictions will appear here when the inference service is connected to the MQTT broker and processing sensor data. Historical predictions are shown in the History tab."
                />
              </Card>
            )}
          </View>
        )}

        {/* History Tab */}
        {tab === "history" && !loading && (
          <View>
            {/* Filters card */}
            <Card className="mb-3">
              <Text className={`text-xs font-semibold font-inter mb-2 ${dark ? "text-white/60" : "text-text-muted"}`}>
                Filter Predictions
              </Text>

              {/* Severity filter pills */}
              <View className="flex-row gap-2 mb-3">
                {SEVERITY_FILTERS.map((sf) => (
                  <Pressable
                    key={sf.key}
                    onPress={() => setHistorySeverityFilter(sf.key)}
                    className={`px-3 py-1.5 rounded-chip ${
                      historySeverityFilter === sf.key
                        ? "bg-primary"
                        : dark ? "bg-white/10" : "bg-gray-100"
                    }`}
                  >
                    <Text className={`text-xs font-bold font-inter ${
                      historySeverityFilter === sf.key
                        ? "text-white"
                        : dark ? "text-white/60" : "text-text-muted"
                    }`}>
                      {sf.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View className={isDesktop ? "flex-row gap-3" : "gap-2"}>
                {/* Machine dropdown */}
                <View className={isDesktop ? "flex-1" : ""}>
                  <Text className={`text-[10px] font-inter mb-1 ${dark ? "text-white/40" : "text-text-muted"}`}>
                    Machine
                  </Text>
                  <View
                    className={`rounded-btn overflow-hidden ${
                      dark ? "bg-white/5 border border-white/10" : "bg-bg border border-border"
                    }`}
                  >
                    <Pressable
                      onPress={() => {
                        // Cycle through machine codes (simple dropdown simulation)
                        if (!historyMachineFilter) {
                          setHistoryMachineFilter(historyMachineCodes[0] || "");
                        } else {
                          const idx = historyMachineCodes.indexOf(historyMachineFilter);
                          const next = idx + 1 < historyMachineCodes.length ? historyMachineCodes[idx + 1] : "";
                          setHistoryMachineFilter(next);
                        }
                      }}
                      className="px-3 py-2"
                    >
                      <Text className={`text-sm font-inter ${
                        historyMachineFilter
                          ? (dark ? "text-white" : "text-text")
                          : (dark ? "text-white/40" : "text-text-muted")
                      }`}>
                        {historyMachineFilter || `All machines (${historyMachineCodes.length})`}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Date range */}
                <View className={isDesktop ? "flex-row gap-2" : "flex-row gap-2"}>
                  <View className="flex-1">
                    <Text className={`text-[10px] font-inter mb-1 ${dark ? "text-white/40" : "text-text-muted"}`}>
                      From
                    </Text>
                    <TextInput
                      value={historyDateFrom}
                      onChangeText={setHistoryDateFrom}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={dark ? "#ffffff40" : "#9CA3AF"}
                      className={`px-3 py-2 rounded-btn text-sm font-inter ${
                        dark ? "bg-white/5 text-white border border-white/10" : "bg-bg text-text border border-border"
                      }`}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className={`text-[10px] font-inter mb-1 ${dark ? "text-white/40" : "text-text-muted"}`}>
                      To
                    </Text>
                    <TextInput
                      value={historyDateTo}
                      onChangeText={setHistoryDateTo}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={dark ? "#ffffff40" : "#9CA3AF"}
                      className={`px-3 py-2 rounded-btn text-sm font-inter ${
                        dark ? "bg-white/5 text-white border border-white/10" : "bg-bg text-text border border-border"
                      }`}
                    />
                  </View>
                </View>

                {/* Clear button */}
                {hasActiveFilters ? (
                  <Pressable
                    onPress={() => {
                      setHistorySeverityFilter("all");
                      setHistoryMachineFilter("");
                      setHistoryDateFrom("");
                      setHistoryDateTo("");
                    }}
                    className="self-end px-3 py-2"
                  >
                    <Text className="text-xs font-bold font-inter text-primary">Clear</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Results count */}
              {hasActiveFilters ? (
                <Text className={`text-[10px] font-inter mt-2 ${dark ? "text-white/40" : "text-text-muted"}`}>
                  {filteredHistory.length} of {historicalPredictions.length} predictions
                </Text>
              ) : null}
            </Card>

            {filteredHistory.length > 0 ? (
              filteredHistory.map((pred, idx) => (
                <PredictionCard
                  key={pred.id || `hist-${idx}`}
                  prediction={pred}
                  isLive={false}
                  onPress={() => navigateToMachine(pred)}
                  onCreateIntervention={handleCreateIntervention}
                />
              ))
            ) : (
              <Card>
                <EmptyState
                  title={historicalPredictions.length > 0 ? "No matching predictions" : "No prediction history"}
                  message={
                    historicalPredictions.length > 0
                      ? "Try adjusting the severity, machine, or date filters."
                      : "AI prediction history will appear here once anomalies with thresholdType AI_MODEL are recorded in the database."
                  }
                />
              </Card>
            )}
          </View>
        )}

        {/* Spacer */}
        <View className="h-8" />
      </ScrollView>

      {/* Intervention creation modal */}
      <InterventionModal
        visible={interventionOpen}
        prefill={interventionPrefill}
        onClose={() => setInterventionOpen(false)}
      />
    </AppShell>
  );
}
