// src/components/charts/ChartLegend.jsx

import { View, Text } from "react-native";

/**
 * @param {{ items: { id: string, label: string, color: string }[], className?: string }} props
 */
export default function ChartLegend({ items = [], className = "" }) {
  return (
    <View className={`flex-row flex-wrap gap-x-4 gap-y-2 ${className}`}>
      {items.map((item) => (
        <View key={item.id} className="flex-row items-center gap-1.5">
          <View
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <Text className="text-xs text-text-muted font-inter">{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
