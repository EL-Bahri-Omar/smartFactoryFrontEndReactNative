// app/(app)/reports.jsx — stub (reports ship after analytics).
import { ScrollView } from "react-native";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import EmptyState from "../../src/components/EmptyState";

export default function ReportsStub() {
  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Card>
          <EmptyState
            title="Reports coming soon"
            message="Downtime, performance and exportable reports will live here."
          />
        </Card>
      </ScrollView>
    </AppShell>
  );
}
