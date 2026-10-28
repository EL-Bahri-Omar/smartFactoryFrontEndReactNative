// src/components/Sidebar.jsx
// Desktop only (>=1024px) + mobile/tablet drawer. Navy sidebar.
// Menus are organized in collapsible groups, each with its own submenu list.
// Per ui-notes: bg #0B1D3A, text #C7D2E1, active pill #1E3A8A.

import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Image } from "react-native";
import Svg, { Polyline } from "react-native-svg";
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

/**
 * Sidebar UI memory, in MODULE scope on purpose.
 *
 * Every screen renders its own <AppShell>, so this component unmounts and
 * remounts on EVERY navigation. React state died with it, which is exactly the
 * review complaint: "when i select a menu … the sidebar scrolls to the top and
 * the drop downs reopen themselves automatically". Parking the collapse map and
 * the scroll offset here makes a remount indistinguishable from a re-render.
 */
const SIDEBAR_UI = { collapsed: {}, scrollY: 0 };

/**
 * Dropdown arrow, drawn immediately after the group label (no `flex-1` pushing
 * it to the far edge) so it reads as belonging to that row — review: "make each
 * arrow looks belonging to the menu in front of it".
 */
function Chevron({ open, color }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 11 11">
      <Polyline
        points={open ? "2,3.75 5.5,7.25 9,3.75" : "3.75,1.75 7.25,5.5 3.75,9.25"}
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function Sidebar({ user, onNavigate }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccess, role, isAdmin, hasAnyPermission } = useRole();
  const [collapsed, setCollapsed] = useState(() => ({ ...SIDEBAR_UI.collapsed }));
  const [userPressed, setUserPressed] = useState(false);
  const scrollRef = useRef(null);
  // In the mobile/tablet drawer the sidebar starts at the very top of the
  // screen — pad below the status bar (0 on desktop web).
  const insets = useSafeAreaInsets();

  // Mirror the live state back into module scope so the NEXT mount restores it.
  useEffect(() => {
    SIDEBAR_UI.collapsed = collapsed;
  }, [collapsed]);

  // Restore scroll position after mount AND after each route change. On web
  // the ScrollView's DOM node is only attached a frame later, so the position
  // is applied three times (sync, rAF, timeout) — whichever lands last wins.
  useEffect(() => {
    const y = SIDEBAR_UI.scrollY;
    if (!y) return undefined;
    const apply = () => {
      const node = scrollRef.current;
      if (!node) return;
      if (node.scrollTo) node.scrollTo({ y, animated: false });
      else if (typeof node.scrollTop === "number") node.scrollTop = y;
    };
    apply();
    const raf = requestAnimationFrame(apply);
    const timer = setTimeout(apply, 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
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
      className="w-[268px] bg-sidebar h-full"
      style={{ minHeight: "100vh", paddingTop: insets.top }}
    >
      {/* Logo — the agreed app icon (app.json → ./assets/icon.png), not the
          old gear glyph */}
      <View className="px-5 pt-6 pb-4">
        <View className="flex-row items-center gap-2">
          {/* Inline style, NOT className: react-native-web's <Image> drops the
              className prop, so w-8/h-8 never applied and the 1024×1024 icon
              bled across the page. */}
          <Image
            source={require("../../assets/icon.png")}
            resizeMode="contain"
            style={{ width: 32, height: 32, borderRadius: 8 }}
            accessibilityLabel="SmartFactory logo"
          />
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
        onScroll={(e) => {
          SIDEBAR_UI.scrollY = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {groups.map((group, gi) => {
          const isCollapsed = !!collapsed[group.key];
          const hasActiveChild = group.items.some((item) => isActive(item.path));
          // The group stays EXACTLY as the user left it — `hasActiveChild`
          // only colours the header, it no longer forces the group open (that
          // was the "drop downs reopen themselves" bug).
          const open = !isCollapsed;
          const chevronColor = open
            ? hasActiveChild
              ? "#FFFFFF"
              : "rgba(199,210,225,0.85)"
            : "rgba(199,210,225,0.55)";
          return (
            <View key={group.key} className={gi > 0 ? "mt-1" : ""}>
              <Pressable
                onPress={() => toggleGroup(group.key)}
                className="flex-row items-center gap-1.5 px-3 pt-2.5 pb-1.5"
                style={({ pressed }) => (pressed ? { opacity: 0.65 } : {})}
              >
                <Text
                  className={`text-[11px] font-bold font-inter uppercase ${
                    hasActiveChild ? "text-white" : "text-sidebar-text/70"
                  }`}
                  style={{ letterSpacing: 1 }}
                >
                  {group.label}
                </Text>
                {/* Sits right beside the label instead of at the far edge. */}
                <Chevron open={open} color={chevronColor} />
              </Pressable>
              {open && (
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

      {/* User footer -> profile. Its own surface (light blue-tinted background
          + blue border) so it reads as a button, not as plain sidebar text.
          The colours are a PLAIN style object driven by press state: the
          previous `style={({pressed}) => …}` function form never applied, so
          the card fell back to the sidebar fill with RN's default black
          border — exactly what the review reported. */}
      <View className="h-px bg-white/10 mx-4" />
      {/* `mx-1.5 px-2.5 gap-2` (was mx-3 px-3 gap-3) — widening the rail alone
          is not enough for the name: every horizontal px of margin, padding and
          gap was stolen from it, so long names ellipsised. Review: "let the
          sidebar user card be wider and reduce the padding inside the card, the
          goal is that the full name appears". */}
      <Pressable
        onPress={() => go("/(app)/profile")}
        onPressIn={() => setUserPressed(true)}
        onPressOut={() => setUserPressed(false)}
        className="mx-1.5 my-3 px-2.5 py-3 flex-row items-center gap-2 rounded-2xl border border-[rgba(59,130,246,0.85)]"
        style={{
          backgroundColor: userPressed ? "rgba(147,197,253,0.55)" : "rgba(96,165,250,0.35)",
          borderColor: "rgba(59,130,246,0.85)",
        }}
      >
        <Avatar name={user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "User"} size="sm" />
        <View className="flex-1">
          <Text className="text-sm text-white font-medium font-inter" numberOfLines={1}>
            {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "User"}
          </Text>
          <Text className="text-xs text-sidebar-text font-inter">{user?.role || "—"}</Text>
        </View>
        <Text className="text-base font-extrabold text-white leading-4">❯</Text>
      </Pressable>
    </View>
  );
}
