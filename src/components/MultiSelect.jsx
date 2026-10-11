// src/components/MultiSelect.jsx
// Multi-select checklist in a modal: search field + toggle rows with
// checkboxes. Used for picking group operators (OPERATOR users).

import { useState } from "react";
import { View, Text, TextInput, Pressable, Modal, FlatList } from "react-native";
import { useDark } from "../hooks/useDark";

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
  const dark = useDark();
  const selectedSet = new Set(values);

  const filtered = query.trim()
    ? options.filter((o) =>
        `${o.label || ""} ${o.sublabel || ""}`.toLowerCase().includes(query.trim().toLowerCase())
      )
    : options;

  function toggle(value) {
    if (selectedSet.has(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  }

  const selectedLabels = options
    .filter((o) => selectedSet.has(o.value))
    .map((o) => o.label);

  return (
    <View className="gap-1">
      {label && (
        <Text className={`text-sm font-medium font-inter ${dark ? "text-white" : "text-text"}`}>{label}</Text>
      )}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
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

      <Modal visible={open} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/30 justify-center items-center px-8"
          onPress={() => setOpen(false)}
        >
          <View className={`rounded-card w-full max-w-sm border overflow-hidden ${dark ? "bg-darkcard border-white/15" : "bg-surface border-border"}`}>
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
              style={{ maxHeight: 280 }}
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
        </Pressable>
      </Modal>
    </View>
  );
}
