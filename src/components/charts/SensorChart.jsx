// src/components/charts/SensorChart.jsx
//
// Isolated chart for ONE sensor type: renders one line series + threshold
// bands (warning dashed orange, critical dashed red). Used in Machine Details
// (4-grid layout) and History & Analytics.
//
// Props:
//   sensorType  – 'TEMPERATURE' | 'VIBRATION' | 'CURRENT' | 'RPM'
//   data        – [{ x: number|string, y: number }]  (timestamps + values)
//   threshold   – { warningMin, warningMax, criticalMin, criticalMax } or null
//   height      – chart height (default 200)
//   pulseLast   – animate last point
//   currentValue – number to show in header (latest reading)
//   status      – 'OK' | 'WARNING' | 'CRITICAL' | 'NO_DATA'
//   compact     – smaller header/padding (mobile)

import { View, Text } from "react-native";
import LineChart from "./LineChart";
import { COLORS } from "../../constants/colors";
import { SENSOR_TYPE, SENSOR_UNIT } from "../../constants/roles";
import { useDark } from "../../hooks/useDark";

const META = {
  [SENSOR_TYPE.TEMPERATURE]: {
    label: "Temperature",
    unit: SENSOR_UNIT.TEMPERATURE,
    color: COLORS.chartTemp,
    icon: "🌡",
    yMin: 0,
    yMax: 120,
    decimals: 1,
  },
  [SENSOR_TYPE.VIBRATION]: {
    label: "Vibration",
    unit: SENSOR_UNIT.VIBRATION,
    color: COLORS.chartVibration,
    icon: "〰️",
    yMin: 0,
    yMax: 15,
    decimals: 2,
  },
  [SENSOR_TYPE.CURRENT]: {
    label: "Current",
    unit: SENSOR_UNIT.CURRENT,
    color: COLORS.chartCurrent,
    icon: "⚡",
    yMin: 0,
    yMax: 20,
    decimals: 2,
  },
  [SENSOR_TYPE.RPM]: {
    label: "RPM",
    unit: SENSOR_UNIT.RPM,
    color: COLORS.chartRpm,
    icon: "⟳",
    yMin: 0,
    yMax: 2000,
    decimals: 0,
  },
};

const STATUS_COLORS = {
  OK: COLORS.success,
  WARNING: COLORS.warning,
  CRITICAL: COLORS.danger,
  NO_DATA: COLORS.offline,
};

function formatValue(val, decimals = 1) {
  if (val == null || Number.isNaN(Number(val))) return "—";
  return Number(val).toFixed(decimals);
}

/**
 * Chart frame for a sensor that has thresholds but no readings yet: the same
 * box as the chart, with the alert limits drawn as dashed orange/red rules at
 * their real position on the 0…yMax scale. Pure views — no SVG layout needed,
 * so it renders even while the chart is empty.
 */
function ThresholdFrame({ limits, yMax, height, dark }) {
  const inner = Math.max(1, height - 34);
  const scaleTop = 8;
  return (
    <View style={{ height, position: "relative", paddingTop: scaleTop, paddingHorizontal: 12 }}>
      {limits.map((l, i) => {
        const v = Number(l.value);
        if (!Number.isFinite(v)) return null;
        const ratio = Math.min(1, Math.max(0, v / (Number(yMax) || 1)));
        const top = scaleTop + (1 - ratio) * inner;
        return (
          <View key={`${l.label}-${i}`} style={{ position: "absolute", left: 12, right: 12, top }}>
            <View style={{ borderTopWidth: 2, borderStyle: "dashed", borderColor: l.color }} />
            <Text style={{ fontSize: 9, color: l.color, textAlign: "right", marginTop: 2 }}>
              {l.label}
            </Text>
          </View>
        );
      })}
      <Text
        style={{
          position: "absolute",
          bottom: 6,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 10,
          color: dark ? "#64748B" : "#94A3B8",
        }}
      >
        No readings yet — threshold lines only
      </Text>
    </View>
  );
}

export default function SensorChart({
  sensorType,
  data = [],
  threshold,
  height = 200,
  pulseLast = false,
  currentValue,
  status,
  compact = false,
}) {
  const dark = useDark();
  const meta = META[sensorType] || META.TEMPERATURE;

  // Limit lines come from the machine's STORED thresholds, which the backend
  // fills with its own defaults when a bound is left NULL
  // (`MachineThresholdService.createDefaultThresholdForType`). No hardcoded
  // fallback here any more: every machine now has real rows (152/152 carry a
  // bound), and a hardcoded default would silently contradict a machine tuned
  // to different limits — GEN-001 is 50/70 °C, not the default 60/80.
  const critMax = threshold?.criticalMax ?? null;
  const warnMax = threshold?.warningMax ?? null;
  const warnMin = threshold?.warningMin ?? null;
  const critMin = threshold?.criticalMin ?? null;

  const limits = [];
  if (critMax != null) {
    limits.push({ value: critMax, color: COLORS.danger, label: `Critical ${critMax}` });
  }
  if (warnMax != null) {
    limits.push({ value: warnMax, color: COLORS.warning, label: `Warning ${warnMax}` });
  }
  if (warnMin != null && warnMin > 0) {
    limits.push({ value: warnMin, color: COLORS.warning, label: `Warning ${warnMin}` });
  }
  if (critMin != null && critMin > 0) {
    limits.push({ value: critMin, color: COLORS.danger, label: `Critical ${critMin}` });
  }

  // Auto-scale yMax if data or thresholds exceed the default
  let yMax = meta.yMax;
  if (data.length) {
    const maxVal = Math.max(...data.map((p) => Number(p.y) || 0));
    if (maxVal > yMax) yMax = Math.ceil(maxVal * 1.15);
  }
  limits.forEach((l) => {
    if (l.value > yMax) yMax = Math.ceil(l.value * 1.1);
  });

  const series = [
    {
      id: sensorType,
      color: meta.color,
      data,
    },
  ];

  const statusColor = STATUS_COLORS[status] || COLORS.textMuted;
  const displayValue = currentValue != null ? formatValue(currentValue, meta.decimals) : null;

  return (
    <View
      className={`rounded-xl border ${dark ? "bg-slate-800/60 border-white/10" : "bg-white border-border"}`}
      style={{ overflow: "hidden" }}
    >
      {/* Header: icon + label + current value + status */}
      <View className={`flex-row items-center justify-between ${compact ? "px-3 pt-2.5 pb-1" : "px-4 pt-3 pb-2"}`}>
        <View className="flex-row items-center gap-2">
          <View
            className="w-7 h-7 rounded-lg items-center justify-center"
            style={{ backgroundColor: meta.color + "18" }}
          >
            <Text style={{ fontSize: 14 }}>{meta.icon}</Text>
          </View>
          <View>
            <Text className={`${compact ? "text-xs" : "text-sm"} font-bold ${dark ? "text-white" : "text-text"}`}>
              {meta.label}
            </Text>
            {displayValue != null && (
              <Text className="text-xs" style={{ color: meta.color }}>
                {displayValue} {meta.unit}
              </Text>
            )}
          </View>
        </View>
        {status && (
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: statusColor + "18" }}
          >
            <Text className="text-[10px] font-bold" style={{ color: statusColor }}>
              {status}
            </Text>
          </View>
        )}
      </View>

      {/* Chart — with points, the real line chart. Without points but WITH
          configured thresholds, draw the limits as dashed rules anyway: the
          orange/red limits are configuration, not telemetry, so a quiet
          machine still shows where it would trip (review: "bring back
          thresholds interrupted line to live sensors charts"). */}
      {data.length > 0 ? (
        <LineChart
          series={series}
          height={height}
          yMin={meta.yMin}
          yMax={yMax}
          pulseLast={pulseLast}
          limits={limits}
        />
      ) : limits.length > 0 ? (
        <ThresholdFrame limits={limits} yMax={yMax} height={height} dark={dark} />
      ) : (
        <View className="items-center justify-center" style={{ height }}>
          <Text className={`text-sm ${dark ? "text-slate-400" : "text-text-muted"}`}>
            No data
          </Text>
        </View>
      )}
    </View>
  );
}
