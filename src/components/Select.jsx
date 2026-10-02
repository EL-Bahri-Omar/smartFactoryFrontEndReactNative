// src/components/Select.jsx
// Simple select dropdown. On native, uses a modal picker.
// For now, uses a basic Pressable + overlay approach on all platforms.

import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { useState } from "react";

export default function Select({
  label,
  value,
  options = [],
  onValueChange,
  placeholder = "Select...",
  disabled = false,
  error,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <View className={`gap-1 ${className}`}>
      {label && (
        <Text className="text-sm font-medium text-text font-inter">{label}</Text>
      )}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        className={`flex-row items-center justify-between bg-surface border rounded-btn px-3 py-2.5 ${
          error ? "border-danger" : "border-border"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <Text className={`text-sm font-inter ${selectedOption ? "text-text" : "text-offline"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Text className="text-text-muted text-xs">▼</Text>
      </Pressable>
      {error && <Text className="text-xs text-danger font-inter">{error}</Text>}

      <Modal visible={open} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/30 justify-center items-center px-8"
          onPress={() => setOpen(false)}
        >
          <View className="bg-surface rounded-card w-full max-w-sm border border-border overflow-hidden">
            <Text className="text-sm font-semibold text-text px-4 pt-3 pb-2 font-inter">
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
                  className={`px-4 py-3 border-t border-border ${
                    item.value === value ? "bg-primary-soft" : ""
                  }`}
                >
                  <Text className={`text-sm font-inter ${item.value === value ? "text-primary font-semibold" : "text-text"}`}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
