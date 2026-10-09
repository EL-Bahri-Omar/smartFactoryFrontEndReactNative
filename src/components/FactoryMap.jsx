// src/components/FactoryMap.jsx
//
// Reusable factory map component.
// variant="compact" — used by Dashboard (smaller, no machine labels)
// variant="full"    — used by Map & Zones screen (large, machine labels visible)
//
// Renders zones A/B/C/D as colored rounded rects with machine markers.
// Zone D turns red when it has an active alert.
// This file is the SINGLE source — Dashboard and Map both import it.
//
// Zone move (ADMIN only, PUT /api/machines/:id):
// - Web: TRUE hold-and-drag with the mouse. Markers are real DOM <div>
//   draggable elements (RN Pressable strips draggable/drop handlers, which
//   is why the previous version only did click-click). Zones are real <div>
//   drop targets with dragover highlight. A floating badge follows the cursor.
// - Mobile: tap a marker to select, then tap another zone (same confirm flow).
// - Every move goes through onMoveMachine(machine, fromSlot, toSlot) so the
//   parent can show the confirmation popup before PUTing.

import { useRef, useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import { getMachineStatus } from "../lib/status";
import { MACHINE_STATUS } from "../constants/roles";

// Status → dot color, from the single source of truth (lib/status.js).
function statusDot(status) {
  return getMachineStatus(status).dotColor;
}

// Zone layout configs — positions as percentages
const ZONE_CONFIG = [
  { id: "A", label: "Zone A", color: "#0D9488", alertColor: "#DC2626", top: "4%", left: "4%", width: "44%", height: "44%" },
  { id: "B", label: "Zone B", color: "#2563EB", alertColor: "#DC2626", top: "4%", left: "52%", width: "44%", height: "44%" },
  { id: "C", label: "Zone C", color: "#7C3AED", alertColor: "#DC2626", top: "52%", left: "4%", width: "44%", height: "44%" },
  { id: "D", label: "Zone D", color: "#EA580C", alertColor: "#DC2626", top: "52%", left: "52%", width: "44%", height: "44%" },
];

const VISIBLE_LIMIT_FULL = 12;
const VISIBLE_LIMIT_COMPACT = 3;

export default function FactoryMap({
  variant = "full",
  zones = [],
  machinesByZone = {},
  onZonePress,
  selectedZoneId,
  movable = false,
  selectedMachine = null,
  onSelectMachine,
  onMoveMachine,
}) {
  const isCompact = variant === "compact";
  const mapHeight = isCompact ? 220 : 380;
  const isWeb = Platform.OS === "web";
  const [dragOverZone, setDragOverZone] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [cursor, setCursor] = useState(null); // { x, y, code } — floating badge on web
  const dragPayload = useRef(null); // { machine, fromSlot } — reliable across browsers

  const zoneDataMap = {};
  zones.forEach((z) => {
    zoneDataMap[z.id || z.name || z.zoneId] = z;
  });

  const visibleSlots = ZONE_CONFIG.filter(
    (zone) => zoneDataMap[zone.id] || (machinesByZone[zone.id] || []).length > 0
  );

  function beginDrag(machine, fromSlot) {
    dragPayload.current = { machine, fromSlot };
    setDraggingId(machine?.id || machine?.code);
  }

  function endDrag() {
    dragPayload.current = null;
    setDraggingId(null);
    setDragOverZone(null);
    setCursor(null);
  }

  function dropOn(toSlot) {
    const payload = dragPayload.current;
    endDrag();
    if (!payload || !toSlot || payload.fromSlot === toSlot) return;
    onMoveMachine?.(payload.machine, payload.fromSlot, toSlot);
  }

  // Track the cursor so a badge follows the dragged marker (web only).
  function trackCursor(e, code) {
    if (!dragPayload.current) return;
    setCursor({ x: e.clientX, y: e.clientY, code });
  }

  return (
    <View
      className="bg-bg rounded-card border border-border overflow-hidden"
      style={{ height: mapHeight, position: "relative" }}
      // Web: clear a tap-selection when clicking empty map space.
      {...(isWeb
        ? { onMouseMove: (e) => trackCursor(e, dragPayload.current?.machine?.code) }
        : {})}
    >
      {/* Grid lines background */}
      <View className="absolute inset-0 opacity-30" pointerEvents="none">
        {[...Array(6)].map((_, i) => (
          <View key={`h${i}`} className="absolute left-0 right-0 bg-border" style={{ top: `${(i + 1) * 16}%`, height: 1 }} />
        ))}
        {[...Array(6)].map((_, i) => (
          <View key={`v${i}`} className="absolute top-0 bottom-0 bg-border" style={{ left: `${(i + 1) * 16}%`, width: 1 }} />
        ))}
      </View>

      {visibleSlots.map((zone) => {
        const zoneData = zoneDataMap[zone.id] || {};
        const machines = machinesByZone[zone.id] || [];
        const machineCount = zoneData.machineCount ?? machines.length;
        const alertCount = zoneData.alertCount || 0;
        const hasAlert = alertCount > 0;
        const isSelected = selectedZoneId === zone.id;
        const isDragOver = dragOverZone === zone.id;
        const bgColor = hasAlert && zone.id === "D" ? zone.alertColor : zone.color;
        const solo = visibleSlots.length === 1;
        const limit = isCompact ? VISIBLE_LIMIT_COMPACT : VISIBLE_LIMIT_FULL;
        const visible = machines.slice(0, limit);
        const extra = machines.length - visible.length;

        const boxStyle = {
          top: solo ? "4%" : zone.top,
          left: solo ? "4%" : zone.left,
          width: solo ? "92%" : zone.width,
          height: solo ? "84%" : zone.height,
          backgroundColor: isDragOver ? bgColor + "35" : bgColor + "18",
          borderWidth: isSelected || isDragOver ? 2 : 1,
          borderColor: isSelected || isDragOver ? bgColor : bgColor + "40",
          borderRadius: 12,
          position: "absolute",
          overflow: "hidden",
        };

        // Tap-to-move fallback (mobile + web click-click).
        function handleZoneTap() {
          if (movable && selectedMachine && selectedMachine.fromSlot !== zone.id) {
            onMoveMachine?.(selectedMachine.machine, selectedMachine.fromSlot, zone.id);
            return;
          }
          onZonePress?.(zone.id);
        }

        const header = (
          <>
            <View className="flex-row items-center gap-1 px-2 py-1 rounded-md self-start m-2" style={{ backgroundColor: bgColor + "25" }}>
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: bgColor }} />
              <Text className="font-semibold font-inter" style={{ color: bgColor, fontSize: isCompact ? 9 : 11 }}>
                {zone.label}
              </Text>
              {!isCompact && (
                <Text className="font-inter" style={{ color: bgColor, fontSize: 9, opacity: 0.8 }}>
                  · {machineCount} machine{machineCount !== 1 ? "s" : ""}
                </Text>
              )}
            </View>
            {hasAlert && (
              <View className="absolute top-2 right-2">
                <View className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#DC2626" }}>
                  <Text className="text-white font-bold font-inter" style={{ fontSize: 8 }}>
                    {alertCount} alert{alertCount !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
            )}
          </>
        );

        // ── WEB: real DOM nodes so native mouse drag works ────────────
        if (isWeb) {
          return (
            <div
              key={zone.id}
              onClick={handleZoneTap}
              onDragOver={
                movable
                  ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverZone !== zone.id) setDragOverZone(zone.id);
                    }
                  : undefined
              }
              onDragLeave={movable ? () => setDragOverZone((z) => (z === zone.id ? null : z)) : undefined}
              onDrop={
                movable
                  ? (e) => {
                      e.preventDefault();
                      dropOn(zone.id);
                    }
                  : undefined
              }
              style={{ ...boxStyle, cursor: isDragOver ? "copy" : "default" }}
            >
              {header}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 8, paddingRight: 8, marginTop: 4 }}>
                {visible.map((m, idx) => {
                  const dotColor = statusDot(m.status);
                  const mid = m.id || m.code || idx;
                  const isPicked = movable && selectedMachine?.machine?.id === m.id;
                  const isDragging = draggingId === (m.id || m.code);
                  return (
                    <div
                      key={mid}
                      draggable={movable && !isCompact}
                      onDragStart={(e) => {
                        if (!movable || isCompact) {
                          e.preventDefault();
                          return;
                        }
                        e.dataTransfer.effectAllowed = "move";
                        // setData is required for Firefox to start the drag.
                        try {
                          e.dataTransfer.setData("text/plain", m.id || m.code || "");
                        } catch {}
                        beginDrag(m, zone.id);
                      }}
                      onDragEnd={endDrag}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!movable || isCompact) return;
                        if (isPicked) onSelectMachine?.(null);
                        else onSelectMachine?.({ machine: m, fromSlot: zone.id });
                      }}
                      title={movable && !isCompact ? `Drag ${m.code || ""} to another zone` : m.code || ""}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: movable && !isCompact ? "grab" : "default",
                        opacity: isDragging ? 0.35 : 1,
                      }}
                    >
                      <div
                        style={{
                          width: isCompact ? 20 : 28,
                          height: isCompact ? 20 : 28,
                          borderRadius: 9999,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: dotColor + "20",
                          borderWidth: isPicked ? 2.5 : 1.5,
                          borderStyle: "solid",
                          borderColor: isPicked ? "#0B1D3A" : dotColor,
                        }}
                      >
                        <div style={{ width: isCompact ? 6 : 8, height: isCompact ? 6 : 8, borderRadius: 9999, backgroundColor: dotColor }} />
                      </div>
                      {!isCompact && (
                        <span style={{ fontSize: 7, color: "#64748B", marginTop: 2, maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.code || m.machineCode || m.name || ""}
                        </span>
                      )}
                    </div>
                  );
                })}
                {extra > 0 && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: bgColor, backgroundColor: bgColor + "25", borderRadius: 9999, padding: "2px 8px", alignSelf: "center" }}>
                    +{extra} more
                  </div>
                )}
              </div>
            </div>
          );
        }

        // ── NATIVE: Pressable tap-to-move (no mouse drag on phones) ────
        return (
          <Pressable key={zone.id} onPress={handleZoneTap} className="absolute rounded-xl overflow-hidden" style={boxStyle}>
            {header}
            <View className="flex-row flex-wrap gap-1.5 px-2 mt-1">
              {visible.map((m, idx) => {
                const dotColor = statusDot(m.status);
                const mid = m.id || m.code || idx;
                const isPicked = movable && selectedMachine?.machine?.id === m.id;
                return (
                  <Pressable
                    key={mid}
                    onPress={() => {
                      if (!movable || isCompact) return;
                      if (isPicked) onSelectMachine?.(null);
                      else onSelectMachine?.({ machine: m, fromSlot: zone.id });
                    }}
                    className="items-center"
                  >
                    <View
                      className="rounded-full items-center justify-center"
                      style={{
                        width: isCompact ? 20 : 28,
                        height: isCompact ? 20 : 28,
                        backgroundColor: dotColor + "20",
                        borderWidth: isPicked ? 2.5 : 1.5,
                        borderColor: isPicked ? "#0B1D3A" : dotColor,
                      }}
                    >
                      <View className="rounded-full" style={{ width: isCompact ? 6 : 8, height: isCompact ? 6 : 8, backgroundColor: dotColor }} />
                    </View>
                    {!isCompact && (
                      <Text className="text-text-muted font-inter mt-0.5" style={{ fontSize: 7 }} numberOfLines={1}>
                        {m.code || m.machineCode || m.name || ""}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
              {extra > 0 && (
                <View className="rounded-full px-2 py-0.5 self-center" style={{ backgroundColor: bgColor + "25" }}>
                  <Text className="font-bold font-inter" style={{ fontSize: 9, color: bgColor }}>
                    +{extra} more
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}

      {/* Floating badge that follows the cursor while dragging (web) */}
      {isWeb && cursor && dragPayload.current && (
        <div
          style={{
            position: "fixed",
            left: cursor.x + 12,
            top: cursor.y + 12,
            zIndex: 9999,
            pointerEvents: "none",
            backgroundColor: "#0B1D3A",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 9999,
            padding: "4px 10px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {cursor.code || "Moving…"}
        </div>
      )}

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
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
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
