// src/components/BottomTabs.jsx
// Mobile bottom tabs (review history: More → Settings, notifications moved
// here from the TopBar with its unread badge, Maintenance for technician +
// responsable industriel, My Group for operator, alerts removed — it stays in
// the TopBar only; ADMIN has no mobile screens, web only).
//
// Selected tab = filled pill background + brand text colour (review: "add
// background color and different text color for selected bottom bar menu",
// "this update does not appear in mobile view"). Two traps avoided:
// 1. usePathname() STRIPS route groups — it returns "/map", not
//    "/(app)/map" — so comparing raw tab paths never matched and the active
//    state never showed. Both sides are normalised here.
// 2. The colours are inline `style` values instead of conditional Tailwind
//    arbitrary classes, so they render regardless of class extraction.

import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { useDark } from "../hooks/useDark";
import { useRole } from "../hooks/useRole";
import { useAppSelector } from "../hooks/useAppSelector";

/** "/(app)/map", "map", "/map/index?q=1" -> "/map" (root stays "/"). */
const normalize = (p) => {
  let s = String(p || "").split("?")[0].split("#")[0].trim();
  if (!s.startsWith("/")) s = "/" + s;
  s = s.replace(/\([^)]*\)/g, ""); // route groups: /(app)/map -> //map
  s = s.replace(/\/+/g, "/"); // collapse slashes
  s = s.replace(/\/index$/, ""); // /map/index -> /map
  if (s.length > 1) s = s.replace(/\/+$/, ""); // trailing slash
  return s || "/";
};

export default function BottomTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const dark = useDark();
  const { role } = useRole();
  const insets = useSafeAreaInsets();

  // Unread badge (same source as the old TopBar bell: server truth first,
  // STOMP local count as fallback).
  const serverUnread = useAppSelector((s) => s.notification?.unread?.server);
  const liveUnread = useAppSelector((s) => s.live?.unreadCount);
  const unreadCount = serverUnread != null ? serverUnread : liveUnread || 0;

  // Alerts removed from the bottom bar (review: "remove the alerts menu from
  // bottom menu bar, leave it only in top bar for all users" — operators have
  // no alerts at all; everyone else keeps the TopBar triangle).
  const tabs = [
    { label: "Map", icon: "🗺️", path: "/(app)/map" },
    role === "OPERATOR" && { label: "My Group", icon: "👤", path: "/(app)/my-group" },
    (role === "TECHNICIAN" || role === "RESPONSABLE_INDUSTRIEL") && {
      label: "Maintenance",
      icon: "🛠️",
      path: "/(app)/maintenance",
    },
    { label: "Notifications", icon: "🔔", path: "/(app)/notifications", badge: true },
    { label: "Settings", icon: "⚙️", path: "/(app)/settings" },
  ].filter(Boolean);

  const currentPath = normalize(pathname);

  return (
    <View
      className={`flex-row border-t pt-2 ${
        dark ? "bg-[#0B1D3A] border-white/10" : "bg-surface border-border"
      }`}
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      {tabs.map((tab) => {
        const tabPath = normalize(tab.path);
        const active =
          currentPath === tabPath || (tabPath !== "/" && currentPath.startsWith(tabPath + "/"));
        return (
          <Pressable
            key={tab.path}
            onPress={() => router.push(tab.path)}
            // Selected tab: filled pill — navy on dark, blue tint on light.
            className="flex-1 items-center justify-center rounded-xl py-1.5 mx-1"
            style={{
              backgroundColor: active ? (dark ? "#1E3A8A" : "#DBEAFE") : "transparent",
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <View>
              <Text style={{ fontSize: 18, opacity: active ? 1 : 0.6 }}>
                {tab.icon}
              </Text>
              {tab.badge && unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -10,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    paddingHorizontal: 3,
                    backgroundColor: "#DC2626",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "bold" }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text
              numberOfLines={1}
              className="font-inter"
              style={{
                fontSize: 9,
                marginTop: 2,
                fontWeight: active ? "700" : "500",
                color: active
                  ? dark
                    ? "#93C5FD"
                    : "#1D4ED8"
                  : dark
                    ? "rgba(255,255,255,0.5)"
                    : "#64748B",
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
