// src/components/Button.jsx
// Button with variants: primary | outline | ghost | danger

import { Pressable, Text, ActivityIndicator } from "react-native";
import { useDark } from "../hooks/useDark";

const VARIANTS = {
  primary: {
    container: "bg-primary rounded-btn px-4 py-2.5 items-center justify-center flex-row gap-2",
    containerPressed: "opacity-80",
    text: "text-white font-bold text-sm font-inter",
  },
  outline: {
    container: "bg-transparent border rounded-btn px-4 py-2.5 items-center justify-center flex-row gap-2",
    containerPressed: "",
    text: "font-bold text-sm font-inter",
  },
  ghost: {
    container: "bg-transparent rounded-btn px-4 py-2.5 items-center justify-center flex-row gap-2",
    containerPressed: "",
    text: "font-bold text-sm font-inter",
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
  const dark = useDark();
  const sizeClass = size === "sm" ? "px-3 py-1.5" : size === "lg" ? "px-6 py-3" : "";
  const textSizeClass = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "";

  // Outline/ghost adapt their border + text to the theme.
  const themeContainer =
    variant === "outline"
      ? dark
        ? "border-white/25"
        : "border-border"
      : variant === "ghost"
        ? ""
        : "";
  const themeText =
    variant === "outline"
      ? dark
        ? "text-white"
        : "text-text"
      : variant === "ghost"
        ? dark
          ? "text-white/70"
          : "text-text-muted"
        : "";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${v.container} ${themeContainer} ${disabled ? "opacity-50" : ""} ${sizeClass} ${className}`}
      style={({ pressed }) => (pressed ? { opacity: 0.8 } : {})}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "primary" || variant === "danger" ? "#FFFFFF" : "#2563EB"} />
      ) : (
        <>
          {icon}
          <Text className={`${v.text} ${themeText} ${textSizeClass}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
