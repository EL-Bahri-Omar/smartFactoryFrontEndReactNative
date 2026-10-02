// src/components/TopBar.jsx
// Top bar: menu (drawer), theme toggle, notification bell (unread badge),
// logout (red exit icon), avatar -> profile.
// Icon buttons share one real-button treatment: light surface, light border,
// subtle shadow, rounded — in both light and dark modes.

import { View, Text, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { useDark } from "../hooks/useDark";
import { useDialog } from "./dialog/DialogContext";
import { setNotifications } from "../store/slices/settingsSlice";
import { logoutThunk } from "../store/slices/authSlice";
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

export default function TopBar({ user, onMenuPress, showMenu = false }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const dark = useDark();
  const unreadCount = useAppSelector((state) => state.live.unreadCount);
  // Push content below the phone status bar / notch (0 on web).
  const insets = useSafeAreaInsets();

  function toggleTheme() {
    dispatch(setNotifications({ darkMode: !dark }));
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
  const menuColor = dark ? "#FFFFFF" : "#0F172A";

  return (
    <View
      className={`border-b flex-row items-center px-4 gap-2 ${barClass}`}
      style={{ minHeight: 64, paddingTop: insets.top, paddingBottom: 8 }}
    >
      {/* Hamburger for smaller screens */}
      {showMenu && (
        <IconButton onPress={onMenuPress} label="Open menu">
          <Text style={{ fontSize: 18, color: menuColor }}>☰</Text>
        </IconButton>
      )}

      <View className="flex-1" />

      {/* Theme toggle */}
      <IconButton onPress={toggleTheme} label="Toggle dark mode">
        <Text style={{ fontSize: 18 }}>{dark ? "☀️" : "🌙"}</Text>
      </IconButton>

      {/* Notification bell */}
      <IconButton onPress={() => {}} label="Notifications">
        <View>
          <Text style={{ fontSize: 18 }}>🔔</Text>
          {unreadCount > 0 && (
            <View className="absolute -top-2 -right-2 bg-danger rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
              <Text className="text-[10px] text-white font-bold font-inter">
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
