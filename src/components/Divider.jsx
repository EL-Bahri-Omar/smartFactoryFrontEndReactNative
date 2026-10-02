// src/components/Divider.jsx

import { View } from "react-native";

export default function Divider({ className = "" }) {
  return <View className={`h-px bg-border my-3 ${className}`} />;
}
