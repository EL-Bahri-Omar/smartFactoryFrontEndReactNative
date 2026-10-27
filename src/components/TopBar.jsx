// src/components/TopBar.jsx
// Top bar: back button, menu (drawer), theme toggle, alerts shortcut
// (yellow triangle icon + active-alert badge), notification bell
// (unread badge + link to /notifications), logout (red exit icon),
// avatar -> profile.
// Icon buttons share one real-button treatment: light surface, light border,
// subtle shadow, rounded — in both light and dark modes.

import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { useDark } from "../hooks/useDark";
import { useRole, PERMISSIONS } from "../hooks/useRole";
import { useDialog } from "./dialog/DialogContext";
import { setNotifications } from "../store/slices/settingsSlice";
import { logoutThunk, refreshSession } from "../store/slices/authSlice";
import { markAllRead } from "../store/slices/liveSlice";
import { fetchNotifications, refreshUnreadCount } from "../store/slices/notificationSlice";
import { fetchAlerts } from "../store/slices/alertSlice";
import { fetchDashboard } from "../store/slices/dashboardSlice";
import { fetchMachines } from "../store/slices/machineSlice";
import { fetchInterventions } from "../store/slices/interventionSlice";
import { fetchZones } from "../store/slices/zoneSlice";
import { fetchGroups } from "../store/slices/groupSlice";
import { fetchUsers } from "../store/slices/userSlice";
import { fetchRoles } from "../store/slices/roleSlice";
import Avatar from "./Avatar";
import { formatDate, formatTime } from "../lib/time";

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

// Alerts shortcut — yellow warning triangle with a red "!" inside, so it is
// visually distinct from the notification bell next to it.
function AlertTriangleIcon({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* triangle body */}
      <Path
        d="M12 3.2 22.2 20.8H1.8L12 3.2z"
        fill="#FACC15"
        stroke="#B45309"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* red exclamation mark */}
      <Path d="M11 9.5h2v6.2h-2z" fill="#DC2626" />
      <Path d="M11 17.4h2v2.2h-2z" fill="#DC2626" />
    </Svg>
  );
}

function IconButton({ onPress, label, children, disabled = false }) {
  const dark = useDark();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
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
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

const ROOT_PATHS = ["/(app)", "/(app)/dashboard", "/dashboard"];

// Same wording the dashboard header used — it moved up here (review: "move
// Good afternoon, Admin 👋 to the top bar") to free vertical space on the
// landing screen.
function greetingFor(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function TopBar({ user, onMenuPress, showMenu = false, isMobile = false }) {
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

  // Active (unresolved) alert rows already loaded by the app — used only for
  // the shortcut badge; the backend is the source of truth. The count is
  // computed INSIDE the selector so it returns a primitive (a filtered array
  // would be a new reference every call and force pointless rerenders).
  const activeAlerts = useAppSelector(
    (s) => (s.alert?.list || []).filter((a) => a.status === "ACTIVE").length
  );

  // Alerts are for every role EXCEPT OPERATOR (mirrors ACCESS.alerts).
  const { role, isAdmin, isOperator, hasPermission, hasAnyPermission, canAccess } = useRole();
  const showAlertsShortcut = !isOperator;

  // ── Refresh (review: "add a refresh button in all screens to load the
  // new changes"). One button in the TopBar = present on EVERY screen; it
  // reloads the shared Redux data + the session's effective permissions,
  // honouring each user's access so no screen gets a poisoned 403 error.
  const canReadAlerts =
    !isOperator &&
    (hasPermission(PERMISSIONS.ALERT_READ) ||
      ["ADMIN", "RESPONSABLE_INDUSTRIEL", "TECHNICIAN"].includes(role));
  const canReadMaintenance = canAccess("maintenance");
  const canReadUsers = canAccess("users");
  const canReadGroups = canAccess("groups");
  const canViewZones = canAccess("map") || canAccess("machines");
  const canViewRoles =
    isAdmin ||
    hasAnyPermission(
      PERMISSIONS.ROLE_READ,
      PERMISSIONS.ROLE_CREATE,
      PERMISSIONS.ROLE_UPDATE,
      PERMISSIONS.ROLE_DELETE
    );

  // Keep the screen's own filters/page so "refresh" reloads exactly what
  // the user is looking at (slice pagination mirrors the last fetch).
  const machineFilters = useAppSelector((s) => s.machine.filters);
  const machinePage = useAppSelector((s) => s.machine.pagination?.page ?? 0);
  const maintFilters = useAppSelector((s) => s.maintenance.filters);
  const maintPage = useAppSelector((s) => s.maintenance.pagination?.page ?? 0);

  // The unread-count STOMP topic is consumed by NotificationBridge
  // (app/(app)/_layout.jsx) — mounted once for the whole app — so the badge
  // updates from there without this component re-subscribing per mount.

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

  const [refreshing, setRefreshing] = useState(false);

  // ── Greeting (moved up from dashboard.jsx: "move Good afternoon, Admin 👋
  // to the top bar"). Shown only to the roles that could see it on the
  // dashboard (`canAccess("dashboard")` = supervisors); everyone else keeps
  // the empty flex spacer. The clock ticks once a minute so the wording
  // (morning / afternoon / evening) and the time stay honest.
  const showGreeting = canAccess("dashboard");
  const greetingName = user?.firstName || "there";
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  /**
   * Global refresh: fresh session (role/permissions), dashboard KPIs,
   * machines, interventions, alerts, notifications (all pages) + badge,
   * plus the admin lists the current user may read. allSettled so one
   * failing endpoint never blocks the rest.
   */
  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const tasks = [
        dispatch(refreshSession()), // role + effectivePermissions freshness
        dispatch(
          fetchDashboard({
            machines: true,
            alerts: canReadAlerts,
            interventions: canReadMaintenance,
          })
        ),
        dispatch(fetchNotifications({ page: 0, size: 100 })), // walks all pages
        dispatch(refreshUnreadCount()), // bell badge
      ];
      if (canReadAlerts) tasks.push(dispatch(fetchAlerts({ page: 0, size: 100 })));
      if (canAccess("machines")) {
        tasks.push(
          dispatch(
            fetchMachines({
              status: machineFilters?.status || undefined,
              search: machineFilters?.search || undefined,
              zoneId: machineFilters?.zoneId || undefined,
              page: machinePage,
              size: 10,
            })
          )
        );
      }
      if (canViewZones) tasks.push(dispatch(fetchZones()));
      if (canReadMaintenance) {
        tasks.push(
          dispatch(
            fetchInterventions({
              status: maintFilters?.status || undefined,
              type: maintFilters?.type || undefined,
              page: maintPage,
              size: 100,
            })
          )
        );
      }
      if (canReadUsers) tasks.push(dispatch(fetchUsers({ page: 0, size: 100 })));
      if (canReadGroups) tasks.push(dispatch(fetchGroups()));
      if (canViewRoles) tasks.push(dispatch(fetchRoles()));
      await Promise.allSettled(tasks);
    } finally {
      setRefreshing(false);
    }
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

      {showGreeting ? (
        <View className="flex-1 pr-2">
          <Text
            numberOfLines={1}
            className={`font-bold font-inter text-[15px] leading-5 ${
              dark ? "text-white" : "text-text"
            }`}
          >
            {greetingFor(now.getHours())}, {greetingName} 👋
          </Text>
          <Text
            className={`text-[11px] font-inter leading-4 ${
              dark ? "text-white/60" : "text-text-muted"
            }`}
          >
            {formatDate(now)} · {formatTime(now)}
          </Text>
        </View>
      ) : (
        <View className="flex-1" />
      )}

      {/* Refresh — reloads the data behind EVERY screen (session,
          dashboard, machines, interventions, alerts, notifications). */}
      <IconButton onPress={handleRefresh} label="Refresh data" disabled={refreshing}>
        {refreshing ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          // A little smaller and optically centred inside the 40×40 button:
          // Android's extra font padding + the glyph's line box are what
          // pushed it off-centre before (review).
          <Text
            style={{
              fontSize: 16,
              lineHeight: 18,
              textAlign: "center",
              includeFontPadding: false,
              color: iconColor,
            }}
          >
            ⟳
          </Text>
        )}
      </IconButton>

      {/* Theme toggle */}
      <IconButton onPress={toggleTheme} label="Toggle dark mode">
        <Text style={{ fontSize: 18 }}>{dark ? "☀️" : "🌙"}</Text>
      </IconButton>

      {/* Alerts — yellow warning triangle; opens the Alerts screen */}
      {showAlertsShortcut && (
        <IconButton onPress={() => router.push("/(app)/alerts")} label="Alerts">
          <View className="items-center justify-center">
            <AlertTriangleIcon size={22} />
            {activeAlerts > 0 && (
              <View
                className="absolute -top-0.5 -right-1 min-w-4 px-1 h-4 rounded-full items-center justify-center border"
                style={{ backgroundColor: "#DC2626", borderColor: dark ? "#0B1D3A" : "#FFFFFF" }}
              >
                <Text className="text-[9px] font-bold text-white" style={{ lineHeight: 11 }}>
                  {activeAlerts > 99 ? "99+" : activeAlerts}
                </Text>
              </View>
            )}
          </View>
        </IconButton>
      )}

      {/* Notification bell — desktop/tablet only. On mobile it lives in the
          BottomTabs bar (review: "remove notifications from top bar and put
          it in bottom menu bar"). */}
      {!isMobile && (
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
      )}

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

