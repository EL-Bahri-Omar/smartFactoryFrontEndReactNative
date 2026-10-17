// app/(app)/ai.jsx — stub until Sprint 8 (AI integration, only if the MVP is stable).
import { ScrollView } from "react-native";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import EmptyState from "../../src/components/EmptyState";

export default function AiStub() {
  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Card>
          <EmptyState
            title="AI Analytics coming in Sprint 8"
            message="Predictions and recommendations integrate once the MVP is stable."
          />
        </Card>
      </ScrollView>
    </AppShell>
  );
}
