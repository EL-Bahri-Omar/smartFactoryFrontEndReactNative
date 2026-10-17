// app/(app)/alerts.jsx — stub until Sprint 5 (alerts list screen).
import { ScrollView } from "react-native";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import EmptyState from "../../src/components/EmptyState";

export default function AlertsStub() {
  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Card>
          <EmptyState
            title="Alerts coming in Sprint 5"
            message="Threshold breaches already broadcast on /topic/alerts — the list screen ships with anomaly detection."
          />
        </Card>
      </ScrollView>
    </AppShell>
  );
}
