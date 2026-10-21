// app/(app)/ai.jsx — stub until Sprint 8 (AI integration, only if the MVP is stable).
//
// Honest placeholder: no invented predictions. It explains what will be
// added and points at the real, working equivalents available today.

import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import EmptyState from "../../src/components/EmptyState";
import { useDark } from "../../src/hooks/useDark";

export default function AiStub() {
  const dark = useDark();
  const router = useRouter();

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className={`text-2xl font-bold font-inter mb-1 ${dark ? "text-white" : "text-text"}`}>
          AI Analytics
        </Text>
        <Text className={`text-sm font-inter mb-5 ${dark ? "text-white/60" : "text-text-muted"}`}>
          Predictive maintenance and anomaly detection.
        </Text>

        <Card>
          <EmptyState
            title="Planned for Sprint 8"
            message="Predictions will be generated from real sensor history once the MVP is stable — nothing here is simulated in the meantime."
            action={
              <View className="flex-row gap-2">
                <Button
                  title="Open Alerts"
                  variant="primary"
                  size="sm"
                  onPress={() => router.push("/(app)/alerts")}
                />
                <Button
                  title="Maintenance recommendations"
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
