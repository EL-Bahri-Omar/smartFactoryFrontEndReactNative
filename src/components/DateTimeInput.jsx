// src/components/DateTimeInput.jsx
//
// Date + time picker for scheduling (interventions) and range filters
// (history).
//
// Why this is hand-built: it used to wrap the browser's native
// <input type="date"> / <input type="time">. Their popups are drawn by the
// browser/OS, ignore our styling, and on Windows they showed up as opaque
// BLACK rectangles ("the date select appears all black"). Nothing we set on
// the input reliably fixes that, so the picker is now ordinary React Native
// views inside the app's own BottomSheet — same look on every platform, no
// OS widget involved.
//
// Value format stays the browser-native one the forms already use:
//   "YYYY-MM-DDTHH:mm"  (local time, no seconds, no timezone)
//
// Usage:
//   <DateTimeInput value={scheduledAt} onChange={setScheduledAt} />

import { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import BottomSheet from "./BottomSheet";
import Button from "./Button";
import { useDark } from "../hooks/useDark";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const pad = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:mm" → parts. Missing time defaults to 09:00. */
function parseValue(raw) {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(raw));
  if (!m) return null;
  return {
    y: Number(m[1]),
    m: Number(m[2]) - 1,
    d: Number(m[3]),
    hh: m[4] != null ? Number(m[4]) : 9,
    mm: m[5] != null ? Number(m[5]) : 0,
  };
}

function toValue({ y, m, d, hh, mm }) {
  return `${y}-${pad(m + 1)}-${pad(d)}T${pad(hh)}:${pad(mm)}`;
}

function todayParts() {
  const now = new Date();
  return {
    y: now.getFullYear(),
    m: now.getMonth(),
    d: now.getDate(),
    hh: now.getHours(),
    mm: Math.floor(now.getMinutes() / 5) * 5,
  };
}

/** "Tue 21 Oct 2026 · 14:30" — never a raw ISO string in the UI. */
function formatDisplay(raw) {
  const p = parseValue(raw);
  if (!p) return null;
  const dt = new Date(p.y, p.m, p.d);
  const weekday = dt.toLocaleDateString(undefined, { weekday: "short" });
  const month = dt.toLocaleDateString(undefined, { month: "short" });
  return `${weekday} ${p.d} ${month} ${p.y} · ${pad(p.hh)}:${pad(p.mm)}`;
}

/** 42 cells (6 weeks) for the visible month, Monday-first. */
function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Sunday(0) → 6, Monday(1) → 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0 || cells.length < 42) cells.push(null);
  return cells;
}

export default function DateTimeInput({
  value,
  onChange,
  placeholder = "Select date & time",
  disabled = false,
  className = "",
}) {
  const dark = useDark();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: 2000, m: 0 });
  const [draft, setDraft] = useState(null);

  const selected = parseValue(value);
  const display = formatDisplay(value);

  function openPicker() {
    if (disabled) return;
    const seed = selected || todayParts();
    setDraft(seed);
    setView({ y: seed.y, m: seed.m });
    setOpen(true);
  }

  function shiftMonth(delta) {
    setView((v) => {
      const next = new Date(v.y, v.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  }

  const cells = useMemo(() => buildGrid(view.y, view.m), [view.y, view.m]);
  const today = todayParts();
  const isSelectedMonth =
    selected && selected.y === view.y && selected.m === view.m;

  function pickDay(day) {
    if (!day) return;
    setDraft((d) => ({ ...(d || todayParts()), y: view.y, m: view.m, d: day }));
  }

  function bump(unit, delta) {
    setDraft((d) => {
      const base = d || todayParts();
      if (unit === "hour") return { ...base, hh: (base.hh + delta + 24) % 24 };
      return { ...base, mm: (base.mm + delta + 60) % 60 };
    });
  }

  function apply() {
    if (!draft) return;
    onChange?.(toValue(draft));
    setOpen(false);
  }

  function clear() {
    onChange?.("");
    setOpen(false);
  }

  function setNow() {
    setDraft(todayParts());
  }

  const iconColor = dark ? "#94A3B8" : "#64748B";

  const stepButton = (label, onPress) => (
    <Pressable
      onPress={onPress}
      className={`w-10 h-10 rounded-btn items-center justify-center border ${
        dark ? "border-white/15 bg-white/5" : "border-border bg-bg"
      }`}
    >
      <Text className={`text-base font-bold font-inter ${dark ? "text-white" : "text-text"}`}>{label}</Text>
    </Pressable>
  );

  return (
    <View className={`gap-1 ${className}`}>
      <Pressable
        onPress={openPicker}
        disabled={disabled}
        className={`flex-row items-center justify-between border rounded-btn px-3 py-2.5 ${
          disabled ? "opacity-50" : ""
        } ${
          value
            ? dark
              ? "bg-success/10 border-success/40"
              : "bg-green-50 border-success/40"
            : dark
              ? "bg-white/5 border-white/15"
              : "bg-surface border-border"
        }`}
        style={
          open && !disabled
            ? {
                // Same click/focus lift as Input while the picker is open.
                shadowColor: "#2563EB",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.28,
                shadowRadius: 6,
                elevation: 4,
              }
            : null
        }
      >
        <View className="flex-row items-center gap-2 flex-1">
          <Text style={{ fontSize: 14, color: iconColor }}>📅</Text>
          <Text
            numberOfLines={1}
            className={`text-sm font-inter flex-1 ${
              value ? (dark ? "text-white" : "text-text") : "text-offline"
            }`}
          >
            {display || placeholder}
          </Text>
        </View>
        <Text className={`text-xs ${dark ? "text-white/40" : "text-text-muted"}`}>▼</Text>
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Scheduled for"
        subtitle="Pick a date, then adjust the time."
        maxWidth={440}
        footer={
          <View className="flex-row items-center justify-end gap-2">
            {value ? <Button title="Clear" variant="ghost" size="sm" onPress={clear} /> : null}
            <Button title="Cancel" variant="ghost" size="sm" onPress={() => setOpen(false)} />
            <Button title="Apply" variant="primary" size="sm" onPress={apply} disabled={!draft} />
          </View>
        }
      >
        {/* Month navigation */}
        <View className="flex-row items-center justify-between mb-3">
          <Pressable
            onPress={() => shiftMonth(-1)}
            className={`w-9 h-9 rounded-btn items-center justify-center border ${
              dark ? "border-white/15" : "border-border"
            }`}
          >
            <Text className={`text-sm font-bold ${dark ? "text-white" : "text-text"}`}>‹</Text>
          </Pressable>
          <Text className={`text-sm font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
            {MONTHS[view.m]} {view.y}
          </Text>
          <Pressable
            onPress={() => shiftMonth(1)}
            className={`w-9 h-9 rounded-btn items-center justify-center border ${
              dark ? "border-white/15" : "border-border"
            }`}
          >
            <Text className={`text-sm font-bold ${dark ? "text-white" : "text-text"}`}>›</Text>
          </Pressable>
        </View>

        {/* Weekday header */}
        <View className="flex-row mb-1">
          {WEEKDAYS.map((w) => (
            <View key={w} style={{ width: `${100 / 7}%` }} className="items-center py-1">
              <Text className={`text-[10px] font-semibold font-inter ${dark ? "text-white/40" : "text-text-muted"}`}>
                {w}
              </Text>
            </View>
          ))}
        </View>

        {/* Day grid */}
        <View className="flex-row flex-wrap">
          {cells.map((day, i) => {
            const isToday =
              day && view.y === today.y && view.m === today.m && day === today.d;
            const isPicked = day && draft && draft.y === view.y && draft.m === view.m && draft.d === day;
            return (
              <View key={i} style={{ width: `${100 / 7}%` }} className="py-0.5 items-center">
                {day ? (
                  <Pressable
                    onPress={() => pickDay(day)}
                    className={`w-9 h-9 items-center justify-center rounded-full border ${
                      isPicked
                        ? "bg-primary border-primary"
                        : isToday
                          ? dark
                            ? "border-primary/60"
                            : "border-primary/50"
                          : "border-transparent"
                    }`}
                  >
                    <Text
                      className={`text-sm font-inter ${
                        isPicked
                          ? "text-white font-bold"
                          : isToday
                            ? "text-primary font-semibold"
                            : dark
                              ? "text-white"
                              : "text-text"
                      }`}
                    >
                      {day}
                    </Text>
                  </Pressable>
                ) : (
                  <View className="w-9 h-9" />
                )}
              </View>
            );
          })}
        </View>

        {/* Time */}
        <View className={`mt-4 pt-4 border-t ${dark ? "border-white/10" : "border-border"}`}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className={`text-sm font-medium font-inter ${dark ? "text-white" : "text-text"}`}>Time</Text>
            <Pressable onPress={setNow}>
              <Text className="text-xs font-semibold text-primary font-inter">Now</Text>
            </Pressable>
          </View>
          <View className="flex-row items-center gap-3">
            {stepButton("−", () => bump("hour", -1))}
            <View className="items-center" style={{ minWidth: 44 }}>
              <Text className={`text-lg font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                {pad((draft || todayParts()).hh)}
              </Text>
              <Text className={`text-[10px] font-inter ${dark ? "text-white/40" : "text-text-muted"}`}>HOUR</Text>
            </View>
            {stepButton("+", () => bump("hour", 1))}
            <Text className={`text-lg font-bold ${dark ? "text-white/30" : "text-text-muted"}`}>:</Text>
            {stepButton("−", () => bump("minute", -5))}
            <View className="items-center" style={{ minWidth: 44 }}>
              <Text className={`text-lg font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                {pad((draft || todayParts()).mm)}
              </Text>
              <Text className={`text-[10px] font-inter ${dark ? "text-white/40" : "text-text-muted"}`}>MIN</Text>
            </View>
            {stepButton("+", () => bump("minute", 5))}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
