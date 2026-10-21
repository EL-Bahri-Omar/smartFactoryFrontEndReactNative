// app/(app)/dashboard.jsx
//
// Landing screen for supervisors (ADMIN / RESPONSABLE_INDUSTRIEL).
//
// It answers "what is happening right now?" in one glance, then routes to the
// deep screens:
//   KPI row      → machines, running, active alerts, open interventions
//   alerts card  → the 5 newest ACTIVE alerts (severity + machine + age)
//   maintenance  → the open queue, most urgent first
//   quick actions→ create intervention / add machine / map / users
//
// Data comes from `fetchDashboard` (one parallel fan-out, see
// src/store/slices/dashboardSlice.js) so opening the app never waits on the
// heavy list endpoints. Every block degrades on its own: a role that cannot
// read alerts still sees machines and maintenance.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Skeleton from "../../src/components/Skeleton";
import EmptyState from "../../src/components/EmptyState";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useDark } from "../../src/hooks/useDark";
import { useRole, PERMISSIONS } from "../../src/hooks/useRole";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { fetchDashboard } from "../../src/store/slices/dashboardSlice";
import { getAlertSeverity, getTicketPriority, getTicketStatus } from "../../src/lib/status";
import { relativeTime } from "../../src/lib/time";
import { ROLES } from "../../src/constants/roles";

const ROLE_LABELS = {
  [ROLES.ADMIN]: "Administrator",
  [ROLES.RESPONSABLE_INDUSTRIEL]: "Industrial manager",
  [ROLES.TECHNICIAN]: "Maintenance technician",
  [ROLES.OPERATOR]: "Line operator",
};

function greeting(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Small, consistent KPI tile used by the top row. */
function Kpi({ label, value, hint, accent, loading, dark, onPress }) {
  const body = (
    <Card className="flex-1 min-w-[150px]">
      <Text className={`text-xs font-inter mb-1 ${dark ? "text-white/60" : "text-text-muted"}`}>{label}</Text>
      {loading ? (
        <Skeleton width="50%" height={26} />
      ) : (
        <Text className={`text-2xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>{value}</Text>
      )}
      <View className="flex-row items-center gap-1.5 mt-1">
        {accent ? <View className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} /> : null}
        <Text className={`text-[11px] font-inter flex-1 ${dark ? "text-white/50" : "text-text-muted"}`} numberOfLines={1}>
          {hint}
        </Text>
      </View>
    </Card>
  );
  return onPress ? <Pressable onPress={onPress} className="flex-1 min-w-[150px]">{body}</Pressable> : body;
}

export default function DashboardScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dark = useDark();
  const { canAccess, hasPermission, role, homeRoute } = useRole();
  const user = useAppSelector((s) => s.auth.user);
  const { data, status, error } = useAppSelector((s) => s.dashboard);
  const isDesktop = useBreakpoint() === "desktop";

  const canReadAlerts = hasPermission(PERMISSIONS.ALERT_READ);
  const canReadMaintenance = canAccess("maintenance");
  const canWriteMaintenance = hasPermission(PERMISSIONS.MAINTENANCE_WRITE);
  const canWriteMachines = hasPermission(PERMISSIONS.MACHINE_WRITE);
  const canReadUsers = canAccess("users");

  const scope = useMemo(
    () => ({ machines: true, alerts: canReadAlerts, interventions: canReadMaintenance }),
    [canReadAlerts, canReadMaintenance]
  );

  const load = useCallback(() => dispatch(fetchDashboard(scope)), [dispatch, scope]);

  // First paint + whenever the role/permission set flips (e.g. granted from
  // another device — the minute-poll refreshes the session).
  useEffect(() => {
    load();
  }, [load]);

  // Coming back to the tab should show fresh numbers, but never flash a
  // skeleton over data we already have. `status` is read through a ref so the
  // memoised focus callback always sees the current value.
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useFocusEffect(
    useCallback(() => {
      if (statusRef.current === "succeeded") load();
    }, [load])
  );

  const loading = !data && (status === "idle" || status === "loading");
  const hardError = status === "error" && !data;
  const refreshing = status === "loading" && !!data;

  if (!canAccess("dashboard")) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            title="Restricted area"
            message="The dashboard is available to administrators and industrial managers."
            action={
              <Button
                title="Go to Factory Map"
                variant="primary"
                size="sm"
                onPress={() => router.replace(homeRoute)}
              />
            }
          />
        </Card>
      </AppShell>
    );
  }

  const machines = data?.machines;
  const alerts = data?.alerts;
  const maintenance = data?.interventions;
  const firstName = user?.firstName || "there";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <AppShell>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          // Pull-to-refresh is native-only; on web react-native-web renders it
          // as a plain wrapper and the gesture never fires, so skip it there.
          Platform.OS === "web" ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#2563EB" />
          )
        }
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View className="flex-row items-start justify-between flex-wrap gap-3 mb-5">
          <View className="flex-1 min-w-[220px]">
            <Text className={`text-2xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
              {greeting(new Date().getHours())}, {firstName}
            </Text>
            <Text className={`text-sm font-inter mt-1 ${dark ? "text-white/60" : "text-text-muted"}`}>
              {today} · {ROLE_LABELS[role] || role || "—"}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {refreshing ? (
              <Text className={`text-[11px] font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>
                Updating…
              </Text>
            ) : null}
            <Button title="Refresh" variant="outline" size="sm" onPress={load} disabled={refreshing} />
          </View>
        </View>

        {/* ── Hard error (nothing could load) ────────────────────────── */}
        {hardError ? (
          <Card className="mb-4">
            <EmptyState
              title="Dashboard unavailable"
              message={error?.message || "The dashboard could not load. Check your connection and try again."}
              action={<Button title="Retry" variant="primary" size="sm" onPress={load} />}
            />
          </Card>
        ) : null}

        {/* ── KPI row ────────────────────────────────────────────────── */}
        {!hardError ? (
          <View className="flex-row flex-wrap gap-3 mb-4">
            <Kpi
              dark={dark}
              loading={loading}
              label="Machines"
              value={machines?.total ?? "—"}
              hint="registered"
              accent="#2563EB"
              onPress={() => router.push("/(app)/machines")}
            />
            <Kpi
              dark={dark}
              loading={loading}
              label="Running"
              value={machines?.RUNNING ?? "—"}
              hint={
                machines
                  ? `${machines.IDLE} idle · ${machines.MAINTENANCE} maint. · ${machines.OFFLINE} offline`
                  : "production now"
              }
              accent="#16A34A"
              onPress={() => router.push("/(app)/machines")}
            />
            {canReadAlerts ? (
              <Kpi
                dark={dark}
                loading={loading}
                label="Active alerts"
                value={alerts?.active ?? "—"}
                hint={
                  alerts
                    ? `${alerts.critical} critical · ${alerts.high} high · ${alerts.warning} warning`
                    : "awaiting sensors"
                }
                accent={alerts?.critical ? "#DC2626" : alerts?.high ? "#EA580C" : "#16A34A"}
                onPress={() => router.push("/(app)/alerts")}
              />
            ) : null}
            {canReadMaintenance ? (
              <Kpi
                dark={dark}
                loading={loading}
                label="Open interventions"
                value={maintenance?.open ?? "—"}
                hint={
                  maintenance
                    ? `${maintenance.PENDING} to do · ${maintenance.ASSIGNED} assigned · ${maintenance.IN_PROGRESS} in progress`
                    : "maintenance queue"
                }
                accent={maintenance?.open ? "#F59E0B" : "#16A34A"}
                onPress={() => router.push("/(app)/maintenance")}
              />
            ) : null}
          </View>
        ) : null}

        {/* ── Alerts + maintenance queue ─────────────────────────────── */}
        {!hardError ? (
          <View className={isDesktop ? "flex-row gap-4 mb-4" : "gap-4 mb-4"}>
            {canReadAlerts ? (
              <Card className={isDesktop ? "flex-1" : ""}>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className={`text-base font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                    Active alerts
                  </Text>
                  <Button title="View all" variant="ghost" size="sm" onPress={() => router.push("/(app)/alerts")} />
                </View>

                {loading ? (
                  <View className="gap-3">
                    {[0, 1, 2].map((i) => (
                      <View key={i} className="flex-row items-center gap-3">
                        <Skeleton width={10} height={10} rounded />
                        <View className="flex-1 gap-1">
                          <Skeleton width="65%" height={13} />
                          <Skeleton width="40%" height={10} />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : data?.failed?.alerts ? (
                  <Text className={`text-sm font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                    Alerts could not be loaded. Open the Alerts screen to retry.
                  </Text>
                ) : alerts?.recent?.length ? (
                  <View>
                    {alerts.recent.map((a, i) => {
                      const sev = getAlertSeverity(a.severity);
                      return (
                        <Pressable
                          key={a.id || i}
                          onPress={() =>
                            router.push(
                              a.id
                                ? { pathname: "/(app)/alerts", params: { alertId: String(a.id) } }
                                : "/(app)/alerts"
                            )
                          }
                          className={`py-2.5 ${i > 0 ? `border-t ${dark ? "border-white/5" : "border-border/50"}` : ""}`}
                        >
                          <View className="flex-row items-center gap-2">
                            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: sev.color }} />
                            <Text
                              numberOfLines={1}
                              className={`flex-1 text-sm font-inter ${dark ? "text-white" : "text-text"}`}
                            >
                              {a.message || `${a.sensorType || "Sensor"} alert`}
                            </Text>
                            <Text className={`text-[10px] font-inter ${dark ? "text-white/40" : "text-text-muted"}`}>
                              {relativeTime(a.timestamp)}
                            </Text>
                          </View>
                          <Text
                            numberOfLines={1}
                            className={`text-[11px] font-inter mt-0.5 ml-4 ${dark ? "text-white/50" : "text-text-muted"}`}
                          >
                            {[a.machineCode, sev.label, a.value != null ? a.value : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View className="py-4 items-center">
                    <Text className="text-2xl mb-1">✓</Text>
                    <Text className={`text-sm font-inter ${dark ? "text-white/70" : "text-text"}`}>
                      All clear — no active alerts
                    </Text>
                    <Text className={`text-xs font-inter mt-0.5 ${dark ? "text-white/40" : "text-text-muted"}`}>
                      Threshold breaches will appear here.
                    </Text>
                  </View>
                )}
              </Card>
            ) : null}

            {canReadMaintenance ? (
              <Card className={isDesktop ? "flex-1" : ""}>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className={`text-base font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                    Maintenance queue
                  </Text>
                  <Button
                    title="Open"
                    variant="ghost"
                    size="sm"
                    onPress={() => router.push("/(app)/maintenance")}
                  />
                </View>

                {loading ? (
                  <View className="gap-3">
                    {[0, 1, 2].map((i) => (
                      <View key={i} className="flex-row items-center gap-3">
                        <Skeleton width={8} height={8} rounded />
                        <View className="flex-1 gap-1">
                          <Skeleton width="70%" height={13} />
                          <Skeleton width="45%" height={10} />
                        </View>
                      </View>
                    ))}
                  </View>
                ) : data?.failed?.interventions ? (
                  <Text className={`text-sm font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
                    Interventions could not be loaded. Open the Maintenance screen to retry.
                  </Text>
                ) : maintenance?.upcoming?.length ? (
                  <View>
                    {maintenance.upcoming.map((t, i) => {
                      const pr = getTicketPriority(t.priority);
                      const st = getTicketStatus(t.status);
                      return (
                        <Pressable
                          key={t.id || i}
                          onPress={() => router.push(`/(app)/maintenance/${t.id}`)}
                          className={`py-2.5 ${i > 0 ? `border-t ${dark ? "border-white/5" : "border-border/50"}` : ""}`}
                        >
                          <View className="flex-row items-center gap-2">
                            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: pr.color }} />
                            <Text
                              numberOfLines={1}
                              className={`flex-1 text-sm font-inter ${dark ? "text-white" : "text-text"}`}
                            >
                              {t.title || "Intervention"}
                            </Text>
                            <View
                              className="px-2 py-0.5 rounded-chip"
                              style={{ backgroundColor: st.color + "18" }}
                            >
                              <Text className="text-[10px] font-bold font-inter" style={{ color: st.color }}>
                                {st.label}
                              </Text>
                            </View>
                          </View>
                          <Text
                            numberOfLines={1}
                            className={`text-[11px] font-inter mt-0.5 ml-4 ${dark ? "text-white/50" : "text-text-muted"}`}
                          >
                            {(t.machineCode || "—") +
                              (t.technicianName ? ` · ${t.technicianName}` : " · unassigned") +
                              (t.scheduledAt ? ` · ${relativeTime(t.scheduledAt)}` : "")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View className="py-4 items-center">
                    <Text className="text-2xl mb-1">🗓️</Text>
                    <Text className={`text-sm font-inter ${dark ? "text-white/70" : "text-text"}`}>
                      No open interventions
                    </Text>
                    <Text className={`text-xs font-inter mt-0.5 ${dark ? "text-white/40" : "text-text-muted"}`}>
                      Everything scheduled is completed.
                    </Text>
                  </View>
                )}
              </Card>
            ) : null}
          </View>
        ) : null}

        {/* ── Quick actions ──────────────────────────────────────────── */}
        {!hardError ? (
          <Card>
            <Text className={`text-base font-bold font-inter mb-3 ${dark ? "text-white" : "text-text"}`}>
              Quick actions
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {canWriteMaintenance ? (
                <Button
                  title="+ New intervention"
                  variant="primary"
                  size="sm"
                  onPress={() => router.push("/(app)/maintenance")}
                />
              ) : null}
              {canWriteMachines ? (
                <Button
                  title="+ Add machine"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push("/(app)/machines")}
                />
              ) : null}
              <Button
                title="Factory map"
                variant="outline"
                size="sm"
                onPress={() => router.push("/(app)/map")}
              />
              <Button
                title="History"
                variant="outline"
                size="sm"
                onPress={() => router.push("/(app)/history")}
              />
              {canReadUsers ? (
                <Button title="Users" variant="ghost" size="sm" onPress={() => router.push("/(app)/users")} />
              ) : null}
              <Button
                title="Notifications"
                variant="ghost"
                size="sm"
                onPress={() => router.push("/(app)/notifications")}
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </AppShell>
  );
}
