// src/store/services/liveService.js
//
// STOMP over WebSocket wrapper. Nothing outside this file imports @stomp/stompjs.
// Screens use the useLiveTopic hook which reads from liveSlice.
//
// To avoid circular imports, this service receives `dispatch` via configure().
// store/index.js calls configure({ dispatch: store.dispatch }) once at startup.
//
// Reconnect model (why live updates used to need an app refresh):
//  - STOMP tears down every subscription when the WebSocket drops, and the
//    client auto-reconnects on its own (reconnectDelay). Components that were
//    mounted the whole time never re-run their subscribe effect, so the feed
//    silently died until a reload.
//  - Now every wanted destination lives in a REGISTRY below. onConnect
//    (initial connect AND every reconnect) re-attaches all of them, and
//    onWebSocketClose / onStompError flip liveSlice.connected to false so the
//    UI shows "offline" instead of pretending to be live.
//  - subscribe() never throws: registering a destination while the socket is
//    down simply waits for the next connect (then auto-attaches).

import { Client } from "@stomp/stompjs";
import { WS_URL } from "../../constants/api";

let stompClient = null;
let dispatchFn = null;
let liveSliceActions = null;

// Registry of wanted subscriptions: { destination, handler, stompSub }.
// Survives reconnects; stompSub is nulled whenever the connection dies.
const registry = new Set();

/**
 * Set up the dispatch function and slice actions.
 * Called once from store/index.js after store creation.
 */
export function configure({ dispatch, actions }) {
  dispatchFn = dispatch;
  liveSliceActions = actions;
}

function setConnected(value) {
  if (dispatchFn && liveSliceActions) {
    dispatchFn(liveSliceActions.setConnected(value));
  }
}

function isConnected() {
  // `connected` is true only between the STOMP CONNECTED and DISCONNECTED
  // frames — unlike `active`, it is false while the socket is down/retrying.
  return !!stompClient?.connected;
}

/** Parse + push one incoming frame to Redux (and the optional handler). */
function deliver(entry, rawBody) {
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = rawBody;
  }
  if (dispatchFn && liveSliceActions) {
    dispatchFn(liveSliceActions.pushMessage({ topic: entry.destination, payload }));
  }
  if (entry.handler) entry.handler(payload);
}

/** Create the real STOMP subscription for one registry entry (idempotent). */
function attach(entry) {
  if (entry.stompSub || !isConnected()) return;
  try {
    entry.stompSub = stompClient.subscribe(entry.destination, (message) =>
      deliver(entry, message.body)
    );
  } catch (error) {
    entry.stompSub = null;
    console.warn("[liveService] subscribe failed", entry.destination, error);
  }
}

/** Drop the STOMP handle for one entry (connection is going away). */
function detach(entry) {
  if (!entry.stompSub) return;
  const sub = entry.stompSub;
  entry.stompSub = null;
  try {
    sub.unsubscribe();
  } catch {
    // Socket already gone — the broker-side subscription dies with it.
  }
}

function attachAll() {
  registry.forEach(attach);
}

function detachAll() {
  registry.forEach(detach);
}

/**
 * Connect to the WebSocket/STOMP endpoint.
 */
export function connect() {
  if (!WS_URL) {
    console.warn("[liveService] WS_URL is not set — skipping WebSocket connection.");
    return;
  }

  if (stompClient?.active) return; // already activated (auto-reconnecting)

  stompClient = new Client({
    brokerURL: WS_URL.replace(/^http/, "ws"),
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,

    onConnect: () => {
      setConnected(true);
      attachAll(); // (re)subscribe everything the app cares about
    },

    onDisconnect: () => {
      setConnected(false);
      detachAll();
    },

    // The socket died (sleep, network blip, server restart): mark offline NOW
    // and drop the dead handles — the STOMP client retries by itself and
    // onConnect will re-attach the registry.
    onWebSocketClose: () => {
      setConnected(false);
      detachAll();
    },

    onWebSocketError: () => {
      setConnected(false);
    },

    onStompError: (frame) => {
      console.warn("[liveService] broker error", frame.headers?.message);
      setConnected(false);
      detachAll();
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
  stompClient = null;
  detachAll();
  setConnected(false);
}

/**
 * Subscribe to a STOMP destination.
 * Safe to call before/during a connection: the destination is registered and
 * attached as soon as the socket is up (including after a reconnect).
 * @param {string} destination  e.g. "/topic/machines/CNC-024/readings"
 * @param {Function} [handler]  optional extra callback (in addition to pushing to Redux)
 * @returns {Function} unsubscribe function
 */
export function subscribe(destination, handler) {
  const entry = { destination, handler, stompSub: null };
  registry.add(entry);
  attach(entry);

  return () => {
    registry.delete(entry);
    detach(entry);
  };
}
