// src/components/AiChatBot.jsx
//
// Sprint 11 — Floating AI chatbot in the bottom-right corner.
// Subscribes to /topic/ai-predictions and shows a notification bubble
// when a degradation/anomaly/failure prediction arrives. Shows:
//   - Machine code + predicted status
//   - Time estimate before the event
//   - Recommended fix from the AI model
//   - Problem sensor types
//
// Layout:
//   - Header: 🤖 AI Assistant (count) | All Predictions (N) | ✕
//   - Messages list with prediction cards
//   - Toast "You have new problem predictions" when closed + unread > 0
//   - Wider panel (420px)

import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, Animated, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useDark } from "../hooks/useDark";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useLiveTopic } from "../hooks/useLiveTopic";
import { relativeTime } from "../lib/time";

const MAX_MESSAGES = 10;

const STATUS_EMOJI = {
  degradation: "⚠️",
  anomaly: "🔴",
  failure: "⛔",
  normal: "✅",
};

const STATUS_LABEL = {
  degradation: "Degradation",
  anomaly: "Anomaly",
  failure: "Failure",
  normal: "Normal",
};

function formatEta(hours) {
  if (hours == null) return null;
  if (hours <= 0) return "imminent";
  if (hours < 1) return `~${Math.round(hours * 60)} min`;
  if (hours < 2) return `~${hours.toFixed(1)} hour`;
  return `~${hours.toFixed(1)} hours`;
}

/** Extract problem sensor names */
function getProblemSensors(msg) {
  const sensors = [];
  (msg.drivingSensors || []).forEach((s) => {
    if (s.sensor && s.sensor !== "model" && s.sensor !== "all") {
      sensors.push(s.sensor.charAt(0).toUpperCase() + s.sensor.slice(1));
    }
  });
  return sensors;
}

export default function AiChatBot() {
  const dark = useDark();
  const router = useRouter();
  const isDesktop = useBreakpoint() === "desktop";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;
  const lastPredRef = useRef(null);
  const toastTimerRef = useRef(null);

  // Subscribe to AI predictions
  const livePrediction = useLiveTopic("/topic/ai-predictions", { enabled: true });

  // Pulse animation for the FAB when there are unread messages
  useEffect(() => {
    if (unread > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [unread]);

  // Show/hide toast animation
  useEffect(() => {
    if (showToast) {
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setShowToast(false);
        });
      }, 5000);
    }
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [showToast]);

  // Process incoming predictions
  useEffect(() => {
    if (!livePrediction || livePrediction.eventType !== "AI_PREDICTION") return;

    const status = (livePrediction.predictedStatus || "").toLowerCase();
    // Skip normal predictions — only show degradation/anomaly/failure
    if (status === "normal") return;

    // Dedupe by machineCode + timestamp
    const key = `${livePrediction.machineCode}-${livePrediction.timestamp}`;
    if (lastPredRef.current === key) return;
    lastPredRef.current = key;

    const msg = {
      id: key,
      machineCode: livePrediction.machineCode || livePrediction.machineId || "—",
      machineId: livePrediction.machineId,
      status,
      confidence: livePrediction.confidence,
      anomalyScore: livePrediction.anomalyScore,
      severity: livePrediction.severity,
      estimatedHours: livePrediction.estimatedHoursToEvent,
      recommendedFix: livePrediction.recommendedFix,
      drivingSensors: livePrediction.drivingSensors || [],
      timestamp: livePrediction.timestamp || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    };

    setMessages((prev) => [msg, ...prev].slice(0, MAX_MESSAGES));
    if (!open) {
      setUnread((u) => u + 1);
      setShowToast(true);
    }
  }, [livePrediction, open]);

  const toggleOpen = useCallback(() => {
    setOpen((o) => {
      if (!o) {
        setUnread(0);
        setShowToast(false);
      }
      return !o;
    });
  }, []);

  const goToMachine = useCallback(
    (msg) => {
      const id = msg.machineId || msg.machineCode;
      if (id) router.push(`/(app)/machines/${id}`);
    },
    [router]
  );

  const goToAi = useCallback(() => {
    router.push("/(app)/ai");
    setOpen(false);
  }, [router]);

  const bgSurface = dark ? "bg-[#1e1e2e]" : "bg-white";
  const borderColor = dark ? "border-white/10" : "border-gray-200";
  const textColor = dark ? "text-white" : "text-gray-900";
  const mutedColor = dark ? "text-white/50" : "text-gray-500";
  const fabBg = dark ? "#6366f1" : "#4F46E5";

  // Don't render on mobile (too small) — only on desktop/tablet
  if (!isDesktop) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        alignItems: "flex-end",
      }}
      pointerEvents="box-none"
    >
      {/* Chat panel */}
      {open && (
        <View
          className={`${bgSurface} border ${borderColor} rounded-2xl mb-3`}
          style={{
            width: 440,
            maxHeight: 520,
            ...Platform.select({
              web: {
                boxShadow: dark
                  ? "0 8px 32px rgba(0,0,0,0.5)"
                  : "0 8px 32px rgba(0,0,0,0.15)",
              },
              default: {
                elevation: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
              },
            }),
          }}
        >
          {/* Panel header */}
          <View
            className={`flex-row items-center justify-between px-4 py-3 border-b ${borderColor}`}
          >
            <View className="flex-row items-center gap-2">
              <Text style={{ fontSize: 18 }}>🤖</Text>
              <Text className={`text-sm font-bold font-inter ${textColor}`}>
                AI Assistant
              </Text>
              {/* Current predictions count badge */}
              <View className="px-1.5 py-0.5 rounded-full bg-danger/20">
                <Text className="text-[10px] font-bold font-inter text-danger">
                  {messages.length}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable onPress={goToAi} hitSlop={8}>
                <Text className="text-xs font-bold font-inter text-primary">
                  All Predictions ({messages.length})
                </Text>
              </Pressable>
              <Pressable onPress={toggleOpen} hitSlop={8}>
                <Text className={`text-lg ${mutedColor}`}>✕</Text>
              </Pressable>
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            style={{ maxHeight: 440 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 12 }}
          >
            {messages.length === 0 ? (
              <View className="items-center py-8">
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🤖</Text>
                <Text className={`text-sm font-inter text-center ${mutedColor}`}>
                  No AI alerts at the moment.{"\n"}
                  Degradation and anomaly predictions will appear here in real-time.
                </Text>
              </View>
            ) : (
              messages.map((msg) => {
                const problemSensors = getProblemSensors(msg);
                return (
                  <Pressable
                    key={msg.id}
                    onPress={() => goToMachine(msg)}
                    className={`rounded-xl p-3 mb-2 border ${borderColor} ${
                      dark ? "bg-white/5" : "bg-gray-50"
                    }`}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                  >
                    {/* Status header */}
                    <View className="flex-row items-center justify-between mb-1.5">
                      <View className="flex-row items-center gap-1.5">
                        <Text style={{ fontSize: 14 }}>
                          {STATUS_EMOJI[msg.status] || "⚠️"}
                        </Text>
                        <Text className={`text-sm font-bold font-inter ${textColor}`}>
                          {msg.machineCode}
                        </Text>
                        <View
                          className="px-2 py-0.5 rounded-chip"
                          style={{
                            backgroundColor:
                              msg.status === "failure"
                                ? "#EF444420"
                                : msg.status === "anomaly"
                                  ? "#F9731620"
                                  : "#F59E0B20",
                          }}
                        >
                          <Text
                            className="text-[10px] font-bold font-inter"
                            style={{
                              color:
                                msg.status === "failure"
                                  ? "#EF4444"
                                  : msg.status === "anomaly"
                                    ? "#F97316"
                                    : "#F59E0B",
                            }}
                          >
                            {STATUS_LABEL[msg.status] || msg.status}
                          </Text>
                        </View>
                      </View>
                      <Text className={`text-[10px] font-inter ${mutedColor}`}>
                        {relativeTime(msg.timestamp)}
                      </Text>
                    </View>

                    {/* Problem sensors */}
                    {problemSensors.length > 0 && (
                      <View className="flex-row items-center gap-1 mb-1">
                        <Text style={{ fontSize: 10 }}>🔍</Text>
                        <Text className={`text-[11px] font-inter ${dark ? "text-white/60" : "text-gray-600"}`}>
                          Problem: {problemSensors.join(", ")}
                        </Text>
                      </View>
                    )}

                    {/* Time estimate */}
                    {msg.estimatedHours != null && (
                      <View className="flex-row items-center gap-1 mb-1">
                        <Text style={{ fontSize: 11 }}>⏱️</Text>
                        <Text className={`text-xs font-semibold font-inter ${textColor}`}>
                          Estimated problem in{" "}
                          <Text style={{ color: "#EF4444" }}>
                            {formatEta(msg.estimatedHours)}
                          </Text>
                        </Text>
                      </View>
                    )}

                    {/* Recommended fix */}
                    {msg.recommendedFix && (
                      <View
                        className={`rounded-lg p-2 mt-1 ${
                          dark ? "bg-primary/10" : "bg-indigo-50"
                        }`}
                      >
                        <Text className={`text-[10px] font-bold font-inter mb-0.5 ${
                          dark ? "text-primary" : "text-indigo-700"
                        }`}>
                          💡 Recommended fix
                        </Text>
                        <Text
                          className={`text-[11px] font-inter ${
                            dark ? "text-white/80" : "text-gray-700"
                          }`}
                          numberOfLines={4}
                        >
                          {msg.recommendedFix}
                        </Text>
                      </View>
                    )}

                    {/* Tap hint */}
                    <Text className={`text-[9px] font-inter mt-1.5 ${mutedColor}`}>
                      Tap to view machine →
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* Bottom row: Toast (left) + FAB (right) */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
        {/* Toast message — appears to the LEFT of the FAB */}
        {!open && showToast && (
          <Animated.View
            style={{
              opacity: toastAnim,
              transform: [{ translateX: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            }}
          >
            <Pressable onPress={toggleOpen}>
              <View
                className={`rounded-xl px-4 py-3 ${dark ? "bg-[#1e1e2e]" : "bg-white"} border ${borderColor}`}
                style={{
                  minWidth: 260,
                  ...Platform.select({
                    web: {
                      boxShadow: dark
                        ? "0 4px 16px rgba(0,0,0,0.4)"
                        : "0 4px 16px rgba(0,0,0,0.12)",
                    },
                    default: {
                      elevation: 6,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 6,
                    },
                  }),
                }}
              >
                <View className="flex-row items-center gap-2">
                  <Text style={{ fontSize: 16 }}>🤖</Text>
                  <View className="flex-1">
                    <Text className={`text-xs font-bold font-inter ${textColor}`}>
                      You have new problem predictions
                    </Text>
                    <Text className={`text-[10px] font-inter mt-0.5 ${mutedColor}`}>
                      Tap to view details
                    </Text>
                  </View>
                  <View className="px-1.5 py-0.5 rounded-full bg-danger">
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                      {unread > 9 ? "9+" : unread}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        {/* Floating Action Button */}
        <Pressable onPress={toggleOpen}>
          <Animated.View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: fabBg,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pulseAnim }],
              ...Platform.select({
                web: {
                  boxShadow: `0 4px 16px ${dark ? "rgba(99,102,241,0.4)" : "rgba(79,70,229,0.3)"}`,
                  cursor: "pointer",
                },
                default: {
                  elevation: 8,
                  shadowColor: fabBg,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                },
              }),
            }}
          >
            <Text style={{ fontSize: 24, color: "#fff" }}>
              {open ? "✕" : "🤖"}
            </Text>

            {/* Unread badge */}
            {!open && unread > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  backgroundColor: "#EF4444",
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 4,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: "800",
                  }}
                >
                  {unread > 9 ? "9+" : unread}
                </Text>
              </View>
            )}
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}
