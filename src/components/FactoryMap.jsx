// src/components/FactoryMap.jsx
//
// Reusable factory map component.
// variant="compact" — used by Dashboard (smaller, no machine labels)
// variant="full"    — used by Map & Zones screen (large, machine labels visible)
//
// Renders zones A/B/C/D as colored rounded rects with machine markers.
// Zone D turns red when it has an active alert.
// This file is the SINGLE source — Dashboard and Map both import it.

import { View, Text, Pressable } from "react-native";
import { getMachineStatus } from "../lib/status";
import { MACHINE_STATUS } from "../constants/roles";

// Status → dot color, from the single source of truth (lib/status.js).
// Matches the StatusBadge colors used in the machines table exactly.
function statusDot(status) {
  return getMachineStatus(status).dotColor;
}

// Zone layout configs — positions as percentages
const ZONE_CONFIG = [
  {
    id: "A",
    label: "Zone A",
    color: "#0D9488",    // teal
    alertColor: "#DC2626",
    top: "4%",
    left: "4%",
    width: "44%",
    height: "44%",
  },
  {
    id: "B",
    label: "Zone B",
    color: "#2563EB",    // blue
    alertColor: "#DC2626",
    top: "4%",
    left: "52%",
    width: "44%",
    height: "44%",
  },
  {
    id: "C",
    label: "Zone C",
    color: "#7C3AED",    // purple
    alertColor: "#DC2626",
    top: "52%",
    left: "4%",
    width: "44%",
    height: "44%",
  },
  {
    id: "D",
    label: "Zone D",
    color: "#EA580C",    // orange
    alertColor: "#DC2626",
    top: "52%",
    left: "52%",
    width: "44%",
    height: "44%",
  },
];

// Status dot colors are resolved per-machine via statusDot() (lib/status.js).

export default function FactoryMap({
  variant = "full",
  zones = [],
  machinesByZone = {},
  onZonePress,
  selectedZoneId,
}) {
  const isCompact = variant === "compact";
  const mapHeight = isCompact ? 220 : 380;

  // Build zone data lookup
  const zoneDataMap = {};
  zones.forEach((z) => {
    zoneDataMap[z.id || z.name || z.zoneId] = z;
  });

  // Only render slots backed by real zone data — unmapped slots would show
  // misleading "0 machines" ghost zones (seen when the backend has fewer
  // zones than the four fixed slots). An empty map keeps its grid.
  const visibleSlots = ZONE_CONFIG.filter(
    (zone) => zoneDataMap[zone.id] || (machinesByZone[zone.id] || []).length > 0
  );

  return (
    <View
      className="bg-bg rounded-card border border-border overflow-hidden"
      style={{ height: mapHeight, position: "relative" }}
    >
      {/* Grid lines background */}
      <View className="absolute inset-0 opacity-30">
        {[...Array(6)].map((_, i) => (
          <View
            key={`h${i}`}
            className="absolute left-0 right-0 bg-border"
            style={{ top: `${(i + 1) * 16}%`, height: 1 }}
          />
        ))}
        {[...Array(6)].map((_, i) => (
          <View
            key={`v${i}`}
            className="absolute top-0 bottom-0 bg-border"
            style={{ left: `${(i + 1) * 16}%`, width: 1 }}
          />
        ))}
      </View>

      {/* Zones */}
      {visibleSlots.map((zone) => {
        const zoneData = zoneDataMap[zone.id] || {};
        const machines = machinesByZone[zone.id] || [];
        const machineCount = zoneData.machineCount || machines.length || 0;
        const alertCount = zoneData.alertCount || 0;
        const hasAlert = alertCount > 0;
        const isSelected = selectedZoneId === zone.id;
        const bgColor = hasAlert && zone.id === "D" ? zone.alertColor : zone.color;
        // A lone zone fills the whole map instead of sitting in one quadrant.
        const solo = visibleSlots.length === 1;

        return (
          <Pressable
            key={zone.id}
            onPress={() => onZonePress?.(zone.id)}
            className="absolute rounded-xl overflow-hidden"
            style={{
              top: solo ? "4%" : zone.top,
              left: solo ? "4%" : zone.left,
              width: solo ? "92%" : zone.width,
              height: solo ? "84%" : zone.height, // leaves room for the legend row
              backgroundColor: bgColor + "18",
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? bgColor : bgColor + "40",
              borderRadius: 12,
            }}
          >
            {/* Zone chip label */}
            <View
              className="flex-row items-center gap-1 px-2 py-1 rounded-md self-start m-2"
              style={{ backgroundColor: bgColor + "25" }}
            >
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: bgColor }}
              />
              <Text
                className="font-semibold font-inter"
                style={{
                  color: bgColor,
                  fontSize: isCompact ? 9 : 11,
                }}
              >
                {zone.label}
              </Text>
              {!isCompact && (
                <Text
                  className="font-inter"
                  style={{
                    color: bgColor,
                    fontSize: 9,
                    opacity: 0.8,
                  }}
                >
                  · {machineCount} machine{machineCount !== 1 ? "s" : ""}
                </Text>
              )}
            </View>

            {/* Machine markers */}
            <View className="flex-row flex-wrap gap-1.5 px-2 mt-1">
              {machines.slice(0, isCompact ? 3 : 6).map((m, idx) => {
                const dotColor = statusDot(m.status);
                return (
                  <View key={m.id || idx} className="items-center">
                    <View
                      className="rounded-full items-center justify-center"
                      style={{
                        width: isCompact ? 20 : 28,
                        height: isCompact ? 20 : 28,
                        backgroundColor: dotColor + "20",
                        borderWidth: 1.5,
                        borderColor: dotColor,
                      }}
                    >
                      <View
                        className="rounded-full"
                        style={{
                          width: isCompact ? 6 : 8,
                          height: isCompact ? 6 : 8,
                          backgroundColor: dotColor,
                        }}
                      />
                    </View>
                    {!isCompact && (
                      <Text
                        className="text-text-muted font-inter mt-0.5"
                        style={{ fontSize: 7 }}
                        numberOfLines={1}
                      >
                        {m.code || m.machineCode || m.name || ""}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Alert indicator */}
            {hasAlert && (
              <View className="absolute top-2 right-2">
                <View
                  className="px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "#DC2626" }}
                >
                  <Text className="text-white font-bold font-inter" style={{ fontSize: 8 }}>
                    {alertCount} alert{alertCount !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>
        );
      })}

      {/* Legend (full only) */}
      {!isCompact && (
        <View className="absolute bottom-2 left-3 flex-row gap-3">
          {[
            { label: "Running", color: statusDot(MACHINE_STATUS.RUNNING) },
            { label: "Idle", color: statusDot(MACHINE_STATUS.IDLE) },
            { label: "Maintenance", color: statusDot(MACHINE_STATUS.MAINTENANCE) },
            { label: "Failure", color: statusDot(MACHINE_STATUS.FAILURE) },
            { label: "Offline", color: statusDot(MACHINE_STATUS.OFFLINE) },
          ].map((item) => (
            <View key={item.label} className="flex-row items-center gap-1">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <Text className="text-text-muted font-inter" style={{ fontSize: 9 }}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
