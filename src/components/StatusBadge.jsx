// src/components/StatusBadge.jsx
// Shows a colored dot + label for machine/sensor status.
// Uses src/lib/status.js for color lookup.

import { View, Text } from "react-native";
import { getMachineStatus } from "../lib/status";
import { useDark } from "../hooks/useDark";

export default function StatusBadge({ status, className = "" }) {
  const dark = useDark();
  const { label, dotColor } = getMachineStatus(status);

  return (
    <View className={`flex-row items-center gap-1.5 px-2 py-1 rounded-chip ${dark ? "bg-white/10" : "bg-bg"} ${className}`}>
      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
      <Text className={`text-xs font-medium font-inter ${dark ? "text-white" : "text-text"}`}>{label}</Text>
    </View>
  );
}
