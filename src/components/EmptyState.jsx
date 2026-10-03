// src/components/EmptyState.jsx
// Shown when a list or resource has no data. Always light-themed: content
// cards stay light in both modes, so always render this inside a Card
// (or another light surface) — never bare on the app background.

import { View, Text } from "react-native";

export default function EmptyState({
  title = "No data",
  message = "Nothing to display yet.",
  icon,
  action,
  className = "",
}) {
  return (
    <View className={`items-center justify-center py-12 px-6 ${className}`}>
      {icon && <View className="mb-4">{icon}</View>}
      {!icon && (
        <View className="w-16 h-16 rounded-full bg-bg items-center justify-center mb-4">
          <Text className="text-3xl">📭</Text>
        </View>
      )}
      <Text className="text-lg font-bold text-text font-inter text-center">{title}</Text>
      <Text className="text-sm text-text-muted font-inter text-center mt-1 max-w-xs">{message}</Text>
      {action && <View className="mt-4">{action}</View>}
    </View>
  );
}
