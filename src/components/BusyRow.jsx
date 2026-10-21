// src/components/BusyRow.jsx
// Inline "loading" feedback row: spinner + short label. Used wherever a
// server-backed fetch runs while OLD data is still visible (refreshing a
// list, changing a period, typing in a server-backed search). The rule:
//   - cold load (no data yet)  → skeletons
//   - refresh (data on screen) → BusyRow + dimmed content, no layout flash

import { View, Text, ActivityIndicator } from "react-native";
import { useDark } from "../hooks/useDark";

export default function BusyRow({ label = "Updating…", className = "" }) {
  const dark = useDark();
  return (
    <View className={`flex-row items-center gap-2 px-1 py-1.5 ${className}`}>
      <ActivityIndicator size="small" color={dark ? "#60A5FA" : "#2563EB"} />
      <Text className={`text-xs font-inter ${dark ? "text-white/70" : "text-text-muted"}`}>
        {label}
      </Text>
    </View>
  );
}
