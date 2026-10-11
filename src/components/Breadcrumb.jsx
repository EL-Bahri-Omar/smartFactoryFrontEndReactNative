// src/components/Breadcrumb.jsx

import { View, Text, Pressable } from "react-native";
import { useDark } from "../hooks/useDark";

/**
 * @param {{ items: { label: string, onPress?: function }[] }} props
 */
export default function Breadcrumb({ items = [] }) {
  const dark = useDark();
  return (
    <View className="flex-row items-center flex-wrap mb-2">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <View key={`${item.label}-${index}`} className="flex-row items-center">
            {item.onPress && !isLast ? (
              <Pressable onPress={item.onPress}>
                <Text className="text-sm text-primary font-inter">{item.label}</Text>
              </Pressable>
            ) : (
              <Text
                className={`text-sm font-inter ${
                  isLast ? (dark ? "text-white font-medium" : "text-text font-medium") : dark ? "text-white/50" : "text-text-muted"
                }`}
              >
                {item.label}
              </Text>
            )}
            {!isLast && (
              <Text className={`text-sm font-inter mx-1.5 ${dark ? "text-white/40" : "text-text-muted"}`}>/</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
