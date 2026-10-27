// src/components/KpiCard.jsx
//
// Dashboard KPI tile: muted label, big value (+unit), delta chip, coloured
// icon square (ui-notes §2 "KPI row — 4 cards").
// `value === null/undefined` renders an em dash — the KPI simply is not
// available yet (Sprint 7 backend), never a fabricated number.

import { View, Text } from "react-native";
import Card from "./Card";
import DeltaChip from "./DeltaChip";
import Skeleton from "./Skeleton";
import { useDark } from "../hooks/useDark";

export default function KpiCard({
  label,
  value,
  unit,
  delta = null,
  icon,
  iconBgClass = "bg-primary-soft",
  loading = false,
}) {
  const dark = useDark();

  if (loading) {
    return (
      <Card className="flex-1 min-w-[150px]">
        <Skeleton width="55%" height={12} className="mb-3" />
        <Skeleton width="45%" height={26} className="mb-3" />
        <Skeleton width={72} height={20} rounded />
      </Card>
    );
  }

  const hasValue = value != null && value !== "" && !Number.isNaN(Number(value));

  return (
    <Card className="flex-1 min-w-[150px]">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <Text
            className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}
          >
            {label}
          </Text>

          <View className="flex-row items-baseline gap-1">
            <Text
              className={`text-2xl font-bold font-inter ${
                dark ? "text-white" : "text-text"
              }`}
            >
              {hasValue ? String(value) : "—"}
            </Text>
            {unit && hasValue ? (
              <Text
                className={`text-sm font-inter ${
                  dark ? "text-white/60" : "text-text-muted"
                }`}
              >
                {unit}
              </Text>
            ) : null}
          </View>

          <View className="mt-2 flex-row">
            <DeltaChip value={delta} />
          </View>
        </View>

        {icon ? (
          <View
            className={`w-10 h-10 rounded-btn items-center justify-center ${iconBgClass}`}
          >
            <Text className="text-lg">{icon}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
