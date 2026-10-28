// src/components/FactoryMap.jsx
//
// Reusable factory map component.
// variant="compact" — used by Dashboard (smaller cards: dot + code)
// variant="full"    — used by Map & Zones screen (dot + code + glyph)
//
// Renders zones A/B/C/D as colored rounded rects; every machine is a small
// card (docs/ui/map&zones.png) instead of a bare dot.
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
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useDark } from "../hooks/useDark";

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
const VISIBLE_LIMIT_COMPACT = 4;

// ── Machine card (docs/ui/map&zones.png) ───────────────────────────────────
// Each machine is a small raised card, NOT a bare dot: status dot + code on
// line one and a machine glyph below (wide variant). The card is a neutral
// surface so the status colour reads as an accent — the same treatment as the
// tiles in the reference image. The health-score ring was removed from the
// Map & Zones overview on review (it duplicated the Zone Details list and
// never had data while the backend health routes fail).
// `glyph: false` on narrow screens: a phone-sized zone only has room for two
// columns, so the glyph is what gets dropped first.
const TILE = {
  compact: { w: 58, r: 8, glyph: false },
  narrow: { w: 62, r: 8, glyph: false },
  full: { w: 66, r: 9, glyph: true },
};

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
  const breakpoint = useBreakpoint();
  const narrow = breakpoint !== "desktop";
  // The 4-quadrant layout gives each zone 44% of this height; the values below
  // are sized so 12 machine cards (3 rows wide / 6 rows narrow) always fit
  // inside a quadrant instead of being clipped by `overflow: hidden`.
  const mapHeight = isCompact ? (narrow ? 300 : 250) : 540;
  const tile = isCompact ? TILE.compact : narrow ? TILE.narrow : TILE.full;
  const isWeb = Platform.OS === "web";
  const dark = useDark();
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

  // ── Status legend — moved ABOVE the map and enlarged (review: "let the
  // color indicating status below the zones be bigger and move them to the
  // top"). Full variant only; the compact dashboard map keeps its space.
  const legend = !isCompact ? (
    <View
      className={`flex-row flex-wrap items-center gap-x-4 gap-y-1.5 px-3 pt-2.5 pb-2.5 border-b ${
        dark ? "border-white/10" : "border-border"
      }`}
    >
      {[
        { label: "Running", color: statusDot(MACHINE_STATUS.RUNNING) },
        { label: "Idle", color: statusDot(MACHINE_STATUS.IDLE) },
        { label: "Maintenance", color: statusDot(MACHINE_STATUS.MAINTENANCE) },
        { label: "Failure", color: statusDot(MACHINE_STATUS.FAILURE) },
        { label: "Offline", color: statusDot(MACHINE_STATUS.OFFLINE) },
      ].map((item) => (
        <View key={item.label} className="flex-row items-center gap-1.5">
          <View
            className="w-3.5 h-3.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <Text
            className={`font-semibold font-inter ${dark ? "text-white/75" : "text-text"}`}
            style={{ fontSize: 12 }}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <View className={`rounded-card border overflow-hidden ${dark ? "bg-darkcard border-white/10" : "bg-bg border-border"}`}>
    {legend}
    <View
      style={{ height: mapHeight, position: "relative" }}
      // Web: clear a tap-selection when clicking empty map space.
      {...(isWeb
        ? { onMouseMove: (e) => trackCursor(e, dragPayload.current?.machine?.code) }
        : {})}
    >
      {/* Grid lines background */}
      <View className="absolute inset-0 opacity-30" pointerEvents="none">
        {[...Array(6)].map((_, i) => (
          <View key={`h${i}`} className={`absolute left-0 right-0 ${dark ? "bg-white/10" : "bg-border"}`} style={{ top: `${(i + 1) * 16}%`, height: 1 }} />
        ))}
        {[...Array(6)].map((_, i) => (
          <View key={`v${i}`} className={`absolute top-0 bottom-0 ${dark ? "bg-white/10" : "bg-border"}`} style={{ left: `${(i + 1) * 16}%`, width: 1 }} />
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
          height: solo ? "92%" : zone.height,
          backgroundColor: isDragOver ? bgColor + "35" : bgColor + "18",
          borderWidth: isSelected || isDragOver ? 2 : 1,
          borderColor: isSelected || isDragOver ? bgColor : bgColor + "40",
          borderRadius: 12,
          position: "absolute",
          overflow: "hidden",
        };

        // Zone tap — only for viewing zone details, no click-to-move.
        function handleZoneTap() {
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
                  const label = m.code || m.machineCode || m.name || "";
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
                      }}
                      title={movable && !isCompact ? `Drag ${label} to another zone` : label}
                      style={{
                        boxSizing: "border-box",
                        flexShrink: 0,
                        width: tile.w,
                        borderRadius: tile.r,
                        padding: isCompact ? "3px 5px" : "4px 5px",
                        backgroundColor: dark ? "#0D1729" : "#FFFFFF",
                        border: `${isPicked ? 2 : 1}px solid ${dotColor}${isPicked ? "" : "59"}`,
                        boxShadow: isPicked ? `0 0 0 2px ${dotColor}59` : "none",
                        cursor: movable && !isCompact ? "grab" : "default",
                        opacity: isDragging ? 0.35 : 1,
                      }}
                    >
                      {/* line 1 — status dot · code */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 9999,
                            backgroundColor: dotColor,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 7.5,
                            fontWeight: 700,
                            letterSpacing: 0.2,
                            color: dark ? "#E8EDF7" : "#0F172A",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {label}
                        </span>
                      </div>
                      {/* line 2 — machine glyph (only where there is room) */}
                      {tile.glyph ? (
                        <div style={{ fontSize: 13, lineHeight: "16px", textAlign: "center", marginTop: 2 }}>
                          ⚙️
                        </div>
                      ) : null}
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
                const label = m.code || m.machineCode || m.name || "";
                return (
                  <Pressable
                    key={mid}
                    onPress={() => {
                      if (!movable || isCompact) return;
                      if (isPicked) onSelectMachine?.(null);
                      else onSelectMachine?.({ machine: m, fromSlot: zone.id });
                    }}
                    style={{
                      flexShrink: 0,
                      width: tile.w,
                      borderRadius: tile.r,
                      paddingVertical: isCompact ? 3 : 4,
                      paddingHorizontal: 5,
                      backgroundColor: dark ? "#0D1729" : "#FFFFFF",
                      borderWidth: isPicked ? 2 : 1,
                      borderColor: dotColor + (isPicked ? "" : "59"),
                    }}
                  >
                    {/* line 1 — status dot · code */}
                    <View className="flex-row items-center" style={{ gap: 4 }}>
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: dotColor,
                          flexShrink: 0,
                        }}
                      />
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontSize: 7.5,
                          fontWeight: "700",
                          letterSpacing: 0.2,
                          color: dark ? "#E8EDF7" : "#0F172A",
                        }}
                      >
                        {label}
                      </Text>
                    </View>
                    {/* line 2 — machine glyph (only where there is room) */}
                    {tile.glyph ? (
                      <Text style={{ fontSize: 13, lineHeight: 17, textAlign: "center", marginTop: 2 }}>
                        ⚙️
                      </Text>
                    ) : null}
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
    </View>
    </View>
  );
}
