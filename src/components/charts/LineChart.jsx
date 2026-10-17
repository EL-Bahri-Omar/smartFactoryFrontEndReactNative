// src/components/charts/LineChart.jsx
// Multi-series SVG line chart for web + native. First consumer: Machine Details.
// History & Analytics should reuse this file — do not duplicate.

import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { COLORS } from "../../constants/colors";
import { formatTime } from "../../lib/time";
import { useDark } from "../../hooks/useDark";

// RN's Animated injects `collapsable={false}` into animated props. On web
// that leaks onto the SVG <circle> DOM node and React warns ("non-boolean
// attribute") — divs swallow it silently, SVG does not. Strip both spellings
// before they reach the host element. Leaf circles are never flattened, so
// this is safe on native too.
function CleanCircle({ collapsable, collapsible, ...rest }) {
  return <Circle {...rest} />;
}
const AnimatedCleanCircle = Animated.createAnimatedComponent(CleanCircle);

const PAD = { top: 12, right: 12, bottom: 28, left: 36 };

function downsample(data, max = 220) {
  if (!data || data.length <= max) return data || [];
  const step = (data.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i += 1) {
    out.push(data[Math.round(i * step)]);
  }
  return out;
}

function toPxPoints(data, xMin, xMax, yMin, yMax, innerW, innerH) {
  const dx = xMax - xMin || 1;
  const dy = yMax - yMin || 1;
  return data.map((p) => ({
    x: PAD.left + ((p.x - xMin) / dx) * innerW,
    y: PAD.top + (1 - (p.y - yMin) / dy) * innerH,
  }));
}

function smoothPath(pts) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i === 0 ? i : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function yTicks(yMin, yMax, count = 5) {
  const ticks = [];
  const span = yMax - yMin;
  for (let i = 0; i < count; i += 1) {
    ticks.push(yMin + (span * i) / (count - 1));
  }
  return ticks;
}

/**
 * @param {{
 *   series: { id: string, color: string, data: { x: number, y: number }[] }[],
 *   height?: number,
 *   yMin?: number,
 *   yMax?: number,
 *   pulseLast?: boolean,
 *   limits?: { value: number, color?: string, label?: string }[],
 * }} props — limits render as dashed horizontal threshold lines.
 */
export default function LineChart({
  series = [],
  height = 260,
  yMin = 0,
  yMax = 200,
  pulseLast = false,
  limits = [],
}) {
  const [width, setWidth] = useState(0);
  const dark = useDark();
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!pulseLast) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseLast]);

  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = Math.max(1, height - PAD.top - PAD.bottom);

  const { prepared, domainYMax, xMin, xMax } = useMemo(() => {
    const preparedSeries = series.map((s) => ({
      ...s,
      data: downsample(
        (s.data || [])
          .map((p) => ({
            x: typeof p.x === "number" ? p.x : new Date(p.x).getTime(),
            y: Number(p.y),
          }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
          .sort((a, b) => a.x - b.x)
      ),
    }));

    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = yMax;
    preparedSeries.forEach((s) => {
      s.data.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    });
    if (!Number.isFinite(minX)) {
      minX = Date.now() - 3600000;
      maxX = Date.now();
    }
    if (maxX === minX) maxX = minX + 1;

    // Spec default is 0–200; expand when a series, or a limit line
    // (e.g. RPM thresholds), exceeds it.
    (limits || []).forEach((l) => {
      if (Number.isFinite(Number(l?.value)) && Number(l.value) > maxY) maxY = Number(l.value);
    });
    const niceMax = maxY > yMax ? Math.ceil(maxY / 50) * 50 : yMax;
    return {
      prepared: preparedSeries,
      domainYMax: niceMax,
      xMin: minX,
      xMax: maxX,
    };
  }, [series, yMax, limits]);

  const xTickCount = 5;
  const xTicks = [];
  for (let i = 0; i < xTickCount; i += 1) {
    xTicks.push(xMin + ((xMax - xMin) * i) / (xTickCount - 1));
  }

  return (
    <View
      style={{ width: "100%", height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {yTicks(yMin, domainYMax).map((tick) => {
            const y =
              PAD.top + (1 - (tick - yMin) / (domainYMax - yMin || 1)) * innerH;
            return (
              <G key={`y-${tick}`}>
                <Line
                  x1={PAD.left}
                  x2={PAD.left + innerW}
                  y1={y}
                  y2={y}
                  stroke={dark ? "rgba(255,255,255,0.12)" : COLORS.border}
                  strokeWidth={1}
                />
                <SvgText
                  x={PAD.left - 6}
                  y={y + 3}
                  fontSize={10}
                  fill={dark ? "#94A3B8" : COLORS.textMuted}
                  textAnchor="end"
                >
                  {Math.round(tick)}
                </SvgText>
              </G>
            );
          })}

          {xTicks.map((tick) => {
            const x = PAD.left + ((tick - xMin) / (xMax - xMin || 1)) * innerW;
            return (
              <SvgText
                key={`x-${tick}`}
                x={x}
                y={height - 8}
                fontSize={10}
                fill={dark ? "#94A3B8" : COLORS.textMuted}
                textAnchor="middle"
              >
                {formatTime(tick)}
              </SvgText>
            );
          })}

          {/* Threshold limit lines (dashed) with value labels */}
          {(limits || [])
            .filter((l) => Number.isFinite(Number(l?.value)))
            .map((l, i) => {
              const v = Number(l.value);
              const y = PAD.top + (1 - (v - yMin) / (domainYMax - yMin || 1)) * innerH;
              if (y < PAD.top - 4 || y > PAD.top + innerH + 4) return null;
              return (
                <G key={`limit-${i}`}>
                  <Line
                    x1={PAD.left}
                    x2={PAD.left + innerW}
                    y1={y}
                    y2={y}
                    stroke={l.color || "#F59E0B"}
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                  />
                  <SvgText
                    x={PAD.left + innerW - 2}
                    y={y - 4}
                    fontSize={9}
                    fill={l.color || "#F59E0B"}
                    textAnchor="end"
                  >
                    {l.label || String(v)}
                  </SvgText>
                </G>
              );
            })}

          {prepared.map((s) => {
            const pts = toPxPoints(s.data, xMin, xMax, yMin, domainYMax, innerW, innerH);
            if (!pts.length) return null;
            const last = pts[pts.length - 1];
            return (
              <G key={s.id}>
                <Path
                  d={smoothPath(pts)}
                  stroke={s.color}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx={last.x} cy={last.y} r={3.5} fill={s.color} />
                {pulseLast && (
                  <AnimatedCleanCircle
                    cx={last.x}
                    cy={last.y}
                    r={pulse.interpolate({
                      inputRange: [0.25, 1],
                      outputRange: [5, 11],
                    })}
                    fill={s.color}
                    opacity={pulse.interpolate({
                      inputRange: [0.25, 1],
                      outputRange: [0.35, 0.08],
                    })}
                  />
                )}
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}
