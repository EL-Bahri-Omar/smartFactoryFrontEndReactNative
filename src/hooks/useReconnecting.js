// src/hooks/useReconnecting.js
//
// `true` ONLY when the STOMP socket was connected once and has since dropped.
//
// The first connect is normal startup: before it lands, liveSlice.connected is
// simply false. Screens used to translate that straight into a "Reconnecting…"
// badge, so every hard refresh flashed a row of them (review: "a lot of
// reconnecting badges showing"). Real data still comes from REST the whole
// time, so an initial connect is never worth a warning.

import { useAppSelector } from "./useAppSelector";

export function useReconnecting() {
  return useAppSelector((s) => !s.live.connected && s.live.everConnected);
}
