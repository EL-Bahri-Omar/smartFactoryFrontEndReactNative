// app/(app)/map.jsx
//
// Map & Zones — web + mobile, same file.
// Web:  Left (~65%) large FactoryMap (variant="full") + Right (~35%) Zone Details + Recent Activity.
// Mobile: Map full width, Zone Details + Recent Activity stacked below.
//
// Dispatches fetchZones + fetchRecentEvents on mount.
// Subscribes to /topic/zones for live updates via liveSlice.

import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
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
import { useRole } from "../../src/hooks/useRole";
import { fetchZones, fetchZoneMachines } from "../../src/store/slices/zoneSlice";
import { updateMachine } from "../../src/store/slices/machineSlice";
import { fetchRecentEvents } from "../../src/store/slices/eventSlice";
import { useDialog } from "../../src/components/dialog/DialogContext";
import { useLiveTopic } from "../../src/hooks/useLiveTopic";
import { relativeTime } from "../../src/lib/time";

// Zone color mapping
const ZONE_COLORS = {
  A: "#0D9488",
  B: "#2563EB",
  C: "#7C3AED",
  D: "#EA580C",
};

// Event type → dot color
const EVENT_DOTS = {
  alert: "#DC2626",
  warning: "#F59E0B",
  info: "#2563EB",
  success: "#16A34A",
  default: "#94A3B8",
};

export default function MapScreen() {
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const breakpoint = useBreakpoint();
  const dark = useDark();
  const { isAdmin } = useRole();
  const isDesktop = breakpoint === "desktop";

  const { list: zones, machinesByZone, status: zoneStatus, error: zoneError } =
    useAppSelector((s) => s.zone);
  const { list: events, status: eventStatus } = useAppSelector((s) => s.event);

  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null); // { machine, fromSlot } | null
  const [moving, setMoving] = useState(false);

  // Subscribe to live zone updates
  useLiveTopic("/topic/zones");

  // Fetch on mount
  useEffect(() => {
    dispatch(fetchZones());
    dispatch(fetchRecentEvents({ limit: 10 }));
  }, [dispatch]);

  // Fetch machines for each zone once zones load
  useEffect(() => {
    if (zones.length > 0) {
      zones.forEach((z) => {
        const zoneId = z.id || z.zoneId || z.name;
        if (zoneId) dispatch(fetchZoneMachines(zoneId));
      });
    }
  }, [dispatch, zones]);

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
      await dialog.alert("Not allowed", "Only administrators can move machines between zones.");
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
        <Text className="text-base font-bold text-text font-inter mb-3">
          Zone Details
        </Text>
        {slotZones.map((z) => {
          const color = ZONE_COLORS[z.slot] || ZONE_COLORS.A;
          const machineCount = z.machineCount ?? (machinesByZone[z.id] || []).length;
          const alertCount = z.alertCount || 0; // no alertCount in Sprint 1 — always 0
          const isSelected = selectedZone === z.slot;

          return (
            <Pressable
              key={z.id}
              onPress={() => setSelectedZone(isSelected ? null : z.slot)}
              className={`flex-row items-center py-2.5 px-2 rounded-btn mb-1 ${
                isSelected ? "bg-bg" : ""
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
                <Text className="text-sm text-text font-inter">
                  {machineCount} machine{machineCount !== 1 ? "s" : ""}
                  {alertCount > 0 && (
                    <Text className="text-danger font-inter">
                      {" "}· {alertCount} alert{alertCount !== 1 ? "s" : ""}
                    </Text>
                  )}
                </Text>
              </View>

              <Text className="text-text-muted text-sm">›</Text>
            </Pressable>
          );
        })}
      </Card>
    );
  }

  // ── RECENT ACTIVITY ─────────────────────────────────────────────────

  function RecentActivity() {
    // No /api/events on the Sprint 1 backend — empty until events ship.
    if (events.length === 0) {
      return (
        <Card>
          <EmptyState title="No recent activity" message="Machine events will appear here once the backend publishes them." />
        </Card>
      );
    }

    return (
      <Card>
        <Text className="text-base font-bold text-text font-inter mb-3">
          Recent Activity
        </Text>
        {events.map((event, idx) => {
          const dotColor = EVENT_DOTS[event.type || event.severity] || EVENT_DOTS.default;
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
                    className="bg-border mt-1"
                    style={{ width: 1, height: 24 }}
                  />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm text-text font-inter" numberOfLines={1}>
                  {event.message || event.description || "Event"}
                </Text>
                <Text className="text-xs text-text-muted font-inter mt-0.5">
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
                    {selectedMachine
                      ? `Moving ${selectedMachine.machine?.code || ""} — drop it on a zone, or click the machine again to cancel.`
                      : " ** Hold-click a machine dot and drag it to another zone to move it."}
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
                <ZoneDetailsList />
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
                  : "Tap a machine dot, then tap another zone to move it (ADMIN)."}
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
              <ZoneDetailsList />
              <RecentActivity />
            </View>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}
