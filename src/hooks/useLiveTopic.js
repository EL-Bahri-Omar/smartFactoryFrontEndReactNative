// src/hooks/useLiveTopic.js
// Subscribe to a STOMP destination on mount, unsubscribe on unmount.
// Returns the latest message for that destination from liveSlice.

import { useEffect } from "react";
import { useAppSelector } from "./useAppSelector";
import * as liveService from "../store/services/liveService";

/**
 * @param {string} destination  e.g. "/topic/machines/CNC-024/readings"
 * @param {{ enabled?: boolean }} options
 * @returns {any} latest message payload for this destination (or undefined)
 */
export function useLiveTopic(destination, { enabled = true } = {}) {
  const connected = useAppSelector((state) => state.live.connected);
  const message = useAppSelector((state) => state.live.messagesByTopic[destination]);

  useEffect(() => {
    if (!enabled) return;
    liveService.connect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !connected || !destination) return;

    const unsubscribe = liveService.subscribe(destination);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [destination, enabled, connected]);

  return message;
}
