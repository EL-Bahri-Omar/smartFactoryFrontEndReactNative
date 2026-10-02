// src/components/Card.jsx
// Rounded card with surface bg, border, shadow per ui-notes.

import { View } from "react-native";

export default function Card({ children, className = "", style }) {
  return (
    <View
      className={`bg-surface rounded-card border border-border p-4 ${className}`}
      style={[
        {
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 2,
          elevation: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
