// src/components/Toggle.jsx

import { Pressable, View, Text } from "react-native";
import { useDark } from "../hooks/useDark";

export default function Toggle({ value = false, onChange, label, disabled = false }) {
  const dark = useDark();
  return (
    <Pressable
      onPress={() => !disabled && onChange?.(!value)}
      className={`flex-row items-center justify-between gap-3 ${disabled ? "opacity-50" : ""}`}
    >
      {label && <Text className={`text-sm font-inter flex-1 ${dark ? "text-white" : "text-text"}`}>{label}</Text>}
      <View
        className={`w-11 h-6 rounded-full p-0.5 ${value ? "bg-primary" : dark ? "bg-white/20" : "bg-border"}`}
      >
        <View
          className={`w-5 h-5 rounded-full bg-white ${value ? "ml-auto" : ""}`}
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 2,
          }}
        />
      </View>
    </Pressable>
  );
}
