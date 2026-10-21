import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { AppState } from "react-native";
import { store } from "../src/store";
import { bootstrapAuth } from "../src/store/initAuth";
import { refreshSession } from "../src/store/slices/authSlice";
import {
  initPush,
  handleNotificationResponse,
  getLastNotificationResponseSafe,
} from "../src/store/services/pushService";
import { DialogProvider } from "../src/components/dialog/DialogContext";
import BootSplash from "../src/components/BootSplash";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { router } from "expo-router";

const SESSION_REFRESH_MS = 60000;

function refreshIfAuthenticated() {
  const s = store.getState();
  if (s.auth.status === "authenticated" && s.auth.user) {
    store.dispatch(refreshSession());
  }
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  // Auth flip (login/logout) re-triggers push token registration.
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    bootstrapAuth(store.dispatch).finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    const read = () => {
      const s = store.getState();
      setAuthed(s.auth.status === "authenticated" && !!s.auth.user);
    };
    read();
    return store.subscribe(read);
  }, []);

  // Push notifications (native only — items 11 + 12):
  //  - register the device token so the backend can FCM-push notifications
  //    while the app is closed (alerts themselves stay in-app / STOMP);
  //  - a tap marks the notification read and navigates to its screen.
  // No-op on web (guarded inside initPush).
  useEffect(() => {
    if (!isReady || !authed) return undefined;
    let cancelled = false;
    initPush({ dispatch: store.dispatch, router, isAuthenticated: true }).catch(() => {});
    // Cold start: handle the notification the user tapped to launch the app.
    (async () => {
      try {
        const last = await getLastNotificationResponseSafe();
        if (!cancelled && last) handleNotificationResponse(store.dispatch, router, last);
      } catch {
        /* no push module (web) / no pending response */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady, authed]);

  // Keep the session (role / permissions / status) fresh without reloads:
  // poll every minute + refresh whenever the app comes to the foreground
  // (mobile app switch, browser tab focus). Silent — failures change nothing.
  useEffect(() => {
    if (!isReady) return;
    refreshIfAuthenticated();
    const id = setInterval(refreshIfAuthenticated, SESSION_REFRESH_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshIfAuthenticated();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [isReady]);

  if (!isReady) {
    return <BootSplash />;
  }

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <DialogProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </DialogProvider>
      </SafeAreaProvider>
    </Provider>
  );
}
