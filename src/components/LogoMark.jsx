// src/components/LogoMark.jsx
// Gear logo mark + "SmartFactory" wordmark used on login and sidebar.

import { View, Text } from "react-native";

export default function LogoMark({ size = "md", showText = true }) {
  const gearSize = size === "lg" ? "w-12 h-12" : size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const textSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  const subSize = size === "lg" ? "text-sm" : "text-xs";

  return (
    <View className="flex-row items-center gap-2">
      <View className={`${gearSize} rounded-lg bg-primary items-center justify-center`}>
        <Text className="text-white font-bold" style={{ fontSize: size === "lg" ? 20 : size === "sm" ? 10 : 14 }}>⚙</Text>
      </View>
      {showText && (
        <View>
          <Text className={`${textSize} font-bold text-text font-inter`}>
            SmartFactory
          </Text>
          {size !== "sm" && (
            <Text className={`${subSize} text-text-muted font-inter`}>
              Industrial Intelligence
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
