// src/components/BottomSheet.jsx
// Adaptive modal panel reused by Alerts (detail sheet) and Maintenance
// (create-ticket form):
//   - mobile/tablet: slides up from the bottom (rounded top, max 85% height,
//     safe-area aware) — the "bottom sheet" from the ui-notes designs;
//   - desktop web: centered modal card (consistent with AddMachineModal).
//
// Props: { visible, onClose, title?, children, maxWidth? }

import { Modal, View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useDark } from "../hooks/useDark";

export default function BottomSheet({ visible, onClose, title, subtitle, children, maxWidth = 640, maxHeightRatio = 0.85 }) {
  const isDesktop = useBreakpoint() === "desktop";
  const dark = useDark();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const panelClass = `border ${dark ? "bg-darkcard border-white/15" : "bg-surface border-border"}`;
  const titleColor = dark ? "text-white" : "text-text";
  const subColor = dark ? "text-white/60" : "text-text-muted";

  if (isDesktop) {
    // Centered card (web)
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <Pressable
            className="flex-1 bg-black/40 justify-center items-center px-4"
            onPress={onClose}
          >
            <Pressable
              className={`rounded-card w-full ${panelClass}`}
              style={{ maxWidth, maxHeight: `${Math.round(maxHeightRatio * 100)}%` }}
              onPress={() => {}}
            >
              <View className="px-6 pt-5 pb-2 border-b" style={dark ? { borderBottomColor: "rgba(255,255,255,0.1)" } : { borderBottomColor: "#E2E8F0" }}>
                {!!title && <Text className={`text-lg font-bold font-inter ${titleColor}`}>{title}</Text>}
                {!!subtitle && <Text className={`text-sm font-inter mt-0.5 ${subColor}`}>{subtitle}</Text>}
              </View>
              <ScrollView contentContainerStyle={{ padding: 24 }} showsVerticalScrollIndicator={false}>
                {children}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  // Slide-up sheet (mobile / tablet)
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
          <Pressable
            className={`w-full rounded-t-3xl ${panelClass}`}
            style={{ maxHeight: `${Math.round(maxHeightRatio * 100)}%`, paddingBottom: insets.bottom || 12 }}
            onPress={() => {}}
          >
            <View className="items-center pt-2">
              <View className="w-10 h-1.5 rounded-full" style={{ backgroundColor: dark ? "rgba(255,255,255,0.25)" : "#E2E8F0" }} />
            </View>
            <View className={`px-5 pt-3 pb-2 border-b ${dark ? "" : ""}`} style={dark ? { borderBottomColor: "rgba(255,255,255,0.1)" } : { borderBottomColor: "#E2E8F0" }}>
              {!!title && <Text className={`text-lg font-bold font-inter ${titleColor}`}>{title}</Text>}
              {!!subtitle && <Text className={`text-sm font-inter mt-0.5 ${subColor}`}>{subtitle}</Text>}
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
