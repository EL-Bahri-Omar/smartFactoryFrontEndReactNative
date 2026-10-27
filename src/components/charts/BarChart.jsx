// src/components/charts/BarChart.jsx
//
// Grouped bar chart for "Machine Performance" (Reports) on web + native.
// X = machine codes, Y = 0..yMax (%), one bar per series per machine.
// Horizontally scrollable when the groups do not fit (mobile).

import { ScrollView, Text, View } from "react-native";
import Svg, { Rect, Line, G, Text as SvgText } from "react-native-svg";
import { useDark } from "../../hooks/useDark";

export const BAR_COLORS = ["#2563EB", "#0D9488", "#7C3AED", "#F59E0B"];

/**
 * @param {{
 *   data?: { label: string, values: number[] }[],
 *   series?: { label?: string, color?: string }[],
 *   yMax?: number, height?: number, groupWidth?: number,
 *   emptyMessage?: string,
 * }} props
 */
export default function BarChart({
  data = [],
  series = [],
  yMax = 100,
  height = 200,
  groupWidth = 72,
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
  const max = yMax > 0 ? yMax : 100;

  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];

  const gridColor = dark ? "rgba(255,255,255,0.12)" : "#E2E8F0";
  const axisText = dark ? "rgba(255,255,255,0.55)" : "#64748B";

  const barPad = 6;
  const innerW = groupWidth - barPad * 2;
  const barW = Math.max(4, (innerW - (seriesCount - 1) * 4) / seriesCount);

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
          return (
            <G key={`g${gi}`}>
              {(row.values || []).map((v, si) => {
                // `null` = "no reading for this machine/series" → no bar.
                if (v == null || v === "" || Number.isNaN(Number(v))) return null;
                const value = Number(v);
                const safe = Math.max(0, Math.min(max, value));
                const h = (safe / max) * plotH;
                const x = gx + barPad + si * (barW + 4);
                const y = top + plotH - h;
                return (
                  <Rect
                    key={`b${si}`}
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={2}
                    fill={
                      (series[si] && series[si].color) ||
                      BAR_COLORS[si % BAR_COLORS.length]
                    }
                  />
                );
              })}
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
