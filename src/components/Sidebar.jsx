// src/components/Sidebar.jsx
// Desktop only (>=1024px) + mobile/tablet drawer. Navy sidebar.
// Menus are organized in collapsible groups, each with its own submenu list.
// Per ui-notes: bg #0B1D3A, text #C7D2E1, active pill #1E3A8A.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { useRole } from "../hooks/useRole";
import { ROLES } from "../constants/roles";
import LogoMark from "./LogoMark";
import Avatar from "./Avatar";
import Divider from "./Divider";

const NAV_GROUPS = [
  {
    key: "supervision",
    label: "Supervision",
    items: [
      { label: "Dashboard", icon: "📊", path: "/(app)/dashboard", access: "dashboard" },
      { label: "Machines", icon: "🏭", path: "/(app)/machines", access: "machines" },
      { label: "Map & Zones", icon: "🗺️", path: "/(app)/map", access: "map" },
    ],
  },
  {
    key: "monitoring",
    label: "Monitoring",
    items: [
      { label: "Alerts", icon: "🔔", path: "/(app)/alerts", access: "alerts" },
      { label: "Notifications", icon: "📣", path: "/(app)/notifications" },
      { label: "Maintenance", icon: "🔧", path: "/(app)/maintenance", access: "maintenance" },
      { label: "History", icon: "📜", path: "/(app)/history" },
    ],
  },
  {
    key: "management",
    label: "Management",
    items: [
      { label: "Users", icon: "👥", path: "/(app)/users", access: "users" },
      { label: "Groups", icon: "👪", path: "/(app)/groups", access: "groups", excludeRoles: [ROLES.TECHNICIAN, ROLES.RESPONSABLE_INDUSTRIEL] },
      { label: "My Group", icon: "👤", path: "/(app)/my-group", access: "myGroup", roles: [ROLES.OPERATOR, ROLES.RESPONSABLE_INDUSTRIEL] },
      { label: "Roles", icon: "🛡️", path: "/(app)/roles", access: "roles" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    items: [
      { label: "Reports", icon: "📄", path: "/(app)/reports", access: "reports" },
      { label: "AI Analytics", icon: "🤖", path: "/(app)/ai" },
    ],
  },
  {
    key: "system",
    label: "System",
    items: [
      { label: "Settings", icon: "⚙", path: "/(app)/settings" },
    ],
  },
];

export default function Sidebar({ user, onNavigate }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccess, role, isAdmin, hasAnyPermission } = useRole();
  const [collapsed, setCollapsed] = useState({});
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  // In the mobile/tablet drawer the sidebar starts at the very top of the
  // screen — pad below the status bar (0 on desktop web).
  const insets = useSafeAreaInsets();

  // Restore scroll position after route change re-renders
  useEffect(() => {
    if (scrollRef.current && scrollY.current > 0) {
      // On web, directly set the DOM scrollTop for instant restore
      const node = scrollRef.current;
      if (node?.scrollTo) {
        requestAnimationFrame(() => {
          node.scrollTo({ y: scrollY.current, animated: false });
        });
      }
    }
  }, [pathname]);

  function go(path) {
    router.navigate(path);
    onNavigate?.();
  }

  function isActive(path) {
    if (path === "/(app)") return pathname === "/" || pathname === "/(app)";
    return pathname.startsWith(path.replace("/(app)", ""));
  }

  function visibleItems(items) {
    return items.filter((item) => {
      if (item.access === "roles") {
        // Roles page: admins (ROLE_ADMIN authority) or any fine ROLE_* grant.
        return isAdmin || hasAnyPermission("ROLE_READ", "ROLE_CREATE", "ROLE_UPDATE", "ROLE_DELETE");
      }
      return (
        (!item.access || canAccess(item.access)) &&
        (!item.roles || (role && item.roles.includes(role))) &&
        (!item.excludeRoles || !(role && item.excludeRoles.includes(role)))
      );
    });
  }

  const groups = NAV_GROUPS.map((g) => ({ ...g, items: visibleItems(g.items) })).filter(
    (g) => g.items.length > 0
  );

  function toggleGroup(key) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
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

      {/* Grouped navigation */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, paddingHorizontal: 12, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >
        {groups.map((group, gi) => {
          const isCollapsed = !!collapsed[group.key];
          const hasActiveChild = group.items.some((item) => isActive(item.path));
          return (
            <View key={group.key} className={gi > 0 ? "mt-1" : ""}>
              <Pressable
                onPress={() => toggleGroup(group.key)}
                className="flex-row items-center px-3 pt-2.5 pb-1.5"
              >
                <Text className={`text-[11px] font-bold font-inter uppercase flex-1 ${hasActiveChild ? "text-white" : "text-sidebar-text/70"}`} style={{ letterSpacing: 1 }}>
                  {group.label}
                </Text>
                <Text className="text-[10px] text-sidebar-text/70">
                  {isCollapsed && !hasActiveChild ? "›" : "⌄"}
                </Text>
              </Pressable>
              {(!isCollapsed || hasActiveChild) && (
                <View
                  className="ml-3 pl-2 mb-1"
                  style={{ borderLeftWidth: 1, borderLeftColor: "rgba(199,210,225,0.15)" }}
                >
                  {group.items.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <Pressable
                        key={item.path}
                        onPress={() => go(item.path)}
                        className={`flex-row items-center gap-3 px-3 py-2.5 rounded-btn mb-0.5 ${
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
                </View>
              )}
            </View>
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
