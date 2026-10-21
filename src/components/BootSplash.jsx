// src/components/BootSplash.jsx
//
// The very first paint while `bootstrapAuth` rehydrates the session.
//
// Before this, the app showed a bare ActivityIndicator on a white screen for
// as long as the token check took — which reads as "the app is slow". A
// branded splash with the product name makes the same wait feel intentional,
// and gives us one place to change the boot experience.

import { View, Text, ActivityIndicator } from "react-native";

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
        {/* Logo mark — same identity as the login screen */}
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            backgroundColor: "#2563EB",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
            shadowColor: "#2563EB",
            shadowOpacity: 0.25,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          <Text style={{ fontSize: 32, color: "#FFFFFF", lineHeight: 38 }}>⚙</Text>
        </View>

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
