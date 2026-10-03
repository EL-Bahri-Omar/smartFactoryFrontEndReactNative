// src/components/Sidebar.jsx
// Desktop only (>=1024px). Navy sidebar with navigation items.
// Per ui-notes: bg #0B1D3A, text #C7D2E1, active pill #1E3A8A.

import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { useRole } from "../hooks/useRole";
import LogoMark from "./LogoMark";
import Avatar from "./Avatar";
import Divider from "./Divider";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "📊", path: "/(app)/dashboard", access: "dashboard" },
  { label: "Machines", icon: "⚙️", path: "/(app)/machines", access: "machines" },
  { label: "Map & Zones", icon: "🗺️", path: "/(app)/map" },
  { label: "Users", icon: "👥", path: "/(app)/users", access: "users" },
  { label: "Alerts", icon: "🔔", path: "/(app)/alerts" },
  { label: "Maintenance", icon: "🔧", path: "/(app)/maintenance", access: "maintenance" },
  { label: "History", icon: "📜", path: "/(app)/history" },
  { label: "Reports", icon: "📄", path: "/(app)/reports" },
  { label: "AI Analytics", icon: "🤖", path: "/(app)/ai" },
  { label: "Settings", icon: "⚙", path: "/(app)/settings" },
];

export default function Sidebar({ user, onNavigate }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccess } = useRole();
  const visibleItems = NAV_ITEMS.filter((item) => !item.access || canAccess(item.access));
  // In the mobile/tablet drawer the sidebar starts at the very top of the
  // screen — pad below the status bar (0 on desktop web).
  const insets = useSafeAreaInsets();

  function go(path) {
    router.push(path);
    onNavigate?.();
  }

  function isActive(path) {
    if (path === "/(app)") return pathname === "/" || pathname === "/(app)";
    return pathname.startsWith(path.replace("/(app)", ""));
  }

  return (
    <View
      className="w-60 bg-sidebar h-full"
      style={{ minHeight: "100vh", paddingTop: insets.top }}
    >
      {/* Logo */}
      <View className="px-5 pt-6 pb-4">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-lg bg-primary items-center justify-center">
            <Text className="text-white font-bold" style={{ fontSize: 14 }}>⚙</Text>
          </View>
          <View>
            <Text className="text-lg font-bold text-white font-inter">SmartFactory</Text>
            <Text className="text-xs text-sidebar-text font-inter">Industrial Intelligence</Text>
          </View>
        </View>
      </View>

      <View className="h-px bg-white/10 mx-4" />

      {/* Navigation */}
      <ScrollView className="flex-1 px-3 pt-4" showsVerticalScrollIndicator={false}>
        {visibleItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Pressable
              key={item.path}
              onPress={() => go(item.path)}
              className={`flex-row items-center gap-3 px-3 py-2.5 rounded-btn mb-1 ${
                active ? "bg-sidebar-active" : ""
              }`}
              style={({ pressed }) => (pressed && !active ? { backgroundColor: "rgba(255,255,255,0.05)" } : {})}
            >
              {/* Icon color is explicit so monochrome glyphs (e.g. ⚙) stay
                  visible on the navy sidebar; color emojis are unaffected. */}
              <Text style={{ fontSize: 16, color: active ? "#FFFFFF" : "#C7D2E1" }}>{item.icon}</Text>
              <Text className={`text-sm font-inter ${active ? "text-white font-bold" : "text-sidebar-text"}`}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* User footer -> profile */}
      <View className="h-px bg-white/10 mx-4" />
      <Pressable onPress={() => go("/(app)/profile")} className="px-4 py-4 flex-row items-center gap-3">
        <Avatar name={user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "User"} size="sm" />
        <View className="flex-1">
          <Text className="text-sm text-white font-medium font-inter" numberOfLines={1}>
            {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "User"}
          </Text>
          <Text className="text-xs text-sidebar-text font-inter">
            {user?.role || "—"}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
