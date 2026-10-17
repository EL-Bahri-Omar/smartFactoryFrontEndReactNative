// src/components/charts/HealthGauge.jsx
//
// Circular health gauge 0–100 (web + native via react-native-svg).
// Reusable in History, Reports and AI Analytics — do not duplicate.
// Bands: ≥85 Excellent (success), ≥60 Fair (warning), else Poor (danger).

import { View, Text } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { useDark } from "../../hooks/useDark";

export function healthLabel(value) {
  if (value == null) return "—";
  if (value >= 85) return "Excellent";
  if (value >= 60) return "Fair";
  return "Poor";
}

export function healthColor(value) {
  if (value == null) return "#94A3B8";
  if (value >= 85) return "#16A34A";
  if (value >= 60) return "#F59E0B";
  return "#DC2626";
}

export default function HealthGauge({ value, size = 140, delta = null }) {
  const dark = useDark();
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const color = healthColor(value);
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  return (
    <View className="items-center">
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={dark ? "rgba(255,255,255,0.12)" : "#E2E8F0"}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c - (c * pct) / 100}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <SvgText
          x={center}
          y={center - 2}
          fontSize={28}
          fontWeight="bold"
          fill={dark ? "#FFFFFF" : "#0F172A"}
          textAnchor="middle"
        >
          {value == null ? "—" : Math.round(value)}
        </SvgText>
        <SvgText
          x={center}
          y={center + 18}
          fontSize={11}
          fill={color}
          textAnchor="middle"
        >
          {healthLabel(value)}
        </SvgText>
      </Svg>
      {typeof delta === "number" && !Number.isNaN(delta) && (
        <Text className={`text-xs font-inter mt-1 ${delta >= 0 ? "text-success" : "text-danger"}`}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs previous period
        </Text>
      )}
    </View>
  );
}
