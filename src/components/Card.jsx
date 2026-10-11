// src/components/Card.jsx
// Rounded card with surface bg, border, shadow per ui-notes.
// Dark mode: smooth slate surface (#1E293B) with light text inside.

import { View } from "react-native";
import { useDark } from "../hooks/useDark";

export default function Card({ children, className = "", style }) {
  const dark = useDark();
  return (
    <View
      className={`rounded-card border p-4 ${dark ? "bg-darkcard border-white/10" : "bg-surface border-border"} ${className}`}
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
