// src/components/PaginationBar.jsx
// Prev / "Page X of Y" / Next — client-side pagination for the alerts and
// notifications feeds (review: "add a pagination in the alerts and
// notification pages").
//
// Both feeds load their history up front (tab counts + mark-all need the
// full list), so paging is a pure slice of what is already in Redux — no
// extra network round-trips, works offline with the live/poll updates too.
//
// Returns null when everything fits on one page, so callers can render it
// unconditionally. `className` lets each screen align it with its own card
// padding (the notifications list card is edge-to-edge, alerts keeps p-4 →
// pass "-mx-4 -mb-4" there).

import { View, Text } from "react-native";
import Button from "./Button";
import { useDark } from "../hooks/useDark";

export default function PaginationBar({ page, totalPages, onPageChange, className = "" }) {
  const dark = useDark();
  const total = Math.max(1, totalPages || 1);
  if (total <= 1) return null;
  const current = Math.min(Math.max(0, page || 0), total - 1);

  return (
    <View
      className={`flex-row items-center justify-between gap-2 px-4 py-3 border-t ${
        dark ? "border-white/10" : "border-border"
      } ${className}`}
    >
      <Button
        title="‹ Prev"
        variant="outline"
        size="sm"
        disabled={current <= 0}
        onPress={() => onPageChange?.(current - 1)}
      />
      <Text
        className={`text-xs font-inter font-semibold ${
          dark ? "text-white/70" : "text-text-muted"
        }`}
      >
        {`Page ${current + 1} of ${total}`}
      </Text>
      <Button
        title="Next ›"
        variant="outline"
        size="sm"
        disabled={current >= total - 1}
        onPress={() => onPageChange?.(current + 1)}
      />
    </View>
  );
}
