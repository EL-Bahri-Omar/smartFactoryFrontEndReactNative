// src/components/MetricCard.jsx

import { View, Text } from "react-native";
import Card from "./Card";
import DeltaChip from "./DeltaChip";
import { useDark } from "../hooks/useDark";

export default function MetricCard({
  label,
  value,
  unit,
  delta,
  icon,
  iconBgClass = "bg-primary-soft",
}) {
  const dark = useDark();
  return (
    <Card className="flex-1 min-w-[140px]">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <Text className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}>{label}</Text>
          <View className="flex-row items-baseline gap-1">
            <Text className={`text-2xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>{value}</Text>
            {unit ? (
              <Text className={`text-sm font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>{unit}</Text>
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
