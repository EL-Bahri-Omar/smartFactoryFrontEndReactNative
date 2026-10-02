// src/components/Avatar.jsx

import { View, Text } from "react-native";

/**
 * @param {{ name?: string, size?: 'sm'|'md'|'lg', color?: string }} props
 */
export default function Avatar({ name = "", size = "md", color }) {
  const sizeClass = size === "lg" ? "w-12 h-12" : size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const textSize = size === "lg" ? "text-lg" : size === "sm" ? "text-xs" : "text-sm";

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View
      className={`${sizeClass} rounded-full items-center justify-center`}
      style={{ backgroundColor: color || "#2563EB" }}
    >
      <Text className={`${textSize} font-semibold text-white font-inter`}>
        {initials || "?"}
      </Text>
    </View>
  );
}
