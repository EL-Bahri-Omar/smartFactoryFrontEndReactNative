// app/(app)/__shell-test.jsx
// TEMPORARY — delete in a later prompt.
// Shows the AppShell, all buttons, badges, inputs, and primitives for visual QA.

import { View, Text, ScrollView } from "react-native";
import { useState } from "react";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Input from "../../src/components/Input";
import Checkbox from "../../src/components/Checkbox";
import Select from "../../src/components/Select";
import Toggle from "../../src/components/Toggle";
import StatusBadge from "../../src/components/StatusBadge";
import SeverityBadge from "../../src/components/SeverityBadge";
import DeltaChip from "../../src/components/DeltaChip";
import EmptyState from "../../src/components/EmptyState";
import Skeleton from "../../src/components/Skeleton";
import Avatar from "../../src/components/Avatar";
import Divider from "../../src/components/Divider";
import LogoMark from "../../src/components/LogoMark";

export default function ShellTest() {
  const [inputVal, setInputVal] = useState("");
  const [checked, setChecked] = useState(false);
  const [toggleVal, setToggleVal] = useState(true);
  const [selectVal, setSelectVal] = useState(null);

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-text font-inter mb-4">
          Design System — Shell Test
        </Text>

        {/* Logo variants */}
        <Card className="mb-4">
          <Text className="text-sm font-semibold text-text mb-3 font-inter">LogoMark</Text>
          <View className="gap-3">
            <LogoMark size="lg" />
            <LogoMark size="md" />
            <LogoMark size="sm" />
          </View>
        </Card>

        {/* Buttons */}
        <Card className="mb-4">
          <Text className="text-sm font-semibold text-text mb-3 font-inter">Buttons</Text>
          <View className="flex-row flex-wrap gap-2">
            <Button title="Primary" variant="primary" onPress={() => {}} />
            <Button title="Outline" variant="outline" onPress={() => {}} />
            <Button title="Ghost" variant="ghost" onPress={() => {}} />
            <Button title="Danger" variant="danger" onPress={() => {}} />
          </View>
          <Divider />
          <View className="flex-row flex-wrap gap-2">
            <Button title="Small" variant="primary" size="sm" onPress={() => {}} />
            <Button title="Loading" variant="primary" loading onPress={() => {}} />
            <Button title="Disabled" variant="primary" disabled onPress={() => {}} />
          </View>
        </Card>

        {/* Inputs */}
        <Card className="mb-4">
          <Text className="text-sm font-semibold text-text mb-3 font-inter">Inputs</Text>
          <View className="gap-3 max-w-sm">
            <Input
              label="Email"
              placeholder="user@factory.com"
              value={inputVal}
              onChangeText={setInputVal}
            />
            <Input
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              value=""
              onChangeText={() => {}}
            />
            <Input
              label="With Error"
              placeholder="Required"
              value=""
              error="This field is required"
              onChangeText={() => {}}
            />
            <Input
              label="Disabled"
              placeholder="Can't edit"
              value="Read only"
              disabled
              onChangeText={() => {}}
            />
          </View>
        </Card>

        {/* Checkbox, Toggle, Select */}
        <Card className="mb-4">
          <Text className="text-sm font-semibold text-text mb-3 font-inter">Controls</Text>
          <View className="gap-4 max-w-sm">
            <Checkbox label="Remember me" checked={checked} onChange={setChecked} />
            <Checkbox label="Disabled checkbox" checked disabled />
            <Toggle label="Enable Notifications" value={toggleVal} onChange={setToggleVal} />
            <Toggle label="Dark Mode" value={false} onChange={() => {}} />
            <Select
              label="Machine Status"
              value={selectVal}
              onValueChange={setSelectVal}
              placeholder="Select status..."
              options={[
                { value: "RUNNING", label: "Running" },
                { value: "IDLE", label: "Idle" },
                { value: "MAINTENANCE", label: "Maintenance" },
                { value: "FAILURE", label: "Failure" },
                { value: "OFFLINE", label: "Offline" },
              ]}
            />
          </View>
        </Card>

        {/* Status & Severity Badges */}
        <Card className="mb-4">
          <Text className="text-sm font-semibold text-text mb-3 font-inter">Badges</Text>
          <Text className="text-xs text-text-muted mb-2 font-inter">Machine Status</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            <StatusBadge status="RUNNING" />
            <StatusBadge status="IDLE" />
            <StatusBadge status="MAINTENANCE" />
            <StatusBadge status="FAILURE" />
            <StatusBadge status="OFFLINE" />
          </View>
          <Text className="text-xs text-text-muted mb-2 font-inter">Alert Severity</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            <SeverityBadge severity="HIGH" />
            <SeverityBadge severity="MEDIUM" />
            <SeverityBadge severity="LOW" />
          </View>
          <Text className="text-xs text-text-muted mb-2 font-inter">Delta Chips</Text>
          <View className="flex-row flex-wrap gap-2">
            <DeltaChip value={1.2} />
            <DeltaChip value={-0.5} />
            <DeltaChip value={0} />
            <DeltaChip value={12.8} />
          </View>
        </Card>

        {/* Avatars */}
        <Card className="mb-4">
          <Text className="text-sm font-semibold text-text mb-3 font-inter">Avatars</Text>
          <View className="flex-row items-center gap-3">
            <Avatar name="John Doe" size="sm" />
            <Avatar name="Jane Smith" size="md" />
            <Avatar name="Admin User" size="lg" />
            <Avatar name="Tech" size="md" color="#0EA5A4" />
          </View>
        </Card>

        {/* Skeleton */}
        <Card className="mb-4">
          <Text className="text-sm font-semibold text-text mb-3 font-inter">Skeletons</Text>
          <View className="gap-2">
            <Skeleton width="100%" height={20} />
            <Skeleton width="75%" height={14} />
            <Skeleton width="50%" height={14} />
            <View className="flex-row gap-2 mt-1">
              <Skeleton width={40} height={40} rounded />
              <View className="flex-1 gap-2">
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={10} />
              </View>
            </View>
          </View>
        </Card>

        {/* Empty State */}
        <Card className="mb-4">
          <Text className="text-sm font-semibold text-text mb-3 font-inter">Empty State</Text>
          <EmptyState
            title="No machines found"
            message="Add your first machine to get started with monitoring."
            action={<Button title="Add Machine" variant="primary" size="sm" onPress={() => {}} />}
          />
        </Card>

        <View className="h-8" />
      </ScrollView>
    </AppShell>
  );
}
