// src/components/SeverityBadge.jsx
// Shows alert severity as a colored pill.
// Uses src/lib/status.js for color lookup.

import { View, Text } from "react-native";
import { getAlertSeverity } from "../lib/status";

export default function SeverityBadge({ severity, className = "" }) {
  const { label, color } = getAlertSeverity(severity);

  return (
    <View
      className={`px-2.5 py-1 rounded-chip ${className}`}
      style={{ backgroundColor: color + "18" }}
    >
      <Text className="text-xs font-semibold font-inter" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
