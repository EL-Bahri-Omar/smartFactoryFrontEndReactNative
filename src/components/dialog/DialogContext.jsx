// src/components/dialog/DialogContext.jsx
//
// In-app centered dialog system. Replaces window.alert / Alert.alert /
// window.confirm everywhere: success notices, errors and destructive
// confirmations all render as a designed modal in the middle of the app.
//
// Usage:
//   const dialog = useDialog();
//   await dialog.alert("Success", "Profile updated.");
//   const ok = await dialog.confirm("Delete machine", "Remove CNC-024?", { danger: true });
//   const ok = await dialog.confirm("Log Out", "Are you sure?", { confirmText: "Log Out" });
//
// Mounted once in app/_layout.jsx inside the Redux provider.

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { View, Text, Pressable, Modal, ActivityIndicator } from "react-native";
import Button from "../Button";

const DialogContext = createContext({
  alert: async () => {},
  confirm: async () => false,
});

export const useDialog = () => useContext(DialogContext);

let dialogId = 0;

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const close = useCallback((value) => {
    setDialog(null);
    if (resolver.current) {
      resolver.current(value);
      resolver.current = null;
    }
  }, []);

  const alert = useCallback(
    (title, message, variant = "info") =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setDialog({
          id: ++dialogId,
          title,
          message,
          variant,
          buttons: [{ text: "OK", primary: true, value: true }],
        });
      }),
    []
  );

  const confirm = useCallback(
    (title, message, options = {}) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setDialog({
          id: ++dialogId,
          title,
          message,
          variant: options.danger ? "danger" : "confirm",
          buttons: [
            { text: options.cancelText || "Cancel", ghost: true, value: false },
            { text: options.confirmText || "Confirm", primary: true, danger: !!options.danger, value: true },
          ],
        });
      }),
    []
  );

  const icons = {
    info: { bg: "#DBEAFE", glyph: "ℹ️" },
    success: { bg: "rgba(22,163,74,0.12)", glyph: "✓" },
    danger: { bg: "rgba(220,38,38,0.12)", glyph: "⚠️" },
    confirm: { bg: "#DBEAFE", glyph: "❓" },
  };
  const icon = icons[dialog?.variant] || icons.info;

  return (
    <DialogContext.Provider value={{ alert, confirm }}>
      {children}
      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => close(false)}>
        <Pressable
          onPress={() => close(dialog?.buttons?.length === 1 ? true : false)}
          style={{ flex: 1, backgroundColor: "rgba(11,29,58,0.55)", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <Pressable
            onPress={() => {}}
            className="bg-white w-full p-6 items-center"
            style={{ maxWidth: 380, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 40, elevation: 12 }}
          >
            <View
              className="w-12 h-12 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: icon.bg }}
            >
              <Text style={{ fontSize: 22, color: dialog?.variant === "success" ? "#16A34A" : dialog?.variant === "danger" ? "#DC2626" : "#2563EB" }}>
                {icon.glyph}
              </Text>
            </View>
            {!!dialog?.title && (
              <Text className="text-lg font-bold text-text font-inter text-center mb-1">{dialog.title}</Text>
            )}
            {!!dialog?.message && (
              <Text className="text-sm text-text-muted font-inter text-center mb-5 leading-5">{dialog.message}</Text>
            )}
            <View className="flex-row gap-3 w-full justify-center">
              {(dialog?.buttons || []).map((b) => (
                <Button
                  key={b.text}
                  title={b.text}
                  variant={b.danger ? "danger" : b.primary ? "primary" : "ghost"}
                  onPress={() => close(b.value)}
                  className="flex-1"
                />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}
