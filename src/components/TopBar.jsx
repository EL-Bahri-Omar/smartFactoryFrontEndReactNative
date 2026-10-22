// src/components/TopBar.jsx
// Top bar: back button, menu (drawer), theme toggle, notification bell
// (unread badge + link to /notifications), logout (red exit icon),
// avatar -> profile.
// Icon buttons share one real-button treatment: light surface, light border,
// subtle shadow, rounded — in both light and dark modes.

import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { useDark } from "../hooks/useDark";
import { useLiveTopic } from "../hooks/useLiveTopic";
import { useDialog } from "./dialog/DialogContext";
import { setNotifications } from "../store/slices/settingsSlice";
import { logoutThunk } from "../store/slices/authSlice";
import { markAllRead } from "../store/slices/liveSlice";
import { refreshUnreadCount, setServerUnread } from "../store/slices/notificationSlice";
import Avatar from "./Avatar";

// Door + arrow exit icon (logout), drawn in currentColor-style red.
function LogoutIcon({ size = 22, color = "#DC2626" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* door */}
      <Path
        d="M13 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7v2H6a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h7v2z"
        fill={color}
      />
      <Path d="M10 11h9v2h-9v3l-4-4 4-4v3z" fill={color} />
      {/* arrow head into bracket */}
      <Path d="M17 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4v-2h3V7h-3V5z" fill={color} />
    </Svg>
  );
}

function BackIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
        fill={color}
      />
    </Svg>
  );
}

function IconButton({ onPress, label, children }) {
  const dark = useDark();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className={`w-10 h-10 rounded-btn items-center justify-center border ${
        dark ? "bg-white/10 border-white/15" : "bg-surface border-border"
      }`}
      style={({ pressed }) => ({
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: dark ? 0.3 : 0.12,
        shadowRadius: 3,
        elevation: 2,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

const ROOT_PATHS = ["/(app)", "/(app)/dashboard", "/dashboard"];

export default function TopBar({ user, onMenuPress, showMenu = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const dark = useDark();
  const insets = useSafeAreaInsets();
  // Bell badge: server truth first (GET /api/notifications/unread-count,
  // refreshed by refreshUnreadCount), falling back to the live counter
  // (liveSlice counts alert/notification STOMP arrivals since last visit).
  // The backend now pushes the exact count on
  // /topic/users/{userId}/unread-count after every notification, so the
  // server value is authoritative and is never added to the live counter.
  const liveUnread = useAppSelector((s) => s.live.unreadCount);
  const serverUnread = useAppSelector((s) => s.notification.unread.server);
  const unreadCount = serverUnread != null ? serverUnread : liveUnread;

  const unreadTopic = user?.id ? `/topic/users/${user.id}/unread-count` : null;
  const liveUnreadMessage = useLiveTopic(unreadTopic, { enabled: !!unreadTopic });

  useEffect(() => {
    if (liveUnreadMessage && liveUnreadMessage.unreadCount != null) {
      dispatch(setServerUnread(liveUnreadMessage.unreadCount));
    }
  }, [liveUnreadMessage, dispatch]);

  // Periodic server unread sync (60 s + on mount). When the count succeeds,
  // the live counter resets so an alert arriving while the app is open is
  // never counted twice (server + live).
  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      dispatch(refreshUnreadCount())
        .then(() => {
          if (!cancelled) dispatch(markAllRead());
        })
        .catch(() => {});
    };
    sync();
    const interval = setInterval(sync, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dispatch]);

  const isRoot = ROOT_PATHS.includes(pathname) || pathname === "/";
  const canGoBack = !isRoot;

  function toggleTheme() {
    dispatch(setNotifications({ darkMode: !dark }));
  }

  function handleBell() {
    dispatch(markAllRead());
    router.push("/(app)/notifications");
  }

  async function handleLogout() {
    const ok = await dialog.confirm("Log Out", "Are you sure you want to log out?", {
      confirmText: "Log Out",
      danger: true,
    });
    if (!ok) return;
    try {
      await dispatch(logoutThunk()).unwrap();
    } catch {
      // Cleared locally regardless.
    }
    router.replace("/(auth)/login");
  }

  const barClass = dark ? "bg-[#0B1D3A] border-white/10" : "bg-surface border-border";
  const iconColor = dark ? "#FFFFFF" : "#0F172A";

  return (
    <View
      className={`border-b flex-row items-center px-4 gap-2 ${barClass}`}
      style={{ minHeight: 64, paddingTop: insets.top, paddingBottom: 8 }}
    >
      {/* Hamburger for smaller screens */}
      {showMenu && (
        <IconButton onPress={onMenuPress} label="Open menu">
          <Text style={{ fontSize: 18, color: iconColor }}>{"☰"}</Text>
        </IconButton>
      )}

      {/* Back button */}
      {canGoBack && (
        <IconButton onPress={() => router.back()} label="Go back">
          <BackIcon size={20} color={iconColor} />
        </IconButton>
      )}

      <View className="flex-1" />

      {/* Theme toggle */}
      <IconButton onPress={toggleTheme} label="Toggle dark mode">
        <Text style={{ fontSize: 18 }}>{dark ? "☀️" : "🌙"}</Text>
      </IconButton>

      {/* Notification bell — badge + link to the Notifications screen */}
      <IconButton onPress={handleBell} label="Notifications">
        <View className="items-center justify-center">
          <Text style={{ fontSize: 18 }}>{"🔔"}</Text>
          {unreadCount > 0 && (
            <View
              className="absolute -top-0.5 -right-1 min-w-4 px-1 h-4 rounded-full items-center justify-center border"
              style={{ backgroundColor: "#DC2626", borderColor: dark ? "#0B1D3A" : "#FFFFFF" }}
            >
              <Text className="text-[9px] font-bold text-white" style={{ lineHeight: 11 }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </IconButton>

      {/* Logout — red exit icon */}
      <IconButton onPress={handleLogout} label="Log out">
        <LogoutIcon size={22} color="#DC2626" />
      </IconButton>

      {/* Avatar -> profile */}
      <Pressable className="ml-1" onPress={() => router.push("/(app)/profile")}>
        <Avatar
          name={user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "User"}
          size="sm"
        />
      </Pressable>
    </View>
  );
}

