// src/components/Checkbox.jsx

import { Pressable, View, Text } from "react-native";

export default function Checkbox({ checked = false, onChange, label, disabled = false }) {
  return (
    <Pressable
      onPress={() => !disabled && onChange?.(!checked)}
      className={`flex-row items-center gap-2 ${disabled ? "opacity-50" : ""}`}
    >
      <View
        className={`w-5 h-5 rounded border-2 items-center justify-center ${
          checked ? "bg-primary border-primary" : "bg-surface border-border"
        }`}
      >
        {checked && <Text className="text-white text-xs font-bold">✓</Text>}
      </View>
      {label && <Text className="text-sm text-text font-inter">{label}</Text>}
    </Pressable>
  );
}
