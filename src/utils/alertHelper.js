// src/utils/alertHelper.js
// Thin wrapper around Alert.alert (native) / window.alert + window.confirm (web).
// Same signature on both platforms.

import { Platform, Alert } from "react-native";

/**
 * Show an alert dialog.
 * @param {string} title
 * @param {string} message
 * @param {Array<{text: string, onPress?: Function, style?: string}>} [buttons]
 */
export function showAlert(title, message, buttons) {
  if (Platform.OS === "web") {
    if (!buttons || buttons.length <= 1) {
      window.alert(`${title}\n\n${message}`);
      if (buttons?.[0]?.onPress) buttons[0].onPress();
    } else {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed && buttons[1]?.onPress) {
        buttons[1].onPress();
      } else if (!confirmed && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    }
    return;
  }
  Alert.alert(title, message, buttons);
}

/**
 * Show a confirmation dialog. Returns a promise that resolves to true/false.
 * @param {string} title
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function confirmAlert(title, message) {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", onPress: () => resolve(false), style: "cancel" },
      { text: "OK", onPress: () => resolve(true) },
    ]);
  });
}
