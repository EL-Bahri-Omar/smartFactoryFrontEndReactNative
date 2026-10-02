// src/hooks/useBreakpoint.js
// Returns 'mobile' | 'tablet' | 'desktop' using window dimensions.
// Thresholds from docs/ui/ui-notes.md: mobile <768, tablet 768–1023, desktop >=1024.

import { useWindowDimensions } from "react-native";
import { BREAKPOINT } from "../constants/colors";

export function useBreakpoint() {
  const { width } = useWindowDimensions();

  if (width >= BREAKPOINT.desktop) return "desktop";
  if (width >= BREAKPOINT.tablet) return "tablet";
  return "mobile";
}
