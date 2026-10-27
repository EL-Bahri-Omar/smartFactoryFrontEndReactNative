// src/components/charts/DonutChart.jsx
//
// Donut chart for "Downtime by Machine" (Reports) on web + native.
// react-native-svg only — no web-only chart library.
//
// Legend renders under the donut (wraps to 2 columns on narrow screens) with
// the share of each slice in %.

import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useDark } from "../../hooks/useDark";

export const DONUT_COLORS = [
  "#2563EB",
  "#0D9488",
  "#7C3AED",
  "#EA580C",
  "#F59E0B",
  "#DC2626",
  "#0EA5E9",
  "#16A34A",
];

/**
 * @param {{
 *   data?: { key?: string, label: string, value: number, color?: string }[],
 *   size?: number, thickness?: number,
 *   centerLabel?: string, centerValue?: string,
 *   legend?: boolean, emptyMessage?: string,
 * }} props
 */
export default function DonutChart({
  data = [],
  size = 168,
  thickness = 24,
  centerLabel,
  centerValue,
  legend = true,
  emptyMessage = "No data for this range",
}) {
  const dark = useDark();

  const items = data
    .map((d, i) => ({
      key: d.key || d.label || String(i),
      label: d.label || d.key || "—",
      value: Number(d.value) || 0,
      color: d.color || DONUT_COLORS[i % DONUT_COLORS.length],
    }))
    .filter((d) => d.value > 0);

  const total = items.reduce((sum, d) => sum + d.value, 0);

  if (!items.length || total <= 0) {
    return (
      <View className="items-center justify-center py-8">
        <Text className={`text-sm font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  const stroke = thickness;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  // Cumulative offsets so each slice starts where the previous one ended.
  let offset = 0;
  const segments = items.map((d) => {
    const len = (d.value / total) * c;
    const seg = { ...d, len, offset };
    offset += len;
    return seg;
  });

  return (
    <View>
      <View className="items-center">
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={dark ? "rgba(255,255,255,0.10)" : "#E2E8F0"}
            strokeWidth={stroke}
            fill="none"
          />
          {segments.map((s) => (
            <Circle
              key={s.key}
              cx={center}
              cy={center}
              r={r}
              stroke={s.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${s.len} ${c - s.len}`}
              strokeDashoffset={-s.offset}
              transform={`rotate(-90 ${center} ${center})`}
            />
          ))}
        </Svg>
        {/* Center readout sits on top of the svg (avoids svg text layout) */}
        <View className="absolute items-center justify-center" style={{ width: size, height: size }}>
          {centerValue ? (
            <Text className={`text-xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
              {centerValue}
            </Text>
          ) : null}
          {centerLabel ? (
            <Text className={`text-[11px] font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
              {centerLabel}
            </Text>
          ) : null}
        </View>
      </View>

      {legend ? (
        <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
          {segments.map((s) => (
            <View
              key={s.key}
              className="flex-row items-center gap-1.5 px-2 py-1 rounded-chip"
              style={{ width: "47%" }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
              <Text
                numberOfLines={1}
                className={`text-[11px] font-inter flex-1 ${
                  dark ? "text-white/70" : "text-text-muted"
                }`}
              >
                {s.label}
              </Text>
              <Text className={`text-[11px] font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                {Math.round((s.value / total) * 100)}%
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
