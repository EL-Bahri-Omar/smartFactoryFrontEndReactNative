// src/components/BottomSheet.jsx
// The single popup shell used across the app.
//
// Layout contract (this is what makes popups feel right):
//   ┌───────────────────────────────┐
//   │ header  (title / subtitle)    │  fixed
//   ├───────────────────────────────┤
//   │ body    (fields, content)     │  takes the available height, NO scroll
//   ├───────────────────────────────┤
//   │ footer  (Cancel / Save …)     │  pinned — always visible
//   └───────────────────────────────┘
//
// Previously the footer was the last child of a ScrollView, so on a short
// window the action buttons ended up below the fold and the user had to
// scroll inside a dialog to reach them. Now the footer is a sibling of the
// body: it cannot be scrolled away, and the body is sized to fit.
//
// Props:
//   visible, onClose, title?, subtitle?
//   children      body content
//   footer?       node pinned at the bottom (action buttons)
//   overlay?      optional full-screen layer PAINTED ABOVE the sheet, inside
//                 the SAME modal (use for nested popups — a separate <Modal>
//                 stacks behind this one on some platforms / z-index layers)
//   maxWidth      desktop card width (default 620)
//   maxHeightRatio 0.92 default
//   scroll        false (default) — opt in only for genuinely long content
//   bodyClassName extra classes for the body wrapper

import { Modal, View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useDark } from "../hooks/useDark";

export default function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  overlay = null,
  maxWidth = 620,
  maxHeightRatio = 0.92,
  scroll = false,
  bodyClassName = "",
}) {
  const isDesktop = useBreakpoint() === "desktop";
  const dark = useDark();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const panelClass = `border ${dark ? "bg-darkcard border-white/15" : "bg-surface border-border"}`;
  const titleColor = dark ? "text-white" : "text-text";
  const subColor = dark ? "text-white/60" : "text-text-muted";
  const divider = dark ? "rgba(255,255,255,0.10)" : "#E2E8F0";

  const body = scroll ? (
    <ScrollView
      style={{ flexShrink: 1, minHeight: 0 }}
      contentContainerStyle={{ padding: 16 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View
      className={bodyClassName}
      style={{ flexShrink: 1, minHeight: 0, padding: 16, overflow: "hidden" }}
    >
      {children}
    </View>
  );

  const footerNode = footer ? (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        borderTopWidth: 1,
        borderTopColor: divider,
      }}
    >
      {footer}
    </View>
  ) : null;

  // Nested popup layer (technician picker, …): an absolute fill rendered
  // AFTER the sheet card inside this same modal, so it is always painted
  // ON TOP — a second <Modal> would stack behind this one (z-index bug).
  const overlayNode = overlay ? (
    <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
      {overlay}
    </View>
  ) : null;

  const panel = (
    <>
      {!!(title || subtitle) && (
        <View
          style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: divider }}
        >
          {!!title && <Text className={`text-lg font-bold font-inter ${titleColor}`}>{title}</Text>}
          {!!subtitle && <Text className={`text-sm font-inter mt-0.5 ${subColor}`}>{subtitle}</Text>}
        </View>
      )}
      {body}
      {footerNode}
    </>
  );

  if (isDesktop) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <Pressable className="flex-1 bg-black/40 justify-center items-center px-4" onPress={onClose}>
            <Pressable
              className={`rounded-card w-full overflow-hidden ${panelClass}`}
              style={{
                maxWidth,
                maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
                // Column layout is what keeps the footer pinned.
                display: "flex",
                flexDirection: "column",
                // A popup must never outgrow the window.
                marginVertical: 12,
              }}
              onPress={() => {}}
            >
              {panel}
            </Pressable>
          </Pressable>
          {overlayNode}
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
          <Pressable
            className={`w-full rounded-t-3xl overflow-hidden ${panelClass}`}
            style={{
              maxHeight: `${Math.round(Math.max(maxHeightRatio, 0.94) * 100)}%`,
              display: "flex",
              flexDirection: "column",
              paddingBottom: insets.bottom || 8,
            }}
            onPress={() => {}}
          >
            <View className="items-center pt-2">
              <View className="w-10 h-1.5 rounded-full" style={{ backgroundColor: dark ? "rgba(255,255,255,0.25)" : "#E2E8F0" }} />
            </View>
            {panel}
          </Pressable>
        </Pressable>
        {overlayNode}
      </KeyboardAvoidingView>
    </Modal>
  );
}
