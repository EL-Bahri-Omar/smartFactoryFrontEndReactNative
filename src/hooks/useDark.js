// src/hooks/useDark.js
// Reads the Dark Mode preference (settingsSlice, local-only in Sprint 1).
// Dark mode = dark app chrome (TopBar, BottomTabs, background) + light cards,
// so content text stays readable everywhere without restyling every screen.

import { useAppSelector } from "./useAppSelector";

export function useDark() {
  return useAppSelector((s) => s.settings.notifications.darkMode);
}
