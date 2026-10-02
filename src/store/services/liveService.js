// src/store/services/liveService.js
//
// STOMP over WebSocket wrapper. Nothing outside this file imports @stomp/stompjs.
// Screens use the useLiveTopic hook which reads from liveSlice.
//
// To avoid circular imports, this service receives `dispatch` via configure().
// store/index.js calls configure({ dispatch: store.dispatch }) once at startup.

import { Client } from "@stomp/stompjs";
import { WS_URL } from "../../constants/api";

let stompClient = null;
let dispatchFn = null;
let liveSliceActions = null;

/**
 * Set up the dispatch function and slice actions.
 * Called once from store/index.js after store creation.
 */
export function configure({ dispatch, actions }) {
  dispatchFn = dispatch;
  liveSliceActions = actions;
}

/**
 * Connect to the WebSocket/STOMP endpoint.
 */
export function connect() {
  if (!WS_URL) {
    console.warn("[liveService] WS_URL is not set — skipping WebSocket connection.");
    return;
  }

  if (stompClient?.active) return; // already connected

  stompClient = new Client({
    brokerURL: WS_URL.replace(/^http/, "ws"), // http -> ws, https -> wss
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,

    onConnect: () => {
      if (dispatchFn && liveSliceActions) {
        dispatchFn(liveSliceActions.setConnected(true));
      }
    },

    onDisconnect: () => {
      if (dispatchFn && liveSliceActions) {
        dispatchFn(liveSliceActions.setConnected(false));
      }
    },

    onStompError: (frame) => {
      console.error("[liveService] STOMP error:", frame.headers.message);
      if (dispatchFn && liveSliceActions) {
        dispatchFn(liveSliceActions.setConnected(false));
      }
    },
  });

  stompClient.activate();
}

/**
 * Disconnect from the STOMP broker.
 */
export function disconnect() {
  if (stompClient?.active) {
    stompClient.deactivate();
  }
  if (dispatchFn && liveSliceActions) {
    dispatchFn(liveSliceActions.setConnected(false));
  }
}

/**
 * Subscribe to a STOMP destination.
 * @param {string} destination  e.g. "/topic/machines/CNC-024/readings"
 * @param {Function} [handler]  optional extra callback (in addition to pushing to Redux)
 * @returns {Function} unsubscribe function
 */
export function subscribe(destination, handler) {
  if (!stompClient?.active) {
    console.warn("[liveService] Cannot subscribe — not connected.");
    return () => {};
  }

  const subscription = stompClient.subscribe(destination, (message) => {
    let payload;
    try {
      payload = JSON.parse(message.body);
    } catch {
      payload = message.body;
    }

    // Push to Redux
    if (dispatchFn && liveSliceActions) {
      dispatchFn(liveSliceActions.pushMessage({ topic: destination, payload }));
    }

    // Extra handler if provided
    if (handler) handler(payload);
  });

  return () => subscription.unsubscribe();
}
