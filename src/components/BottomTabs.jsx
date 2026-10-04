// src/components/BottomTabs.jsx
// Mobile bottom tabs, filtered by role access:
// supervisors (ADMIN, RESPONSABLE_INDUSTRIEL): Home, Machines, Alerts, More.
// other roles: Map, Alerts, More (Home points at their landing page).

import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { useDark } from "../hooks/useDark";
import { useRole } from "../hooks/useRole";

const FULL_TABS = [
  { label: "Home", icon: "🏠", path: "/(app)/dashboard" },
  { label: "Machines", icon: "⚙️", path: "/(app)/machines" },
  { label: "Alerts", icon: "🔔", path: "/(app)/alerts" },
  { label: "More", icon: "☰", path: "/(app)/settings" },
];

const LIMITED_TABS = [
  { label: "Map", icon: "🗺️", path: "/(app)/map" },
  { label: "Group", icon: "👤", path: "/(app)/my-group", roles: ["OPERATOR", "RESPONSABLE_INDUSTRIEL"] },
  { label: "Alerts", icon: "🔔", path: "/(app)/alerts" },
  { label: "More", icon: "☰", path: "/(app)/settings" },
];

export default function BottomTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const dark = useDark();
  const { canAccess, role } = useRole();
  const base = canAccess("dashboard") ? FULL_TABS : LIMITED_TABS;
  const tabs = base.filter((t) => !t.roles || (role && t.roles.includes(role)));
  // Lift labels above the phone gesture / navigation bar (0 on web).
  const insets = useSafeAreaInsets();

  function isActive(path) {
    return pathname.startsWith(path.replace("/(app)", ""));
  }

  return (
    <View
      className={`border-t flex-row items-stretch ${dark ? "bg-[#0B1D3A] border-white/10" : "bg-surface border-border"}`}
      style={{ minHeight: 64, paddingBottom: insets.bottom }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <Pressable
            key={tab.path}
            onPress={() => router.push(tab.path)}
            className={`flex-1 items-center justify-center gap-0.5 mx-1 my-1 rounded-btn ${
              active ? "bg-primary/10" : ""
            }`}
          >
            {/* Explicit color so monochrome glyphs (e.g. ☰) stay visible in
                dark mode; color emojis ignore it. Active tab gets a pill bg. */}
            <Text style={{ fontSize: 20, opacity: active ? 1 : 0.6, color: dark ? "#FFFFFF" : "#0F172A" }}>{tab.icon}</Text>
            <Text
              className={`text-[10px] font-inter ${
                active ? "text-primary font-bold" : dark ? "text-white/60" : "text-text-muted"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
