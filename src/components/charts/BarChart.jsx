// src/components/charts/BarChart.jsx
//
// SVG bar chart for web + native. X = category labels, Y = 0..yMax.
//   stacked = false (default) → one bar per series, side by side
//   stacked = true            → one bar per category, segments stacked
// Horizontally scrollable when the groups do not fit (mobile).
//
// Y grid uses 6 ticks (0, 20, 40 … 100 / 0, 50 … 250) to match OEE.png.

import { ScrollView, Text, View } from "react-native";
import Svg, { Rect, Line, G, Text as SvgText } from "react-native-svg";
import { useDark } from "../../hooks/useDark";

export const BAR_COLORS = ["#2563EB", "#0D9488", "#7C3AED", "#F59E0B"];

const toNumber = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * @param {{
 *   data?: { label: string, values: number[] }[],
 *   series?: { label?: string, color?: string }[],
 *   yMax?: number, height?: number, groupWidth?: number,
 *   stacked?: boolean, emptyMessage?: string,
 * }} props
 */
export default function BarChart({
  data = [],
  series = [],
  yMax = 100,
  height = 200,
  groupWidth = 72,
  stacked = false,
  emptyMessage = "No data for this range",
}) {
  const dark = useDark();

  const rows = (data || []).filter((d) => d && d.label != null);
  const seriesCount = Math.max(
    series.length,
    ...rows.map((r) => (r.values || []).length),
    1
  );

  if (!rows.length) {
    return (
      <View className="items-center justify-center py-8">
        <Text className={`text-sm font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  const axisW = 30;
  const labelH = 18;
  const top = 8;
  const width = axisW + rows.length * groupWidth + 8;
  const plotH = height - labelH - top;

  // Stacked bars scale on the tallest TOTAL; grouped bars on yMax.
  const totals = rows.map((r) =>
    (r.values || []).reduce((sum, v) => sum + (toNumber(v) ?? 0), 0)
  );
  const max = stacked
    ? Math.max(yMax, ...totals, 1)
    : yMax > 0
      ? yMax
      : 100;

  // 6 gridlines → 0,20,40,60,80,100 (or 0,50,…,250), as in OEE.png.
  const ticks = [0, max * 0.2, max * 0.4, max * 0.6, max * 0.8, max];

  const gridColor = dark ? "rgba(255,255,255,0.12)" : "#E2E8F0";
  const axisText = dark ? "rgba(255,255,255,0.55)" : "#64748B";

  const barPad = 6;
  const innerW = groupWidth - barPad * 2;
  const groupedBarW = Math.max(4, (innerW - (seriesCount - 1) * 4) / seriesCount);
  const stackedBarW = Math.max(8, Math.min(46, innerW * 0.7));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={width} height={height}>
        {ticks.map((t, i) => {
          const y = top + plotH - (t / max) * plotH;
          return (
            <G key={`t${i}`}>
              <Line x1={axisW} y1={y} x2={width - 4} y2={y} stroke={gridColor} strokeWidth={1} />
              <SvgText x={axisW - 6} y={y + 3} fontSize={9} fill={axisText} textAnchor="end">
                {Math.round(t)}
              </SvgText>
            </G>
          );
        })}

        {rows.map((row, gi) => {
          const gx = axisW + gi * groupWidth;
          const segments = [];

          if (stacked) {
            let cumulative = 0;
            (row.values || []).forEach((v, si) => {
              const value = toNumber(v);
              if (value == null) return;
              const clamped = Math.max(0, value);
              const h = (clamped / max) * plotH;
              const yBottom = top + plotH - (cumulative / max) * plotH;
              cumulative += clamped;
              segments.push(
                <Rect
                  key={`s${si}`}
                  x={gx + groupWidth / 2 - stackedBarW / 2}
                  y={yBottom - h}
                  width={stackedBarW}
                  height={h}
                  fill={
                    (series[si] && series[si].color) || BAR_COLORS[si % BAR_COLORS.length]
                  }
                />
              );
            });
          } else {
            (row.values || []).forEach((v, si) => {
              const value = toNumber(v);
              if (value == null) return; // null = "no reading" → no bar
              const h = (Math.max(0, Math.min(max, value)) / max) * plotH;
              segments.push(
                <Rect
                  key={`b${si}`}
                  x={gx + barPad + si * (groupedBarW + 4)}
                  y={top + plotH - h}
                  width={groupedBarW}
                  height={h}
                  rx={2}
                  fill={
                    (series[si] && series[si].color) || BAR_COLORS[si % BAR_COLORS.length]
                  }
                />
              );
            });
          }

          return (
            <G key={`g${gi}`}>
              {segments}
              <SvgText
                x={gx + groupWidth / 2}
                y={height - 5}
                fontSize={9}
                fill={axisText}
                textAnchor="middle"
              >
                {String(row.label)}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}
