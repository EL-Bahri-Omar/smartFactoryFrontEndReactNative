// src/hooks/useDark.js
// Reads the Dark Mode preference (settingsSlice, local-only in Sprint 1).
// Dark mode = dark app chrome (TopBar, BottomTabs, background) + smooth slate
// cards (#1E293B) with light text. Every shared component reads this hook.

import { useAppSelector } from "./useAppSelector";

export function useDark() {
  return useAppSelector((s) => s.settings.notifications.darkMode);
}
