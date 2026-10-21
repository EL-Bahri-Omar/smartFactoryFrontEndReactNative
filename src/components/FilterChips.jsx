// src/components/FilterChips.jsx
// Horizontally scrollable filter chips with optional counts — shared by
// Alerts, Notifications and Maintenance (mobile-first, works on web).
// Selected chip = solid dark pill (per ui-notes panel 5).
//
// chips: [{ key, label, count? }]
// active: key of the selected chip
// onChange: (key) => void

import { View, Text, Pressable, ScrollView } from "react-native";
import { useDark } from "../hooks/useDark";

export default function FilterChips({ chips = [], active, onChange, className = "" }) {
  const dark = useDark();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingRight: 8 }}
      className={className}
    >
      <View className="flex-row items-center gap-2">
        {chips.map((chip) => {
          const isActive = chip.key === active;
          const label = chip.count != null ? `${chip.label} (${chip.count})` : chip.label;
          return (
            <Pressable
              key={chip.key || "all"}
              onPress={() => onChange?.(chip.key)}
              className={`flex-row items-center px-3 py-1.5 rounded-chip border ${
                isActive
                  ? "bg-sidebar border-transparent"
                  : dark
                    ? "bg-white/5 border-white/15"
                    : "bg-surface border-border"
              }`}
              style={({ pressed }) => (pressed && !isActive ? { opacity: 0.8 } : {})}
            >
              <Text
                className={`text-xs font-semibold font-inter ${isActive ? "text-white" : dark ? "text-white/70" : "text-text-muted"}`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
