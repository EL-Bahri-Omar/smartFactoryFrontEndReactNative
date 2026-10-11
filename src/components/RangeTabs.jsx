// src/components/RangeTabs.jsx

import { View, Text, Pressable, ScrollView } from "react-native";
import { useDark } from "../hooks/useDark";

const DEFAULT_RANGES = [
  { key: "1h", label: "1h" },
  { key: "6h", label: "6h" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
];

export default function RangeTabs({
  ranges = DEFAULT_RANGES,
  active = "6h",
  onChange,
}) {
  const dark = useDark();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6 }}
    >
      {ranges.map((range) => {
        const isActive = range.key === active;
        return (
          <Pressable
            key={range.key}
            onPress={() => onChange?.(range.key)}
            className={`px-3 py-1.5 rounded-chip ${
              isActive ? "bg-primary" : dark ? "bg-white/5 border border-white/15" : "bg-bg border border-border"
            }`}
          >
            <Text
              className={`text-xs font-semibold font-inter ${
                isActive ? "text-white" : dark ? "text-white/60" : "text-text-muted"
              }`}
            >
              {range.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
