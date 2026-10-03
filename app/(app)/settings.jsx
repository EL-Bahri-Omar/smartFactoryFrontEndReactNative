// app/(app)/settings.jsx
//
// Settings — web + mobile, same file.
// Web:  Tabs (General · Machines · Notifications). Form fields + Save button.
// Mobile: Vertical section list with distinct section headers. Sticky Save button.
// (User management lives on the Users screen, not here.)
//
// Machines tab: ADMIN only (RB10). Dark Mode lives in General and applies instantly.

import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Input from "../../src/components/Input";
import Select from "../../src/components/Select";
import Toggle from "../../src/components/Toggle";
import Divider from "../../src/components/Divider";
import Skeleton from "../../src/components/Skeleton";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useRole } from "../../src/hooks/useRole";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import {
  fetchSettings,
  updateSettings,
  setGeneral,
  setNotifications,
  clearSaveStatus,
} from "../../src/store/slices/settingsSlice";
import { useDialog } from "../../src/components/dialog/DialogContext";

const TABS = [
  { key: "general", label: "General" },
  { key: "machines", label: "Machines", adminOnly: true },
  { key: "notifications", label: "Notifications" },
];

const TIMEZONE_OPTIONS = [
  { value: "UTC+00:00", label: "(UTC+00:00) London" },
  { value: "UTC+01:00", label: "(UTC+01:00) Tunis" },
  { value: "UTC+01:00-Paris", label: "(UTC+01:00) Paris" },
  { value: "UTC+02:00", label: "(UTC+02:00) Cairo" },
  { value: "UTC+03:00", label: "(UTC+03:00) Riyadh" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const breakpoint = useBreakpoint();
  const dark = useDark();
  const { isAdmin } = useRole();
  const isDesktop = breakpoint === "desktop";

  const { general, notifications, status, saveStatus, error } = useAppSelector(
    (s) => s.settings
  );
  const [activeTab, setActiveTab] = useState("general");

  // Fetch on mount
  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  // Success dialog (dialog fns are stable; keep out of deps to avoid re-firing)
  useEffect(() => {
    if (saveStatus === "saved") {
      dialog.alert("Success", "Settings saved successfully.", "success");
      const t = setTimeout(() => dispatch(clearSaveStatus()), 2000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus, dispatch]);

  function handleSave() {
    dispatch(updateSettings({ general, notifications }));
  }

  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const isSaving = saveStatus === "saving";
  const isLoading = status === "loading";

  // ── TAB CONTENT ─────────────────────────────────────────────────────

  function renderGeneralTab() {
    return (
      <Card className="mb-4">
        <Text className="text-base font-bold text-text font-inter mb-4">
          General Settings
        </Text>
        <View className="gap-4">
          <Input
            label="Factory Name"
            placeholder="SmartFactory"
            value={general.factoryName}
            onChangeText={(v) => dispatch(setGeneral({ factoryName: v }))}
          />
          <Select
            label="Timezone"
            value={general.timezone}
            onValueChange={(v) => dispatch(setGeneral({ timezone: v }))}
            options={TIMEZONE_OPTIONS}
          />
          <Select
            label="Language"
            value={general.language}
            onValueChange={(v) => dispatch(setGeneral({ language: v }))}
            options={LANGUAGE_OPTIONS}
          />
          <Select
            label="Date Format"
            value={general.dateFormat}
            onValueChange={(v) => dispatch(setGeneral({ dateFormat: v }))}
            options={DATE_FORMAT_OPTIONS}
          />
          <Divider />
          <View>
            <Toggle
              label="Dark Mode"
              value={notifications.darkMode}
              onChange={(v) => dispatch(setNotifications({ darkMode: v }))}
            />
            <Text className="text-xs text-text-muted font-inter mt-1.5 ml-0">
              Applies instantly — also available from the sun/moon button in the top bar
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  function renderNotificationsTab() {
    return (
      <Card className="mb-4">
        <Text className="text-base font-bold text-text font-inter mb-4">
          Notifications
        </Text>
        <View className="gap-5">
          <Toggle
            label="Enable Notifications"
            value={notifications.enableNotifications}
            onChange={(v) => dispatch(setNotifications({ enableNotifications: v }))}
          />
        </View>
      </Card>
    );
  }

  function renderMachinesTab() {
    return (
      <Card className="mb-4">
        <Text className="text-base font-bold text-text font-inter mb-2">
          Machine Configuration
        </Text>
        <Text className="text-sm text-text-muted font-inter mb-4">
          Configure global machine settings and thresholds.
        </Text>
        <View className="bg-bg rounded-btn p-4 items-center">
          <Text className="text-sm text-text-muted font-inter">
            Machine configuration will be available in a future sprint.
          </Text>
        </View>
      </Card>
    );
  }

  function renderActiveTab() {
    switch (activeTab) {
      case "general":
        return renderGeneralTab();
      case "machines":
        return renderMachinesTab();
      case "notifications":
        return renderNotificationsTab();
      default:
        return renderGeneralTab();
    }
  }

  // ── WEB LAYOUT ────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <AppShell>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-5">
            <Text className={`text-2xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>Settings</Text>
          </View>

          {/* Tabs */}
          <View className="flex-row border-b border-border mb-5">
            {visibleTabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 mr-1 border-b-2 ${
                    active ? "border-primary" : "border-transparent"
                  }`}
                >
                  <Text
                    className={`text-sm font-inter ${
                      active
                        ? "text-primary font-semibold"
                        : "text-text-muted font-medium"
                    }`}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Error */}
          {(status === "error" || saveStatus === "error") && error && (
            <View
              className="bg-danger/10 rounded-btn px-3 py-2.5 mb-4"
              style={{
                borderWidth: 1,
                borderColor: "rgba(220,38,38,0.25)",
              }}
            >
              <Text className="text-sm text-danger font-inter">
                {error.message || "Something went wrong"}
              </Text>
            </View>
          )}

          {/* Loading */}
          {isLoading ? (
            <Card>
              <View className="gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} className="gap-2">
                    <Skeleton width={100} height={14} />
                    <Skeleton width="100%" height={38} />
                  </View>
                ))}
              </View>
            </Card>
          ) : (
            <>
              {/* Tab content */}
              <View style={{ maxWidth: 600 }}>{renderActiveTab()}</View>

              {/* Save button (success arrives via dialog — no extra box) */}
              {(activeTab === "general" || activeTab === "notifications") && (
                <View className="flex-row justify-end mt-2" style={{ maxWidth: 600 }}>
                  <Button
                    title="Save Changes"
                    variant="primary"
                    onPress={handleSave}
                    loading={isSaving}
                  />
                </View>
              )}
            </>
          )}
        </ScrollView>
      </AppShell>
    );
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────
  return (
    <AppShell>
      <View className="flex-1">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <Text className={`text-xl font-bold font-inter mb-4 ${dark ? "text-white" : "text-text"}`}>Settings</Text>

          {/* Error */}
          {(status === "error" || saveStatus === "error") && error && (
            <View
              className="bg-danger/10 rounded-btn px-3 py-2.5 mb-4"
              style={{
                borderWidth: 1,
                borderColor: "rgba(220,38,38,0.25)",
              }}
            >
              <Text className="text-sm text-danger font-inter">
                {error.message || "Something went wrong"}
              </Text>
            </View>
          )}

          {isLoading ? (
            <Card>
              <View className="gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} className="gap-2">
                    <Skeleton width={100} height={14} />
                    <Skeleton width="100%" height={38} />
                  </View>
                ))}
              </View>
            </Card>
          ) : (
            <>
              {/* General Section */}
              <SectionHeader title="General" />
              <Card className="mb-4">
                <View className="gap-4">
                  <Input
                    label="Factory Name"
                    labelClassName="font-bold"
                    placeholder="SmartFactory"
                    value={general.factoryName}
                    onChangeText={(v) => dispatch(setGeneral({ factoryName: v }))}
                  />
                  <Select
                    label="Timezone"
                    labelClassName="font-bold"
                    value={general.timezone}
                    onValueChange={(v) => dispatch(setGeneral({ timezone: v }))}
                    options={TIMEZONE_OPTIONS}
                  />
                  <Select
                    label="Language"
                    labelClassName="font-bold"
                    value={general.language}
                    onValueChange={(v) => dispatch(setGeneral({ language: v }))}
                    options={LANGUAGE_OPTIONS}
                  />
                  <Select
                    label="Date Format"
                    labelClassName="font-bold"
                    value={general.dateFormat}
                    onValueChange={(v) => dispatch(setGeneral({ dateFormat: v }))}
                    options={DATE_FORMAT_OPTIONS}
                  />
                  <Divider />
                  <Toggle
                    label="Dark Mode"
                    value={notifications.darkMode}
                    onChange={(v) =>
                      dispatch(setNotifications({ darkMode: v }))
                    }
                  />
                </View>
              </Card>

              {/* Machines Section (ADMIN) */}
              {isAdmin && (
                <>
                  <SectionHeader title="Machines" />
                  <Card className="mb-4">
                    <Text className="text-sm text-text-muted font-inter">
                      Machine configuration available in a future sprint.
                    </Text>
                  </Card>
                </>
              )}

              {/* Notifications Section */}
              <SectionHeader title="Notifications" />
              <Card className="mb-4">
                <View className="gap-5">
                  <Toggle
                    label="Enable Notifications"
                    value={notifications.enableNotifications}
                    onChange={(v) =>
                      dispatch(setNotifications({ enableNotifications: v }))
                    }
                  />
                </View>
              </Card>

              {/* Spacer for sticky button */}
              <View className="h-16" />
            </>
          )}
        </ScrollView>

        {/* Sticky Save button (success arrives via dialog — no extra box) */}
        {!isLoading && (
          <View
            className="px-0 pb-2 pt-2 border-t border-border"
            style={{ backgroundColor: dark ? "#060F24" : "#F6F8FB" }}
          >
            <Button
              title="Save Changes"
              variant="primary"
              onPress={handleSave}
              loading={isSaving}
              className="w-full"
              size="lg"
            />
          </View>
        )}
      </View>
    </AppShell>
  );
}

// ── Section header for mobile: distinct pill title ───────────────────────

function SectionHeader({ title }) {
  const dark = useDark();
  return (
    <View className="flex-row items-center gap-2 mb-2 mt-2">
      <View className="w-1 rounded-full bg-primary" style={{ height: 18 }} />
      <Text className={`text-sm font-bold uppercase tracking-wider font-inter ${dark ? "text-white" : "text-text"}`}>
        {title}
      </Text>
    </View>
  );
}
