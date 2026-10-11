// src/components/Select.jsx
// Simple select dropdown. On native, uses a modal picker.
// For now, uses a basic Pressable + overlay approach on all platforms.

import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { useState } from "react";
import { useDark } from "../hooks/useDark";

export default function Select({
  label,
  value,
  options = [],
  onValueChange,
  placeholder = "Select...",
  disabled = false,
  error,
  className = "",
  labelClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const dark = useDark();
  const selectedOption = options.find((o) => o.value === value);

  return (
    <View className={`gap-1 ${className}`}>
      {label && (
        <Text className={`text-sm font-inter ${dark ? "text-white" : "text-text"} ${labelClassName || "font-medium"}`}>{label}</Text>
      )}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        className={`flex-row items-center justify-between border rounded-btn px-3 py-2.5 ${
          error ? "border-danger" : dark ? "border-white/15" : "border-border"
        } ${dark ? "bg-white/5" : "bg-surface"} ${disabled ? "opacity-50" : ""}`}
      >
        <View className="flex-1 flex-row items-center gap-2">
          {selectedOption?.dot ? (
            <View
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: selectedOption.dot }}
            />
          ) : null}
          <Text className={`text-sm font-inter ${selectedOption ? (dark ? "text-white" : "text-text") : "text-offline"}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
        </View>
        <Text className={`text-xs ${dark ? "text-white/50" : "text-text-muted"}`}>▼</Text>
      </Pressable>
      {error && <Text className="text-xs text-danger font-inter">{error}</Text>}

      <Modal visible={open} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/30 justify-center items-center px-8"
          onPress={() => setOpen(false)}
        >
          <View className={`rounded-card w-full max-w-sm border overflow-hidden ${dark ? "bg-darkcard border-white/15" : "bg-surface border-border"}`}>
            <Text className={`text-sm font-semibold px-4 pt-3 pb-2 font-inter ${dark ? "text-white" : "text-text"}`}>
              {label || "Select"}
            </Text>
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              style={{ maxHeight: 240 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onValueChange?.(item.value);
                    setOpen(false);
                  }}
                  className={`px-4 py-3 border-t ${dark ? "border-white/10" : "border-border"} ${
                    item.value === value ? "bg-primary-soft" : ""
                  }`}
                >
                  <View className="flex-row items-center gap-2">
                    {item.dot ? (
                      <View
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.dot }}
                      />
                    ) : null}
                    <Text className={`text-sm font-inter ${item.value === value ? "text-primary font-semibold" : dark ? "text-white" : "text-text"}`}>
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
