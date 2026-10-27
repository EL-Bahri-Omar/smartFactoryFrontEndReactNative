// src/components/charts/Sparkline.jsx
//
// Tiny inline trend line for list rows (Machine Status on the Dashboard).
// Pure react-native-svg so it renders identically on web and native.
// Renders NOTHING when there are fewer than 2 numeric points — a fake
// "trend" would be invented data, which this project forbids.

import Svg, { Polyline, Circle } from "react-native-svg";

/**
 * @param {{ points?: number[], width?: number, height?: number, color?: string }} props
 */
export default function Sparkline({
  points = [],
  width = 64,
  height = 22,
  color = "#2563EB",
}) {
  const nums = points.filter((p) => p != null && typeof p === "number" && !Number.isNaN(p));
  if (nums.length < 2) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (nums.length - 1);

  const coords = nums.map((v, i) => [
    Number((pad + i * stepX).toFixed(2)),
    Number((height - pad - ((v - min) / span) * (height - pad * 2)).toFixed(2)),
  ]);

  const last = coords[coords.length - 1];

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={coords.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={last[0]} cy={last[1]} r={2} fill={color} />
    </Svg>
  );
}
