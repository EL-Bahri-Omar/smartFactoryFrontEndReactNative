import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { View, ActivityIndicator, AppState } from "react-native";
import { store } from "../src/store";
import { bootstrapAuth } from "../src/store/initAuth";
import { refreshSession } from "../src/store/slices/authSlice";
import { DialogProvider } from "../src/components/dialog/DialogContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

const SESSION_REFRESH_MS = 60000;

function refreshIfAuthenticated() {
  const s = store.getState();
  if (s.auth.status === "authenticated" && s.auth.user) {
    store.dispatch(refreshSession());
  }
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    bootstrapAuth(store.dispatch).finally(() => setIsReady(true));
  }, []);

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
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F8FB" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
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
