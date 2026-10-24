// src/components/Select.jsx
// Simple select dropdown.
//  - Web: renders the option list in a PORTAL fixed to document.body,
//    measured from the trigger. A plain absolutely-positioned <View> gets
//    clipped by ScrollView / BottomSheet <Modal> containers (the "glitchy
//    dropdown" inside popups). The portal escapes every ancestor clip and
//    closes on outside click, scroll and resize.
//  - Native: RN <Modal> picker as before.
// Closes on outside click (web) or selecting an option.

import { Platform, View, Text, Pressable, Modal, FlatList } from "react-native";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDark } from "../hooks/useDark";

const PANEL_MAX_HEIGHT = 280;

export default function Select({
  label,
  value,
  options = [],
  onValueChange,
  placeholder = "Select...",
  disabled = false,
  error,
  className = "",
  labelClassName = "",
  maxHeight = PANEL_MAX_HEIGHT,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // web portal geometry
  const dark = useDark();
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const selectedOption = options.find((o) => o.value === value);

  // Measure the trigger so the portal panel lands right under it. If the
  // ref is not a DOM node (refuse-to-measure), fall back to a centered
  // panel — the dropdown must ALWAYS open, even mid-measure failure.
  const reposition = useCallback(() => {
    const width = Math.min(360, (typeof window !== "undefined" ? window.innerWidth : 400) - 16);
    const el = rootRef.current;
    if (!el || typeof el.getBoundingClientRect !== "function") {
      setPos({ top: 96, left: Math.max(8, ((typeof window !== "undefined" ? window.innerWidth : 400) - width) / 2), width, height: maxHeight, flipUp: false });
      return;
    }
    const r = el.getBoundingClientRect();
    const vh = typeof window !== "undefined" ? window.innerHeight : 700;
    const spaceBelow = vh - r.bottom - 12;
    const flipUp = spaceBelow < Math.min(maxHeight, 200) && r.top > spaceBelow;
    let height = Math.min(maxHeight, flipUp ? r.top - 12 : spaceBelow);
    height = Math.max(140, Math.min(height, vh - 16));
    let top = flipUp ? r.top - height - 4 : r.bottom + 4;
    // Never let the panel land outside the viewport (a trigger near the
    // bottom of a scrolled dialog used to open the list off-screen, which
    // reads as "the dropdown does nothing").
    top = Math.max(8, Math.min(top, vh - height - 8));
    setPos({
      top,
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width || width,
      height,
      flipUp,
    });
  }, [maxHeight]);

  useLayoutEffect(() => {
    if (open && Platform.OS === "web") reposition();
  }, [open, reposition]);

  // Web: close on outside click, scroll and resize.
  useEffect(() => {
    if (!open || Platform.OS !== "web") return undefined;
    const onDocDown = (e) => {
      const inTrigger = rootRef.current?.contains?.(e.target);
      const inPanel = panelRef.current?.contains?.(e.target);
      if (!inTrigger && !inPanel) setOpen(false);
    };
    const close = () => setOpen(false);
    // Scrolling the OPTION LIST itself must not close it (its own FlatList
    // fires scroll events too). Only scrolling the page/underlying sheet does.
    const onScroll = (e) => {
      const inPanel = panelRef.current?.contains?.(e.target);
      if (!inPanel) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDocDown, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function pick(item) {
    onValueChange?.(item.value);
    setOpen(false);
  }

  const optionRows = (
    <FlatList
      data={options}
      keyExtractor={(item) => String(item.value)}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <Pressable
          onPress={() => pick(item)}
          className={`px-4 py-3 border-t ${dark ? "border-white/10" : "border-border"} ${
            item.value === value ? "bg-primary-soft" : ""
          }`}
        >
          <View className="flex-row items-center gap-2">
            {item.dot ? (
              <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.dot }} />
            ) : null}
            <Text
              className={`text-sm font-inter flex-1 ${
                item.value === value ? "text-primary font-semibold" : dark ? "text-white" : "text-text"
              }`}
              numberOfLines={2}
            >
              {item.label}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );

  const panelHeader = (
    <Text
      className={`text-sm font-semibold px-4 pt-3 pb-2 font-inter ${
        dark ? "text-white" : "text-text"
      }`}
    >
      {label || "Select"}
    </Text>
  );

  return (
    <View className={`gap-1 ${className}`}>
      {label && (
        <Text className={`text-sm font-inter ${dark ? "text-white" : "text-text"} ${labelClassName || "font-medium"}`}>
          {label}
        </Text>
      )}
      <Pressable
        ref={rootRef}
        onPress={() => !disabled && setOpen((o) => !o)}
        className={`flex-row items-center justify-between border rounded-btn px-3 py-2.5 ${
          error ? "border-danger" : dark ? "border-white/15" : "border-border"
        } ${dark ? "bg-white/5" : "bg-surface"} ${disabled ? "opacity-50" : ""}`}
      >
        <View className="flex-1 flex-row items-center gap-2">
          {selectedOption?.dot ? (
            <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedOption.dot }} />
          ) : null}
          <Text
            className={`text-sm font-inter flex-1 ${
              selectedOption ? (dark ? "text-white" : "text-text") : "text-offline"
            }`}
            numberOfLines={1}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
        </View>
        <Text className={`text-xs ${dark ? "text-white/50" : "text-text-muted"}`}>▼</Text>
      </Pressable>
      {error && <Text className="text-xs text-danger font-inter">{error}</Text>}

      {/* ── Web: portal panel, fixed to body, escapes ancestor clipping ── */}
      {open && !disabled && Platform.OS === "web" && pos
        ? createWebPortal(
            panelRef,
            <View
              className={`rounded-card border overflow-hidden ${dark ? "bg-darkcard border-white/15" : "bg-surface border-border"}`}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.height,
                // Must beat react-native-web's <Modal> layer (z-index 9999),
                // otherwise the panel is painted BEHIND the popup it belongs
                // to — the "dropdown shows behind the dialog" bug.
                zIndex: 100000,
                shadowColor: "#0F172A",
                shadowOpacity: 0.22,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 20,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {panelHeader}
              {optionRows}
            </View>
          )
        : null}

      {/* ── Native: Modal picker ───────────────────────────────────────── */}
      {Platform.OS !== "web" && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable className="flex-1 bg-black/30 justify-center items-center px-8" onPress={() => setOpen(false)}>
            <View className={`rounded-card w-full max-w-sm border overflow-hidden ${dark ? "bg-darkcard border-white/15" : "bg-surface border-border"}`}>
              {panelHeader}
              {optionRows}
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

/**
 * Render `children` into document.body (web only). Falls back to inline
 * rendering when react-dom is unavailable so the native bundle never
 * imports it.
 */
function createWebPortal(ref, children) {
  try {
    // Lazy require keeps react-dom out of the native bundle graph.
    // eslint-disable-next-line global-require
    const { createPortal } = require("react-dom");
    if (typeof document === "undefined") return children;
    return createPortal(<div ref={ref}>{children}</div>, document.body);
  } catch {
    return children;
  }
}
