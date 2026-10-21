// app/(app)/reports.jsx — stub (reports ship after analytics, Sprint 7).
//
// Honest placeholder: no mock charts, no fake numbers. It states what the
// screen will contain and where to get the same information today.

import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import EmptyState from "../../src/components/EmptyState";
import { useDark } from "../../src/hooks/useDark";

export default function ReportsStub() {
  const dark = useDark();
  const router = useRouter();

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className={`text-2xl font-bold font-inter mb-1 ${dark ? "text-white" : "text-text"}`}>Reports</Text>
        <Text className={`text-sm font-inter mb-5 ${dark ? "text-white/60" : "text-text-muted"}`}>
          Downtime, performance and exportable summaries.
        </Text>

        <Card>
          <EmptyState
            title="Reports arrive with Sprint 7"
            message="This screen will build downtime, availability and performance reports from the sensor history — no estimated numbers."
            action={
              <View className="flex-row gap-2">
                <Button
                  title="Open History"
                  variant="primary"
                  size="sm"
                  onPress={() => router.push("/(app)/history")}
                />
                <Button
                  title="View Maintenance"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push("/(app)/maintenance")}
                />
              </View>
            }
          />
        </Card>
      </ScrollView>
    </AppShell>
  );
}
