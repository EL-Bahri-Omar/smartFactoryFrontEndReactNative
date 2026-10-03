// src/components/EyeIcon.jsx
// Minimal password visibility toggle: an outlined eye (show) and the same
// eye with a slash (hide). Vector-drawn so it looks identical on web,
// iOS and Android — no emoji variance.

import Svg, { Ellipse, Circle, Line } from "react-native-svg";

export default function EyeIcon({ open = true, size = 22, color = "#64748B" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Ellipse
        cx={12}
        cy={12}
        rx={9}
        ry={5.5}
        stroke={color}
        strokeWidth={1.8}
      />
      {open ? (
        <Circle cx={12} cy={12} r={2.6} fill={color} />
      ) : (
        <Line
          x1={4.5}
          y1={19.5}
          x2={19.5}
          y2={4.5}
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}
