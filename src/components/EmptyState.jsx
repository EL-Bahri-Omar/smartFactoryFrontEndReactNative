// src/components/EmptyState.jsx
// Shown when a list or resource has no data. Always rendered inside a Card.

import { View, Text } from "react-native";
import { useDark } from "../hooks/useDark";

export default function EmptyState({
  title = "No data",
  message = "Nothing to display yet.",
  icon,
  action,
  className = "",
}) {
  const dark = useDark();
  return (
    <View className={`items-center justify-center py-12 px-6 ${className}`}>
      {icon && <View className="mb-4">{icon}</View>}
      {!icon && (
        <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${dark ? "bg-white/10" : "bg-bg"}`}>
          <Text className="text-3xl">📭</Text>
        </View>
      )}
      <Text className={`text-lg font-bold font-inter text-center ${dark ? "text-white" : "text-text"}`}>{title}</Text>
      <Text className={`text-sm font-inter text-center mt-1 max-w-xs ${dark ? "text-white/60" : "text-text-muted"}`}>{message}</Text>
      {action && <View className="mt-4">{action}</View>}
    </View>
  );
}
