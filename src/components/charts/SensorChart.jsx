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

  // Build limit lines from threshold
  const limits = [];
  if (threshold) {
    if (threshold.criticalMax != null) {
      limits.push({
        value: threshold.criticalMax,
        color: COLORS.danger,
        label: `Critical ${threshold.criticalMax}`,
      });
    }
    if (threshold.warningMax != null) {
      limits.push({
        value: threshold.warningMax,
        color: COLORS.warning,
        label: `Warning ${threshold.warningMax}`,
      });
    }
    if (threshold.warningMin != null && threshold.warningMin > 0) {
      limits.push({
        value: threshold.warningMin,
        color: COLORS.warning,
        label: `Warning ${threshold.warningMin}`,
      });
    }
    if (threshold.criticalMin != null && threshold.criticalMin > 0) {
      limits.push({
        value: threshold.criticalMin,
        color: COLORS.danger,
        label: `Critical ${threshold.criticalMin}`,
      });
    }
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

      {/* Chart */}
      {data.length > 0 ? (
        <LineChart
          series={series}
          height={height}
          yMin={meta.yMin}
          yMax={yMax}
          pulseLast={pulseLast}
          limits={limits}
        />
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
