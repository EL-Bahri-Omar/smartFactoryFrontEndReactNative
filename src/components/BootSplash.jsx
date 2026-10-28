// src/components/BootSplash.jsx
//
// The very first paint while `bootstrapAuth` rehydrates the session.
//
// Before this, the app showed a bare ActivityIndicator on a white screen for
// as long as the token check took — which reads as "the app is slow". A
// branded splash with the product name makes the same wait feel intentional,
// and gives us one place to change the boot experience.

import { View, Text, ActivityIndicator, Image } from "react-native";

export default function BootSplash({ label = "Loading your workspace…" }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F6F8FB",
      }}
    >
      <View style={{ alignItems: "center" }}>
        {/* App logo (app.json → ./assets/icon.png) — the agreed SmartFactory
            mark, same image as the sidebar header. */}
        <Image
          source={require("../../assets/icon.png")}
          resizeMode="contain"
          style={{
            width: 68,
            height: 68,
            marginBottom: 18,
            borderRadius: 18,
            shadowColor: "#2563EB",
            shadowOpacity: 0.25,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
          }}
          accessibilityLabel="SmartFactory logo"
        />

        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "#0F172A",
            letterSpacing: 0.2,
          }}
        >
          SmartFactory
        </Text>
        <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2, letterSpacing: 1 }}>
          INDUSTRIAL INTELLIGENCE
        </Text>

        <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 28 }} />
        <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 10 }}>{label}</Text>
      </View>
    </View>
  );
}
