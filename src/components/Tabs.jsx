// src/components/Tabs.jsx

import { View, Text, Pressable, ScrollView } from "react-native";

/**
 * @param {{ tabs: { key: string, label: string }[], active: string, onChange: function, scrollable?: boolean }} props
 */
export default function Tabs({ tabs = [], active, onChange, scrollable = false }) {
  const row = (
    <View className="flex-row items-center gap-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange?.(tab.key)}
            className={`px-3 py-2 rounded-btn ${isActive ? "bg-primary-soft" : ""}`}
          >
            <Text
              className={`text-sm font-inter ${
                isActive ? "text-primary font-bold" : "text-text-muted font-medium"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 8 }}
      >
        {row}
      </ScrollView>
    );
  }

  return row;
}
