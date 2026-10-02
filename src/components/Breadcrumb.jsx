// src/components/Breadcrumb.jsx

import { View, Text, Pressable } from "react-native";

/**
 * @param {{ items: { label: string, onPress?: function }[] }} props
 */
export default function Breadcrumb({ items = [] }) {
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
                  isLast ? "text-text font-medium" : "text-text-muted"
                }`}
              >
                {item.label}
              </Text>
            )}
            {!isLast && (
              <Text className="text-sm text-text-muted font-inter mx-1.5">/</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
