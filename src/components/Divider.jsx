// src/components/Divider.jsx

import { View } from "react-native";
import { useDark } from "../hooks/useDark";

export default function Divider({ className = "" }) {
  const dark = useDark();
  return <View className={`h-px my-3 ${dark ? "bg-white/10" : "bg-border"} ${className}`} />;
}
