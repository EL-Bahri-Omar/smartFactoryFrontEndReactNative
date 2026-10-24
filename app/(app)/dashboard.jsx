// app/(app)/dashboard.jsx
//
// Sprint 6 build — the operational dashboard (KPIs, alert summary,
// maintenance overview) is scheduled for SPRINT 7. Until then the screen
// shows an honest "no data yet" placeholder (review: "show no data in
// dashboard page, dashboard comes in sprint 7") instead of tiles backed by
// endpoints that don't exist yet.

import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import EmptyState from "../../src/components/EmptyState";
import TopBar from "../../src/components/TopBar";
import { useDark } from "../../src/hooks/useDark";
import { useRole } from "../../src/hooks/useRole";
import { useAppSelector } from "../../src/hooks/useAppSelector";

export default function DashboardScreen() {
  const dark = useDark();
  const router = useRouter();
  const { canAccess, homeRoute, user } = useRole();

  const darkText = dark ? "text-white" : "text-text";
  const darkMuted = dark ? "text-white/60" : "text-text-muted";

  if (!canAccess("dashboard")) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            icon={<Text className="text-3xl">🔒</Text>}
            title="Access restricted"
            message="Your role does not include the dashboard."
          />
          <Button
            title={`Go to ${homeRoute.replace("/(app)/", "")}`}
            variant="outline"
            size="sm"
            onPress={() => router.replace(homeRoute)}
          />
        </Card>
      </AppShell>
    );
  }

  const firstName = user?.firstName || "there";

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-5">
          <Text className={`text-2xl font-bold font-inter ${darkText}`}>
            {`Welcome back, ${firstName}!`}
          </Text>
          <Text className={`text-sm font-inter mt-1 ${darkMuted}`}>
            SmartFactory Expo — your factory at a glance.
          </Text>
        </View>

        {/* Sprint 7 placeholder — no fake KPIs (review). */}
        <Card>
          <EmptyState
            icon={<Text className="text-3xl">📊</Text>}
            title="No data yet"
            message="The dashboard arrives in Sprint 7 — machine KPIs, alert summary and the maintenance overview will appear here."
          />
        </Card>
      </ScrollView>
    </AppShell>
  );
}
