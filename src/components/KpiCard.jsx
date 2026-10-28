// src/components/KpiCard.jsx
//
// Dashboard KPI tile: muted label, big value (+unit), delta chip, coloured
// icon square (ui-notes §2 "KPI row — 4 cards").
// `value === null/undefined` renders an em dash — the KPI simply is not
// available yet (Sprint 7 backend), never a fabricated number.
//
// `ring` swaps the value block for a circular gauge (review: "health score
// card is empty, fix it to have a circle value — red, orange, green based on
// score value"). The arc length is the score itself; the colour bands are:
//   green  ≥ 80   orange 50–79   red < 50   grey = no score yet.

import { View, Text, Pressable } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Card from "./Card";
import DeltaChip from "./DeltaChip";
import Skeleton from "./Skeleton";
import { useDark } from "../hooks/useDark";

/**
 * Score → gauge colour. `null` stays neutral grey — a missing score is not a 0.
 *
 * Bands MATCH charts/HealthGauge (≥85 Excellent, ≥60 Fair, else Poor) so one
 * score is never two colours across screens: a machine at 80 must not read as
 * the green "healthy" ring while the reports gauge calls the same 80 amber
 * "Fair". Only the grey differs — HealthGauge keeps it for "no data".
 */
export function scoreColor(value) {
  if (value == null || Number.isNaN(Number(value))) return "#94A3B8";
  const v = Number(value);
  if (v >= 85) return "#16A34A"; // green  — Excellent
  if (v >= 60) return "#F59E0B"; // amber  — Fair
  return "#DC2626"; // red    — Poor
}

/**
 * Circular 0–100 gauge. The background track always shows the full circle so
 * an empty state still reads as "a score", not as a layout hole.
 *
 * Arc technique = the same one HealthGauge already uses: a single dash starting
 * at the path origin plus `transform="rotate(-90 cx cy)"`, which puts the start
 * at 12 o'clock and sweeps clockwise.
 *
 * The PREVIOUS version offset the pattern by -0.75 · circumference. That was
 * wrong: a `[dash gap]` pattern whose total length exceeds the path is simply
 * TRUNCATED by the renderer, so every score above 25 % drew the same quarter
 * arc from 9 to 12 o'clock (review: "the value of the circle line is not
 * identical to the value, look at the 97 %").
 *
 * The number, the arc length and the colour are all derived from the SAME
 * rounded value — what is printed is exactly what is drawn.
 */
export function ScoreRing({ value, size = 58, stroke = 6 }) {
  const dark = useDark();
  const raw = value == null || Number.isNaN(Number(value)) ? null : Number(value);
  const shown = raw == null ? null : Math.max(0, Math.min(100, Math.round(raw)));
  const color = scoreColor(shown);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Typography scales with the ring: the 38 px zone-row gauge must not carry
  // the 17 px / weight-800 number of the 96 px detail ring (review: "the zone
  // details machine's health score value is too bold, let it be lighter").
  const compact = size < 48;
  const fontSize = compact ? 12 : size >= 90 ? 17 : 15;
  const fontWeight = compact ? "600" : "800";
  const lineHeight = Math.round(fontSize * 1.2);

  return (
    <View
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      accessibilityLabel={
        shown == null ? "Health score unavailable" : `Health score ${shown} out of 100`
      }
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color + "2E"}
          strokeWidth={stroke}
          fill="none"
        />
        {shown != null && shown > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            // 100 must be a CLOSED ring: with a dash the browser leaves a
            // hairline seam at the join, so a full score gets no dash at all.
            {...(shown >= 100
              ? {}
              : {
                  strokeDasharray: `${circumference}`,
                  strokeDashoffset: circumference - (circumference * shown) / 100,
                  transform: `rotate(-90 ${size / 2} ${size / 2})`,
                })}
          />
        ) : null}
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text
          style={{
            fontSize: shown == null ? (compact ? 12 : 15) : fontSize,
            fontWeight,
            color: shown == null ? (dark ? "#94A3B8" : "#64748B") : color,
            lineHeight,
          }}
        >
          {shown == null ? "—" : shown}
        </Text>
      </View>
    </View>
  );
}

export default function KpiCard({
  label,
  value,
  unit,
  delta = null,
  icon,
  iconBgClass = "bg-primary-soft",
  loading = false,
  className = "",
  ring = false,
  loadingText = null,
  onPress = null,
}) {
  const dark = useDark();
  const shell = `flex-1 min-w-[150px] ${className}`;

  // Cards are doors (review: "let the dashboards cards be clickable and take
  // to the right destination"). When a destination is given the whole tile
  // becomes one pressable surface; otherwise it renders exactly as before.
  const wrap = (content) =>
    onPress ? (
      <Pressable onPress={onPress} accessibilityRole="button" className={shell}>
        <Card className="h-full">{content}</Card>
      </Pressable>
    ) : (
      <Card className={shell}>{content}</Card>
    );

  if (loading) {
    // Health score (review): show the word "Counting…" while the per-machine
    // average is being computed instead of anonymous skeleton bars.
    if (loadingText) {
      return wrap(
        <>
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1">
              <Text
                className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}
              >
                {label}
              </Text>
              <Text
                className={`text-sm font-bold font-inter ${
                  dark ? "text-white/75" : "text-text"
                }`}
              >
                {loadingText}
              </Text>
            </View>
            <ScoreRing value={null} />
          </View>
        </>
      );
    }
    return wrap(
      <>
        <Skeleton width="55%" height={12} className="mb-3" />
        <Skeleton width="45%" height={26} className="mb-3" />
        <Skeleton width={72} height={20} rounded />
      </>
    );
  }

  const hasValue = value != null && value !== "" && !Number.isNaN(Number(value));

  // ── Ring variant — gauge instead of a plain number (health score) ───────
  if (ring) {
    return wrap(
      <>
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1">
            <Text
              className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}
            >
              {label}
            </Text>
            <Text
              className={`text-[11px] font-inter ${dark ? "text-white/70" : "text-text"}`}
              numberOfLines={1}
            >
              {hasValue ? `${value} ${unit || ""}`.trim() : "No score yet"}
            </Text>
            <View className="mt-1.5 flex-row">
              <DeltaChip value={delta} />
            </View>
          </View>
          <ScoreRing value={hasValue ? Number(value) : null} />
        </View>
      </>
    );
  }

  return wrap(
    <>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <Text
            className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}
          >
            {label}
          </Text>

          <View className="flex-row items-baseline gap-1">
            <Text
              className={`text-2xl font-bold font-inter ${
                dark ? "text-white" : "text-text"
              }`}
            >
              {hasValue ? String(value) : "—"}
            </Text>
            {unit && hasValue ? (
              <Text
                className={`text-sm font-inter ${
                  dark ? "text-white/60" : "text-text-muted"
                }`}
              >
                {unit}
              </Text>
            ) : null}
          </View>

          <View className="mt-2 flex-row">
            <DeltaChip value={delta} />
          </View>
        </View>

        {icon ? (
          <View
            className={`w-10 h-10 rounded-btn items-center justify-center ${iconBgClass}`}
          >
            <Text className="text-lg">{icon}</Text>
          </View>
        ) : null}
      </View>
    </>
  );
}
