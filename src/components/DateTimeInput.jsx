// src/components/DateTimeInput.jsx
// Cross-platform datetime picker.
// Web: renders a native <input type="datetime-local"> for reliable browser support.
// Shows a green checkmark when a date is selected.

import { Platform, View, Text } from "react-native";
import { useDark } from "../hooks/useDark";

export default function DateTimeInput({ value, onChange, placeholder = "Select date..." }) {
  const dark = useDark();
  const hasValue = !!value;

  if (Platform.OS === "web") {
    return (
      <View
        className={`border rounded-btn overflow-hidden flex-row items-center ${
          hasValue
            ? dark ? "bg-success/10 border-success/30" : "bg-green-50 border-success/40"
            : dark ? "bg-white/5 border-white/15" : "bg-bg border-border"
        }`}
      >
        <input
          type="datetime-local"
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            width: "100%",
            padding: "8px 12px",
            fontSize: 14,
            fontFamily: "Inter, system-ui, sans-serif",
            border: "none",
            outline: "none",
            backgroundColor: "transparent",
            color: dark ? "#FFFFFF" : "#0F172A",
            colorScheme: dark ? "dark" : "light",
          }}
        />
        {hasValue && (
          <View style={{ paddingRight: 10 }}>
            <Text style={{ fontSize: 14, color: "#22C55E" }}>{"✓"}</Text>
          </View>
        )}
      </View>
    );
  }

  // Native fallback
  return (
    <View className={`border rounded-btn px-3 py-2 ${dark ? "bg-white/5 border-white/15" : "bg-bg border-border"}`}>
      <Text className={`text-sm font-inter ${value ? (dark ? "text-white" : "text-text") : "text-offline"}`}>
        {value || placeholder}
      </Text>
    </View>
  );
}
