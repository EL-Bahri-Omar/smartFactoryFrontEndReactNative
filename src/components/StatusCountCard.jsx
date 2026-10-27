// src/components/StatusCountCard.jsx
//
// Machine-status count tile, styled after docs/ui/machines_count_cards.png:
//   label (top-left) · ↗ (top-right)
//   big number + unit + coloured round icon
// Used for the Dashboard's one-line status row (Total / Working / Idle /
// Under Repair / To be repaired).

import { View, Text, Pressable } from "react-native";
import Card from "./Card";
import Skeleton from "./Skeleton";
import { useDark } from "../hooks/useDark";

/**
 * @param {{
 *   label: string,
 *   value: number|null,
 *   unit?: string,
 *   icon?: string,
 *   color?: string,
 *   loading?: boolean,
 *   onPress?: function,
 *   className?: string,
 * }} props
 */
export default function StatusCountCard({
  label,
  value,
  unit = "machines",
  icon = "🏭",
  color = "#2563EB",
  loading = false,
  onPress,
  className = "",
}) {
  const dark = useDark();

  if (loading) {
    return (
      <Card className={className}>
        <Skeleton width="70%" height={11} className="mb-3" />
        <Skeleton width="50%" height={26} />
      </Card>
    );
  }

  const body = (
    <>
      <View className="flex-row items-start justify-between">
        <Text
          numberOfLines={1}
          className={`text-[11px] font-inter font-medium flex-1 mr-2 ${
            dark ? "text-white/70" : "text-text-muted"
          }`}
        >
          {label}
        </Text>
        <Text className={`text-[11px] font-inter ${dark ? "text-white/40" : "text-text-muted"}`}>
          ↗
        </Text>
      </View>

      <View className="flex-row items-end justify-between mt-2">
        <View className="flex-row items-baseline gap-1 flex-1 mr-2">
          <Text
            className={`text-[26px] leading-8 font-bold font-inter ${
              dark ? "text-white" : "text-text"
            }`}
          >
            {value == null ? "—" : String(value)}
          </Text>
          <Text
            numberOfLines={1}
            className={`text-[10px] font-inter ${dark ? "text-white/50" : "text-text-muted"}`}
          >
            {unit}
          </Text>
        </View>

        <View
          className="w-8 h-8 rounded-full items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}26` }}
        >
          <Text className="text-sm">{icon}</Text>
        </View>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable className={className} onPress={onPress}>
        <Card className="h-full">{body}</Card>
      </Pressable>
    );
  }

  return <Card className={className}>{body}</Card>;
}
