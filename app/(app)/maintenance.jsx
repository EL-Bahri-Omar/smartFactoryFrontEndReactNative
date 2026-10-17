// app/(app)/maintenance.jsx — stub until Sprint 6 (maintenance tickets).
import { ScrollView } from "react-native";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import EmptyState from "../../src/components/EmptyState";

export default function MaintenanceStub() {
  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Card>
          <EmptyState
            title="Maintenance coming in Sprint 6"
            message="Tickets, diagnostics and interventions will live here."
          />
        </Card>
      </ScrollView>
    </AppShell>
  );
}
