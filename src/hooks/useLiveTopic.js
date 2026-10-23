// src/hooks/useLiveTopic.js
// Subscribe to a STOMP destination on mount, unsubscribe on unmount.
// Returns the latest message for that destination from liveSlice.
//
// liveService.subscribe() is safe to call before the socket is up (the
// destination is registered and auto-attached on connect, and RE-attached
// after every reconnect), so this effect no longer waits on `connected` —
// subscriptions can never be lost during a connection blip.
// NOTE: the returned message may be a CACHED payload from a previous mount —
// consumers that dispatch on it must dedupe (see NotificationBridge refs).

import { useEffect } from "react";
import { useAppSelector } from "./useAppSelector";
import * as liveService from "../store/services/liveService";

/**
 * @param {string} destination  e.g. "/topic/machines/CNC-024/readings"
 * @param {{ enabled?: boolean }} options
 * @returns {any} latest message payload for this destination (or undefined)
 */
export function useLiveTopic(destination, { enabled = true } = {}) {
  const message = useAppSelector((state) => state.live.messagesByTopic[destination]);

  useEffect(() => {
    if (!enabled || !destination) return;
    liveService.connect();
    const unsubscribe = liveService.subscribe(destination);
    return () => {
      unsubscribe();
    };
  }, [destination, enabled]);

  return message;
}
