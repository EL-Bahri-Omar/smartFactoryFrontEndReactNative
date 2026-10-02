// src/components/DeltaChip.jsx
// Shows a percentage change chip (e.g. "+1.2%") colored green/red.

import { View, Text } from "react-native";

export default function DeltaChip({ value, className = "" }) {
  if (value == null || isNaN(value)) return null;

  const isPositive = value >= 0;
  const bgClass = isPositive ? "bg-success/10" : "bg-danger/10";
  const textColor = isPositive ? "text-success" : "text-danger";
  const sign = isPositive ? "+" : "";

  return (
    <View className={`flex-row items-center px-2 py-0.5 rounded-chip ${bgClass} ${className}`}>
      <Text className={`text-xs font-semibold ${textColor} font-inter`}>
        {sign}{value.toFixed(1)}%
      </Text>
    </View>
  );
}
