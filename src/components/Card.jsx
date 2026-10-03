// src/components/Card.jsx
// Rounded card with surface bg, border, shadow per ui-notes.
// In dark mode the surface drops to a slightly darker white (#F1F5F9)
// while content text stays dark — readable in both modes.

import { View } from "react-native";
import { useDark } from "../hooks/useDark";

export default function Card({ children, className = "", style }) {
  const dark = useDark();
  return (
    <View
      className={`rounded-card border p-4 ${dark ? "bg-[#F1F5F9] border-white/20" : "bg-surface border-border"} ${className}`}
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
