// src/components/HealthBar.jsx
// Horizontal bar showing health percentage. Color: green >80, amber 50–80, red <50.

import { View, Text } from "react-native";
import { useDark } from "../hooks/useDark";

export default function HealthBar({ value, showLabel = true, className = "" }) {
  const dark = useDark();
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const color = pct > 80 ? "#16A34A" : pct >= 50 ? "#F59E0B" : "#DC2626";

  return (
    <View className={`flex-row items-center gap-2 ${className}`}>
      {showLabel && (
        <Text className={`text-sm font-medium font-inter w-10 text-right ${dark ? "text-white" : "text-text"}`}>
          {value != null ? `${pct}%` : "—"}
        </Text>
      )}
      <View className={`flex-1 h-2 rounded-full overflow-hidden ${dark ? "bg-white/10" : "bg-bg"}`} style={{ maxWidth: 80 }}>
        <View
          className="h-2 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}
