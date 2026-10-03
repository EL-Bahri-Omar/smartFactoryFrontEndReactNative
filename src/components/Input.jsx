// src/components/Input.jsx

import { View, Text, TextInput } from "react-native";
import { useState } from "react";

export default function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  error,
  disabled = false,
  multiline = false,
  keyboardType = "default",
  className = "",
  labelClassName = "",
  icon,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View className={`gap-1 ${className}`}>
      {label && (
        <Text className={`text-sm text-text font-inter ${labelClassName || "font-medium"}`}>{label}</Text>
      )}
      <View
        className={`flex-row items-center bg-surface border rounded-btn px-3 py-2.5 gap-2 ${
          error ? "border-danger" : focused ? "border-primary" : "border-border"
        } ${disabled ? "opacity-50" : ""}`}
      >
        {icon && <View className="mr-1">{icon}</View>}
        <TextInput
          className="flex-1 text-sm text-text font-inter"
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          editable={!disabled}
          multiline={multiline}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ outlineStyle: "none" }}
        />
      </View>
      {error && (
        <Text className="text-xs text-danger font-inter">{error}</Text>
      )}
    </View>
  );
}
