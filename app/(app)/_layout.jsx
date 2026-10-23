// app/(app)/_layout.jsx
//
// Navigation group layout. Besides the <Slot /> it hosts NotificationBridge,
// mounted ONCE for the whole authenticated app and kept alive across screen
// changes, so live notifications reach Redux everywhere:
//   - /topic/users/{id}/notifications  -> receiveNotification (list upsert)
//     + refreshUnreadCount (badge truth)
//   - /topic/users/{id}/unread-count   -> setServerUnread (exact badge count)
// Screens no longer depend on their own mount/unmount to see new rows, and
// the TopBar badge updates the moment a notification is created.

import { useEffect, useRef } from "react";
import { Slot } from "expo-router";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { useLiveTopic } from "../../src/hooks/useLiveTopic";
import {
  receiveNotification,
  refreshUnreadCount,
  setServerUnread,
  pollNotifications,
} from "../../src/store/slices/notificationSlice";

function NotificationBridge() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user?.id);

  const notifyTopic = userId ? `/topic/users/${userId}/notifications` : null;
  const unreadTopic = userId ? `/topic/users/${userId}/unread-count` : null;

  // Latest payload per topic — may be a CACHED message from a previous mount
  // (liveSlice keeps only the newest), so dedupe before dispatching.
  const liveRow = useLiveTopic(notifyTopic, { enabled: !!notifyTopic });
  const liveUnread = useLiveTopic(unreadTopic, { enabled: !!unreadTopic });
  const lastRowRef = useRef(null);
  const lastUnreadRef = useRef(null);

  // Badge truth on (re)entry into the app group / user switch.
  useEffect(() => {
    if (userId) dispatch(refreshUnreadCount());
  }, [dispatch, userId]);

  // New notification row: upsert into the list, refresh the badge count.
  useEffect(() => {
    if (!liveRow) return;
    const key = `${liveRow.id ?? liveRow.notificationId ?? ""}-${liveRow.createdAt || ""}`;
    if (!key || lastRowRef.current === key) return;
    lastRowRef.current = key;
    dispatch(receiveNotification(liveRow));
    dispatch(refreshUnreadCount());
  }, [liveRow, dispatch]);

  // Exact unread count pushed by the backend after each notification.
  useEffect(() => {
    if (liveUnread && liveUnread.unreadCount != null) {
      const count = Number(liveUnread.unreadCount);
      if (!Number.isFinite(count) || lastUnreadRef.current === count) return;
      lastUnreadRef.current = count;
      dispatch(setServerUnread(count));
    }
  }, [liveUnread, dispatch]);

  // Polling safety net: if the WebSocket dies silently (sleeping laptop,
  // backend restart, flaky network), the STOMP bridge alone would leave the
  // user staring at a stale list until a manual refresh. Every 12 s the poll
  // refreshes the badge and merges any row the list has not seen yet — so
  // notifications appear BY THEMSELVES, live or not.
  useEffect(() => {
    if (!userId) return;
    const tick = () => dispatch(pollNotifications());
    tick(); // catch anything that arrived while the app was closed
    const interval = setInterval(tick, 12000);
    return () => clearInterval(interval);
  }, [dispatch, userId]);

  return null;
}

export default function AppLayout() {
  return (
    <>
      <NotificationBridge />
      <Slot />
    </>
  );
}
