// src/components/MetricCard.jsx

import { View, Text } from "react-native";
import Card from "./Card";
import DeltaChip from "./DeltaChip";

export default function MetricCard({
  label,
  value,
  unit,
  delta,
  icon,
  iconBgClass = "bg-primary-soft",
}) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <Text className="text-xs text-text-muted font-inter mb-1">{label}</Text>
          <View className="flex-row items-baseline gap-1">
            <Text className="text-2xl font-bold text-text font-inter">{value}</Text>
            {unit ? (
              <Text className="text-sm text-text-muted font-inter">{unit}</Text>
            ) : null}
          </View>
          {delta != null && !Number.isNaN(delta) ? (
            <View className="mt-2">
              <DeltaChip value={delta} />
            </View>
          ) : null}
        </View>
        {icon ? (
          <View className={`w-9 h-9 rounded-btn items-center justify-center ${iconBgClass}`}>
            <Text className="text-base">{icon}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
