// src/components/Button.jsx
// Button with variants: primary | outline | ghost | danger

import { Pressable, Text, ActivityIndicator } from "react-native";

const VARIANTS = {
  primary: {
    container: "bg-primary rounded-btn px-4 py-2.5 items-center justify-center flex-row gap-2",
    containerPressed: "opacity-80",
    text: "text-white font-bold text-sm font-inter",
  },
  outline: {
    container: "bg-transparent border border-border rounded-btn px-4 py-2.5 items-center justify-center flex-row gap-2",
    containerPressed: "bg-bg",
    text: "text-text font-bold text-sm font-inter",
  },
  ghost: {
    container: "bg-transparent rounded-btn px-4 py-2.5 items-center justify-center flex-row gap-2",
    containerPressed: "bg-bg",
    text: "text-text-muted font-bold text-sm font-inter",
  },
  danger: {
    container: "bg-danger rounded-btn px-4 py-2.5 items-center justify-center flex-row gap-2",
    containerPressed: "opacity-80",
    text: "text-white font-bold text-sm font-inter",
  },
};

export default function Button({
  title,
  variant = "primary",
  onPress,
  disabled = false,
  loading = false,
  icon,
  className = "",
  size = "md",
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = size === "sm" ? "px-3 py-1.5" : size === "lg" ? "px-6 py-3" : "";
  const textSizeClass = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${v.container} ${disabled ? "opacity-50" : ""} ${sizeClass} ${className}`}
      style={({ pressed }) => (pressed ? { opacity: 0.8 } : {})}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "primary" || variant === "danger" ? "#FFFFFF" : "#2563EB"} />
      ) : (
        <>
          {icon}
          <Text className={`${v.text} ${textSizeClass}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
