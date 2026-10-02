// app/(app)/dashboard.jsx
//
// TEMPORARY Sprint 1 placeholder. The full Dashboard (KPIs, Factory Overview,
// live data) is built in prompt 12 (Sprint 7). Until then, login lands here
// and users navigate to the working Sprint 1 screens. No mocks, no fake data.

import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import EmptyState from "../../src/components/EmptyState";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useDark } from "../../src/hooks/useDark";
import { useRole } from "../../src/hooks/useRole";

export default function DashboardPlaceholder() {
  const router = useRouter();
  const dark = useDark();
  const { canAccess, homeRoute } = useRole();
  const user = useAppSelector((s) => s.auth.user);
  const firstName = user?.firstName || "there";

  if (!canAccess("dashboard")) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            title="Restricted area"
            message="The dashboard is available to administrators and responsables industriels."
            action={<Button title="Go to Factory Map" variant="primary" size="sm" onPress={() => router.replace(homeRoute)} />}
          />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className={`text-2xl font-bold font-inter mb-1 ${dark ? "text-white" : "text-text"}`}>
          Good morning, {firstName}
        </Text>
        <Text className={`text-sm font-inter mb-6 ${dark ? "text-white/60" : "text-text-muted"}`}>
          The full dashboard ships in Sprint 7.
        </Text>

        <Card className="mb-4">
          <EmptyState
            title="Dashboard coming in Sprint 7"
            message="KPIs, factory overview and live monitoring will live here."
          />
          <View className="flex-row gap-3 mt-4 flex-wrap">
            <Button title="View Machines" variant="primary" size="sm" onPress={() => router.push("/(app)/machines")} />
            <Button title="Open Factory Map" variant="outline" size="sm" onPress={() => router.push("/(app)/map")} />
            <Button title="Settings" variant="ghost" size="sm" onPress={() => router.push("/(app)/settings")} />
          </View>
        </Card>
      </ScrollView>
    </AppShell>
  );
}
