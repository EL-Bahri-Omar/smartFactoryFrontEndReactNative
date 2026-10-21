// src/components/MultiSelect.jsx
// Multi-select checklist: search field + toggle rows with checkboxes.
// Used for picking group operators (OPERATOR users).
//
// Web: the option panel renders in a PORTAL fixed to document.body so it is
// never clipped by a parent ScrollView or a <Modal> (popup) — the source of
// the "glitchy dropdown" reports. Closes on outside click / scroll / resize.
// Native: RN <Modal> picker.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Modal, FlatList, Platform } from "react-native";
import { useDark } from "../hooks/useDark";

const PANEL_MAX_HEIGHT = 300;

export default function MultiSelect({
  label,
  values = [],
  options = [],
  onChange,
  placeholder = "Select...",
  disabled = false,
  hint,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState(null);
  const dark = useDark();
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const selectedSet = new Set(values);

  const filtered = query.trim()
    ? options.filter((o) =>
        `${o.label || ""} ${o.sublabel || ""}`.toLowerCase().includes(query.trim().toLowerCase())
      )
    : options;

  // Anchor the portal panel to the trigger. If measurement is unavailable
  // (ref not a DOM node yet), fall back to a centered panel — the picker must
  // always open, never silently fail.
  const reposition = useCallback(() => {
    const el = rootRef.current;
    const vw = typeof window !== "undefined" ? window.innerWidth : 400;
    if (!el || typeof el.getBoundingClientRect !== "function") {
      const w = Math.min(360, vw - 16);
      setPos({ top: 96, left: Math.max(8, (vw - w) / 2), width: w, height: Math.max(200, PANEL_MAX_HEIGHT) });
      return;
    }
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - r.bottom - 12;
    const flipUp = spaceBelow < 220 && r.top > spaceBelow;
    let height = Math.min(PANEL_MAX_HEIGHT + 96, flipUp ? r.top - 12 : spaceBelow);
    height = Math.max(200, Math.min(height, vh - 16));
    let top = flipUp ? r.top - height - 4 : r.bottom + 4;
    // Keep the panel on screen even when the trigger is at the bottom of a
    // scrolled dialog (otherwise it opens below the fold and looks broken).
    top = Math.max(8, Math.min(top, vh - height - 8));
    setPos({
      top,
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width || Math.min(360, vw - 16),
      height,
      flipUp,
    });
  }, []);

  useLayoutEffect(() => {
    if (open && Platform.OS === "web") reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open || Platform.OS !== "web") return undefined;
    const onDocDown = (e) => {
      const inTrigger = rootRef.current?.contains?.(e.target);
      const inPanel = panelRef.current?.contains?.(e.target);
      if (!inTrigger && !inPanel) setOpen(false);
    };
    const close = () => setOpen(false);
    // Ignore scrolls that happen inside the option list itself (its own
    // list scrolls) — only page/sheet scroll should dismiss the panel.
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

  function toggle(value) {
    if (selectedSet.has(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  }

  const selectedLabels = options.filter((o) => selectedSet.has(o.value)).map((o) => o.label);

  const body = (
    <View className={`rounded-card border overflow-hidden ${dark ? "bg-darkcard border-white/15" : "bg-surface border-border"}`}>
      <Text className={`text-sm font-bold px-4 pt-3 pb-2 font-inter ${dark ? "text-white" : "text-text"}`}>
        {label || "Select"} ({values.length} selected)
      </Text>
      <View className={`mx-4 mb-2 flex-row items-center border rounded-btn px-3 py-2 gap-2 ${dark ? "bg-white/5 border-white/15" : "bg-bg border-border"}`}>
        <Text className={`text-sm ${dark ? "text-white/50" : "text-text-muted"}`}>🔍</Text>
        <TextInput
          className={`flex-1 text-sm font-inter ${dark ? "text-white" : "text-text"}`}
          placeholder="Search..."
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={setQuery}
          style={{ outlineStyle: "none" }}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.value)}
        style={{ flexGrow: 0, maxHeight: PANEL_MAX_HEIGHT }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text className={`text-sm font-inter text-center py-6 px-4 ${dark ? "text-white/50" : "text-text-muted"}`}>
            No matching users.
          </Text>
        }
        renderItem={({ item }) => {
          const checked = selectedSet.has(item.value);
          return (
            <Pressable
              onPress={() => toggle(item.value)}
              className={`px-4 py-3 border-t flex-row items-center gap-3 ${dark ? "border-white/10" : "border-border"} ${checked ? "bg-primary-soft" : ""}`}
            >
              <View
                className={`w-5 h-5 rounded border-2 items-center justify-center ${checked ? "bg-primary border-primary" : dark ? "border-white/30" : "border-border"}`}
              >
                {checked && <Text className="text-white text-[10px] font-bold">✓</Text>}
              </View>
              <View className="flex-1">
                <Text className={`text-sm font-inter ${checked ? "text-primary font-bold" : dark ? "text-white" : "text-text"}`}>
                  {item.label}
                </Text>
                {!!item.sublabel && (
                  <Text className={`text-xs font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>{item.sublabel}</Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />
      <View className={`p-3 border-t ${dark ? "border-white/10" : "border-border"}`}>
        <Pressable onPress={() => { setOpen(false); setQuery(""); }} className="bg-primary rounded-btn px-4 py-2.5 items-center">
          <Text className="text-white font-bold text-sm font-inter">Done</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View className="gap-1">
      {label && (
        <Text className={`text-sm font-medium font-inter ${dark ? "text-white" : "text-text"}`}>{label}</Text>
      )}
      <Pressable
        ref={rootRef}
        onPress={() => !disabled && setOpen((o) => !o)}
        className={`flex-row items-center justify-between border rounded-btn px-3 py-2.5 ${dark ? "bg-white/5 border-white/15" : "bg-surface border-border"} ${disabled ? "opacity-50" : ""}`}
      >
        <Text
          className={`text-sm font-inter flex-1 ${values.length ? (dark ? "text-white" : "text-text") : "text-offline"}`}
          numberOfLines={1}
        >
          {values.length ? `${values.length} selected — ${selectedLabels.slice(0, 2).join(", ")}${selectedLabels.length > 2 ? "…" : ""}` : placeholder}
        </Text>
        <Text className={`text-xs ${dark ? "text-white/50" : "text-text-muted"}`}>▼</Text>
      </Pressable>
      {hint && <Text className={`text-xs font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>{hint}</Text>}

      {/* Web: portal panel */}
      {open && Platform.OS === "web" && pos
        ? createWebPortal(
            panelRef,
            <View
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.height,
                // Above react-native-web's <Modal> layer (z-index 9999) so the
                // panel is never painted behind its dialog.
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
              {body}
            </View>
          )
        : null}

      {/* Native */}
      {Platform.OS !== "web" && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable className="flex-1 bg-black/30 justify-center items-center px-8" onPress={() => setOpen(false)}>
            {body}
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function createWebPortal(ref, children) {
  try {
    // eslint-disable-next-line global-require
    const { createPortal } = require("react-dom");
    if (typeof document === "undefined") return children;
    return createPortal(<div ref={ref}>{children}</div>, document.body);
  } catch {
    return children;
  }
}
