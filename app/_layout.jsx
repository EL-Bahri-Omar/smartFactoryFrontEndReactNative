import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { View, ActivityIndicator } from "react-native";
import { store } from "../src/store";
import { bootstrapAuth } from "../src/store/initAuth";
import { DialogProvider } from "../src/components/dialog/DialogContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    bootstrapAuth(store.dispatch).finally(() => setIsReady(true));
  }, []);

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
