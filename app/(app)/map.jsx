// app/(app)/map.jsx
//
// Map & Zones — web + mobile, same file.
// Web:  Left (~65%) large FactoryMap (variant="full") + Right (~35%) Zone Details + Recent Activity.
// Mobile: Map full width, Zone Details + Recent Activity stacked below.
//
// Dispatches fetchZones + fetchRecentEvents on mount.
// Subscribes to /topic/zones for live updates via liveSlice.

import { useEffect, Fragment, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import FactoryMap from "../../src/components/FactoryMap";
import Skeleton from "../../src/components/Skeleton";
import EmptyState from "../../src/components/EmptyState";
import Button from "../../src/components/Button";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useRole, PERMISSIONS } from "../../src/hooks/useRole";
import { fetchZones, fetchZoneMachines, fetchZoneDetails } from "../../src/store/slices/zoneSlice";
import { updateMachine } from "../../src/store/slices/machineSlice";
import { fetchRecentEvents } from "../../src/store/slices/eventSlice";
import { fetchAlerts } from "../../src/store/slices/alertSlice";
import { useDialog } from "../../src/components/dialog/DialogContext";
import { useLiveTopic } from "../../src/hooks/useLiveTopic";
import { relativeTime } from "../../src/lib/time";
import { getMachineStatus } from "../../src/lib/status";
import { computeMachineHealth } from "../../src/lib/health";
import { ScoreRing } from "../../src/components/KpiCard";

// Zone color mapping
const ZONE_COLORS = {
  A: "#0D9488",
  B: "#2563EB",
  C: "#7C3AED",
  D: "#EA580C",
};

// Event → dot color. `severity` wins (backend CRITICAL/HIGH/WARNING/INFO),
// then the feed `kind` (alert | maintenance).
const EVENT_DOTS = {
  alert: "#DC2626",
  critical: "#DC2626",
  high: "#EA580C",
  warning: "#F59E0B",
  info: "#2563EB",
  maintenance: "#0D9488",
  success: "#16A34A",
  default: "#94A3B8",
};

export default function MapScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dialog = useDialog();
  const breakpoint = useBreakpoint();
  const dark = useDark();
  // Zone moves are machine updates (MACHINE_WRITE); viewing needs ZONE_READ.
  const { canAccess, homeRoute, hasPermission } = useRole();
  const isAdmin = hasPermission(PERMISSIONS.MACHINE_WRITE);
  const canView = canAccess("map");
  const isDesktop = breakpoint === "desktop";

  const { list: zones, machinesByZone, status: zoneStatus, error: zoneError, details: zoneDetails } =
    useAppSelector((s) => s.zone);
  const { list: events, status: eventStatus } = useAppSelector((s) => s.event);
  // ACTIVE alert rows are the SENSOR signal for the health score. Machine rows
  // carry no alert fields at all ({id,name,code,type,zoneId,zoneName,status,...})
  // so the old `m.activeAlertsCount` was always undefined and the zone rings
  // could only ever react to status. One ACTIVE alert per (machine, sensorType)
  // IS that sensor's state — same source the dashboard and reports use.
  const { list: activeAlerts } = useAppSelector((s) => s.alert);

  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null); // { machine, fromSlot } | null
  const [moving, setMoving] = useState(false);
  const [zoneQuery, setZoneQuery] = useState("");

  // Gmail-like zone filter: matches zone name, machine codes in the zone.
  const zoneMatches = (z) => {
    const q = zoneQuery.trim().toLowerCase();
    if (!q) return true;
    const codes = (machinesByZone[z.id] || []).map((m) => m.code || m.machineCode || m.name || "");
    return [z.name, z.description, z.location, ...codes]
      .map((f) => String(f || "").toLowerCase())
      .some((f) => f.includes(q));
  };

  // Subscribe to live zone updates
  useLiveTopic("/topic/zones");

  // Fetch on mount + when viewing permission flips (granted elsewhere).
  useEffect(() => {
    if (!canView) return;
    dispatch(fetchZones());
    dispatch(fetchRecentEvents({ limit: 10 }));
    // ACTIVE alerts are the sensor signal for each machine's health score
    // (25 pts per sensor). Machine rows carry no alert fields of their own.
    dispatch(fetchAlerts({ status: "ACTIVE", page: 0, size: 500 }));
  }, [dispatch, canView]);

  // ACTIVE alert rows grouped by machineId — feeds the zone-row health rings.
  const alertsByMachine = useMemo(() => {
    const map = new Map();
    (activeAlerts || []).forEach((a) => {
      if (!a?.machineId) return;
      if (!map.has(a.machineId)) map.set(a.machineId, []);
      map.get(a.machineId).push(a);
    });
    return map;
  }, [activeAlerts]);

  // Fetch machines for each zone once zones load
  useEffect(() => {
    if (!canView || zones.length === 0) return;
    zones.forEach((z) => {
      const zoneId = z.id || z.zoneId || z.name;
      if (zoneId) dispatch(fetchZoneMachines(zoneId));
    });
  }, [dispatch, zones, canView]);

  // GET /api/dashboard/zones/{zoneId} is pulled once per zone up front rather
  // than waiting for the details list to be expanded: it carries the status
  // split chips AND `machines[].activeAlertsCount`. A 403 (OPERATOR,
  // SecurityConfig.java:119) is cached by zoneSlice as
  // `details[id].status === "error"`, so the route is asked exactly once.
  // (Its `healthScore` is no longer rendered — the health ring was removed
  // from this screen on review.)
  useEffect(() => {
    if (!canView || zones.length === 0) return;
    zones.forEach((z) => {
      const zoneId = z.id || z.zoneId;
      if (zoneId && !zoneDetails[zoneId]) dispatch(fetchZoneDetails(zoneId));
    });
  }, [canView, zones, zoneDetails, dispatch]);

  const isLoading = zoneStatus === "loading";
  const isError = zoneStatus === "error";

  // Real backend zones have Mongo ids, not "A"/"B"/"C"/"D". Map the first
  // four zones onto the fixed FactoryMap slots by index so the layout keeps
  // its colors while showing real names + counts. No mocks: empty backend
  // data renders empty states, never fake zones or events.
  const SLOTS = ["A", "B", "C", "D"];
  const slotZones = SLOTS.map((slot, i) => (zones[i] ? { ...zones[i], slot } : null)).filter(Boolean);
  const slotMachines = {};
  slotZones.forEach((z) => {
    slotMachines[z.slot] = machinesByZone[z.id] || [];
  });
  // Keep the real Mongo id in realId — the map slot ("A".."D") is only layout.
  const mapZones = slotZones.map((z) => ({ ...z, id: z.slot, realId: z.id }));
  const realZoneBySlot = {};
  slotZones.forEach((z) => {
    realZoneBySlot[z.slot] = z;
  });

  // ── MOVE MACHINE BETWEEN ZONES (PUT /api/machines/:id, ADMIN) ─────────
  // Drag & drop on web, tap-to-move on mobile. Always confirmed via dialog.
  async function handleMoveMachine(machine, fromSlot, toSlot) {
    if (!machine || !fromSlot || !toSlot || fromSlot === toSlot) return;
    if (!isAdmin) {
      await dialog.alert("Not allowed", "Moving machines requires the MACHINE_WRITE permission.");
      return;
    }
    const fromZone = realZoneBySlot[fromSlot];
    const toZone = realZoneBySlot[toSlot];
    const code = machine.code || machine.machineCode || machine.id;
    const ok = await dialog.confirm(
      "Move machine",
      `Move ${code} from ${fromZone?.name || fromSlot} to ${toZone?.name || toSlot}?`,
      { confirmText: moving ? "Moving…" : "Move" }
    );
    if (!ok) return;
    // PUT requires the full object (name, code, type, status) + new zoneId.
    if (!machine.name || !machine.code || !machine.type || !machine.status || !toZone?.id) {
      await dialog.alert("Cannot move", "Machine data or target zone is incomplete.");
      return;
    }
    setMoving(true);
    try {
      await dispatch(
        updateMachine({
          id: machine.id,
          body: {
            name: machine.name,
            code: machine.code,
            type: machine.type,
            zoneId: toZone.id,
            status: machine.status,
            description: machine.description ?? null,
            caracteristiques: machine.caracteristiques || [],
          },
        })
      ).unwrap();
      setSelectedMachine(null);
      // Refresh counts + both affected zones.
      dispatch(fetchZones());
      dispatch(fetchZoneMachines(fromZone.id));
      dispatch(fetchZoneMachines(toZone.id));
    } catch (e) {
      await dialog.alert("Move failed", e?.message || "Could not move the machine.");
    } finally {
      setMoving(false);
    }
  }

  // ── ZONE DETAILS ────────────────────────────────────────────────────

  if (!canView) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            title="Restricted area"
            message="The factory map requires the ZONE_READ permission."
            action={<Button title="Go Home" variant="primary" size="sm" onPress={() => router.replace(homeRoute)} />}
          />
        </Card>
      </AppShell>
    );
  }

  function ZoneDetailsList() {
    if (slotZones.length === 0) {
      return (
        <Card className="mb-4">
          <EmptyState title="No zones yet" message="Create your first zone to see it on the map." />
        </Card>
      );
    }

    return (
      <Card className="mb-4">
        <Text className={`text-base font-bold font-inter mb-2 ${dark ? "text-white" : "text-text"}`}>
          Zone Details
        </Text>
        <View className={`flex-row items-center border rounded-btn px-3 py-1.5 gap-2 mb-2 ${dark ? "bg-white/5 border-white/15" : "bg-bg border-border"}`}>
          <Text className={`text-xs ${dark ? "text-white/50" : "text-text-muted"}`}>🔍</Text>
          <TextInput
            className={`flex-1 text-xs font-inter ${dark ? "text-white" : "text-text"}`}
            placeholder="Search by zone name, machine code…"
            placeholderTextColor="#94A3B8"
            value={zoneQuery}
            onChangeText={setZoneQuery}
            style={{ outlineStyle: "none" }}
          />
        </View>
        {slotZones.filter(zoneMatches).map((z) => {
          const color = ZONE_COLORS[z.slot] || ZONE_COLORS.A;
          const fallbackMachines = machinesByZone[z.id] || [];
          const detailEntry = zoneDetails[z.id] || null;
          const detail = detailEntry?.data || null;
          // Prefer the Sprint 7 detail — it carries the status split and the
          // per-machine alert counts. While it loads (or when this role may
          // not call /api/dashboard/**) fall back to the plain
          // /api/zones/{id}/machines rows.
          const zoneMachines = detail?.machines?.length ? detail.machines : fallbackMachines;
          const machineCount = detail?.totalMachines ?? z.machineCount ?? zoneMachines.length;
          const statusSplit = detail?.machinesByStatus || null;
          const zoneAlerts = detail?.activeAlertsCount ?? z.alertCount ?? 0;
          const loadingDetail = detailEntry?.status === "loading";
          const isSelected = selectedZone === z.slot;

          const toggleZone = () => {
            if (isSelected) {
              setSelectedZone(null);
              return;
            }
            setSelectedZone(z.slot);
            // First expand only — a rejected (403) detail is cached as `error`
            // so we never hammer a route this role cannot call.
            const entry = zoneDetails[z.id];
            if (!entry || entry.status === "idle") dispatch(fetchZoneDetails(z.id));
          };

          return (
            <Fragment key={z.id}>
            <Pressable
              onPress={toggleZone}
              className={`flex-row items-center py-2.5 px-2 rounded-btn mb-1 ${
                isSelected ? (dark ? "bg-white/10" : "bg-bg") : ""
              }`}
            >
              {/* Zone chip */}
              <View
                className="px-2 py-1 rounded-md mr-3"
                style={{ backgroundColor: color + "18" }}
              >
                <Text
                  className="text-xs font-semibold font-inter"
                  style={{ color }}
                >
                  {z.name}
                </Text>
              </View>

              <View className="flex-1">
                <Text className={`text-sm font-inter ${dark ? "text-white" : "text-text"}`}>
                  {machineCount} machine{machineCount !== 1 ? "s" : ""}
                  {zoneAlerts > 0 && (
                    <Text className="text-danger font-inter">
                      {" "}· {zoneAlerts} alert{zoneAlerts !== 1 ? "s" : ""}
                    </Text>
                  )}
                </Text>
              </View>

              <Text className={`text-sm ${dark ? "text-white/50" : "text-text-muted"}`}>
                {isSelected ? "⌄" : "›"}
              </Text>
            </Pressable>

            {/* Expanded: EVERY machine in this zone with its name, a coloured
                status glyph and its status pill (docs/ui/map&zones.png).
                Rendered only while the zone is selected. */}
            {isSelected ? (
              <View
                className="ml-4 mb-3 pl-3 pt-1"
                style={{ borderLeftWidth: 2, borderLeftColor: `${color}59` }}
              >
                {/* Zone status split + alerts, straight from
                    GET /api/dashboard/zones/{zoneId} */}
                {statusSplit ? (
                  <View className="flex-row flex-wrap gap-1.5 mb-2">
                    {["RUNNING", "IDLE", "MAINTENANCE", "FAILURE", "OFFLINE"]
                      .filter((k) => Number(statusSplit[k]) > 0)
                      .map((k) => {
                        const st = getMachineStatus(k);
                        return (
                          <View
                            key={k}
                            className="flex-row items-center gap-1 px-2 py-0.5 rounded-chip"
                            style={{ backgroundColor: `${st.color}14` }}
                          >
                            <View
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: st.color }}
                            />
                            <Text
                              className="text-[10px] font-semibold font-inter"
                              style={{ color: st.color }}
                            >
                              {Number(statusSplit[k])} {st.label}
                            </Text>
                          </View>
                        );
                      })}
                    {zoneAlerts > 0 ? (
                      <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-chip bg-danger/15">
                        <Text className="text-[10px] font-semibold font-inter text-danger">
                          🚨 {zoneAlerts} alert{zoneAlerts !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {loadingDetail && zoneMachines.length === 0 ? (
                  <Text className={`text-xs font-inter py-2 ${dark ? "text-white/50" : "text-text-muted"}`}>
                    Loading zone details…
                  </Text>
                ) : zoneMachines.length === 0 ? (
                  <Text className={`text-xs font-inter py-2 ${dark ? "text-white/50" : "text-text-muted"}`}>
                    No machines in this zone yet.
                  </Text>
                ) : (
                  zoneMachines.map((m, mIdx) => {
                    const s = getMachineStatus(m?.status);
                    const last = mIdx === zoneMachines.length - 1;
                    // ACTIVE alert rows for THIS machine — machine rows carry no
                    // alert fields, so they come from the alert slice instead.
                    const rows = alertsByMachine.get(m?.id) || [];
                    const alerts = rows.length;
                    // FRONTEND health score (src/lib/health.js) — the backend
                    // route for this measured 151–339 s. Model: 25 pts per
                    // sensor, split 12.5 degraded (WARNING) + 12.5 anomaly
                    // (HIGH/CRITICAL); FAILURE → 0, MAINTENANCE → 50,
                    // OFFLINE → no score (excluded from the factory average).
                    const score = computeMachineHealth({
                      status: m?.status,
                      sensors: rows,
                    });
                    const subLabel =
                      [
                        m?.name && m?.name !== (m?.code || m?.name) ? m.name : null,
                        m?.type,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Machine";

                    return (
                      <Pressable
                        key={m?.id || m?.code || mIdx}
                        onPress={() => m?.id && router.push(`/(app)/machines/${m.id}`)}
                        className={`flex-row items-center gap-3 py-2.5 ${
                          last ? "" : dark ? "border-b border-white/5" : "border-b border-border/70"
                        }`}
                      >
                        {/* Machine glyph, tinted by status, with a status dot */}
                        <View
                          className="w-10 h-10 rounded-btn items-center justify-center shrink-0"
                          style={{ backgroundColor: `${s.color}1A` }}
                        >
                          <Text className="text-base">⚙️</Text>
                          <View
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                            style={{
                              backgroundColor: s.dotColor,
                              borderColor: dark ? "#0B1220" : "#FFFFFF",
                            }}
                          />
                        </View>

                        <View className="flex-1">
                          <View className="flex-row items-center gap-1.5">
                            <Text
                              className={`text-sm font-bold font-inter flex-shrink ${
                                dark ? "text-white" : "text-text"
                              }`}
                              numberOfLines={1}
                            >
                              {m?.code || m?.name || "—"}
                            </Text>
                            {alerts > 0 ? (
                              <View className="px-1.5 py-px rounded-full bg-danger">
                                <Text className="text-[9px] font-bold font-inter text-white">
                                  {alerts}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text
                            className={`text-[11px] font-inter ${dark ? "text-white/50" : "text-text-muted"}`}
                            numberOfLines={1}
                          >
                            {subLabel}
                          </Text>
                          <View
                            className="self-start mt-1 px-2 py-0.5 rounded-chip"
                            style={{ backgroundColor: `${s.color}1F` }}
                          >
                            <Text
                              className="text-[10px] font-bold font-inter"
                              style={{ color: s.color }}
                            >
                              {s.label}
                            </Text>
                          </View>
                        </View>

                        {/* Health score as the SAME circle gauge as the
                            dashboard, right-aligned — FRONTEND-computed. */}
                        <View className="shrink-0 items-center justify-center">
                          <ScoreRing value={score} size={38} stroke={4} />
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}
            </Fragment>
          );
        })}
      </Card>
    );
  }

  // ── RECENT ACTIVITY ─────────────────────────────────────────────────

  function RecentActivity() {
    // Composed from real alerts + interventions (eventSlice) — there is no
    // /api/events on this backend, so the card used to stay permanently empty.
    if (eventStatus === "loading" && events.length === 0) {
      return (
        <Card>
          <Text className={`text-base font-bold font-inter mb-3 ${dark ? "text-white" : "text-text"}`}>
            Recent Activity
          </Text>
          <View className="gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={30} className="rounded-btn" />
            ))}
          </View>
        </Card>
      );
    }

    if (events.length === 0) {
      const blocked = eventStatus === "error";
      return (
        <Card>
          <EmptyState
            title={blocked ? "Activity unavailable" : "No recent activity"}
            message={
              blocked
                ? "Alerts and maintenance could not be read for your role."
                : "Alerts and maintenance interventions show up here as soon as they happen."
            }
          />
        </Card>
      );
    }

    return (
      <Card>
        <Text className={`text-base font-bold font-inter mb-3 ${dark ? "text-white" : "text-text"}`}>
          Recent Activity
        </Text>
        {events.map((event, idx) => {
          const dotColor =
            EVENT_DOTS[String(event.severity || event.kind || event.type || "").toLowerCase()] ||
            EVENT_DOTS.default;
          return (
            <View key={event.id || idx} className="flex-row items-start gap-3 mb-3">
              {/* Timeline dot + line */}
              <View className="items-center" style={{ width: 12 }}>
                <View
                  className="rounded-full mt-1"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: dotColor,
                  }}
                />
                {idx < events.length - 1 && (
                  <View
                    className={`mt-1 ${dark ? "bg-white/15" : "bg-border"}`}
                    style={{ width: 1, height: 24 }}
                  />
                )}
              </View>
              <View className="flex-1">
                <Text className={`text-sm font-inter ${dark ? "text-white" : "text-text"}`} numberOfLines={1}>
                  {event.message || event.description || "Event"}
                </Text>
                <Text className={`text-xs font-inter mt-0.5 ${dark ? "text-white/50" : "text-text-muted"}`}>
                  {event.createdAt ? relativeTime(event.createdAt) : "—"}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>
    );
  }

  // ── WEB LAYOUT ────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <AppShell>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="mb-5">
            <Text className={`text-2xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>Factory Map</Text>
            <Text className={`text-sm font-inter mt-0.5 ${dark ? "text-white/60" : "text-text-muted"}`}>
              Zone Live View
            </Text>
          </View>

          {/* Error */}
          {isError && (
            <Card className="mb-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-danger font-inter">
                  {zoneError?.message || "Failed to load zones"}
                </Text>
                <Button
                  title="Retry"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    dispatch(fetchZones());
                    dispatch(fetchRecentEvents({ limit: 10 }));
                  }}
                />
              </View>
            </Card>
          )}

          {/* Loading */}
          {isLoading && (
            <View className="flex-row gap-6">
              <View style={{ flex: 0.65 }}>
                <Skeleton width="100%" height={380} />
              </View>
              <View style={{ flex: 0.35 }}>
                <Skeleton width="100%" height={180} className="mb-4" />
                <Skeleton width="100%" height={180} />
              </View>
            </View>
          )}

          {/* Content */}
          {!isLoading && (
            <View className="flex-row gap-6">
              {/* Left: Map */}
              <View style={{ flex: 0.65 }}>
                {isAdmin && slotZones.length > 1 && (
                  <Text className={`text-xs font-inter font-bold mb-2 ${dark ? "text-white/80" : "text-text-muted"}`}>
                    {"Drag a machine card and drop it on another zone to move it (ADMIN)."}
                  </Text>
                )}
                <FactoryMap
                  variant="full"
                  zones={mapZones}
                  machinesByZone={slotMachines}
                  selectedZoneId={selectedZone}
                  onZonePress={(id) => setSelectedZone(selectedZone === id ? null : id)}
                  movable={isAdmin && !moving}
                  selectedMachine={selectedMachine}
                  onSelectMachine={setSelectedMachine}
                  onMoveMachine={handleMoveMachine}
                />
              </View>

              {/* Right: Details + Activity */}
              <View style={{ flex: 0.35 }}>
                {ZoneDetailsList()}
                <RecentActivity />
              </View>
            </View>
          )}
        </ScrollView>
      </AppShell>
    );
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────
  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Text className={`text-xl font-bold font-inter mb-1 ${dark ? "text-white" : "text-text"}`}>Factory Map</Text>
        <Text className={`text-sm font-inter mb-4 ${dark ? "text-white/60" : "text-text-muted"}`}>Zone Live View</Text>

        {isError && (
          <Card className="mb-3">
            <Text className="text-sm text-danger font-inter mb-2">
              {zoneError?.message || "Failed to load zones"}
            </Text>
            <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchZones())} />
          </Card>
        )}

        {isLoading ? (
          <View className="gap-3">
            <Skeleton width="100%" height={240} />
            <Skeleton width="100%" height={120} />
            <Skeleton width="100%" height={120} />
          </View>
        ) : (
          <>
            {isAdmin && slotZones.length > 1 && (
              <Text className={`text-xs font-inter mb-2 ${dark ? "text-white/60" : "text-text-muted"}`}>
                {selectedMachine
                  ? `Moving ${selectedMachine.machine?.code || ""} — tap a zone to move it here.`
                  : "Tap a machine card, then tap another zone to move it (ADMIN)."}
              </Text>
            )}
            <FactoryMap
              variant="full"
              zones={mapZones}
              machinesByZone={slotMachines}
              selectedZoneId={selectedZone}
              onZonePress={(id) => setSelectedZone(selectedZone === id ? null : id)}
              movable={isAdmin && !moving}
              selectedMachine={selectedMachine}
              onSelectMachine={setSelectedMachine}
              onMoveMachine={handleMoveMachine}
            />
            <View className="mt-4">
              {ZoneDetailsList()}
              <RecentActivity />
            </View>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}
