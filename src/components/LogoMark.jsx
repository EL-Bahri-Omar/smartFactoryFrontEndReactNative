// src/components/LogoMark.jsx
// Gear logo mark + "SmartFactory" wordmark used on login and sidebar.

import { View, Text, Image } from "react-native";

export default function LogoMark({ size = "md", showText = true }) {
  // Numeric sizes in an inline STYLE — react-native-web's <Image> ignores
  // className, so `w-8 h-8` never reached the tag and the raw 1024×1024 icon
  // overflowed the layout (review: "logo is toooooooooo big").
  const px = size === "lg" ? 48 : size === "sm" ? 24 : 32;
  const textSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  const subSize = size === "lg" ? "text-sm" : "text-xs";

  return (
    <View className="flex-row items-center gap-2">
      {/* The agreed app logo (app.json → ./assets/icon.png) replaces the old
          ⚙ glyph so the mark is identical everywhere it appears. */}
      <Image
        source={require("../../assets/icon.png")}
        resizeMode="contain"
        style={{ width: px, height: px, borderRadius: size === "sm" ? 6 : 8 }}
        accessibilityLabel="SmartFactory logo"
      />
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
