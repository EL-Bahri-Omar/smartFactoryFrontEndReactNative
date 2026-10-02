// src/constants/colors.js
// Design tokens — extracted from docs/ui/ui-notes.md "Global design tokens".
// Single source of truth. Components read from here, never hardcode hex values.

export const COLORS = Object.freeze({
  bg: "#F6F8FB", // App background
  surface: "#FFFFFF", // Cards, panels
  sidebar: "#0B1D3A", // Left nav (web)
  sidebarText: "#C7D2E1", // Sidebar inactive text
  sidebarActive: "#1E3A8A", // Sidebar active pill
  primary: "#2563EB", // Primary buttons, links, active tab
  primarySoft: "#DBEAFE", // Badge/chip background
  accentTeal: "#0EA5A4", // Health score ring, positive trend
  success: "#16A34A", // Running status, positive delta
  warning: "#F59E0B", // Warning severity, Maintenance status
  danger: "#DC2626", // High severity, Failure status
  idle: "#FACC15", // Idle status
  offline: "#94A3B8", // Offline status, muted text
  text: "#0F172A", // Primary text
  textMuted: "#64748B", // Secondary text
  border: "#E2E8F0", // Card borders, dividers
  chartTemp: "#EA580C", // Temperature series (orange/red)
  chartVibration: "#7C3AED", // Vibration series (purple)
  chartCurrent: "#2563EB", // Current series (blue)
  chartRpm: "#0EA5A4", // RPM series (teal)
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
});

export const SPACING = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
});

export const RADIUS = Object.freeze({
  card: 12,
  button: 8,
  chip: 9999,
  input: 8,
});

export const SHADOW = Object.freeze({
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
});

export const FONT = Object.freeze({
  family: "Inter",
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
});

export const BREAKPOINT = Object.freeze({
  mobile: 0,
  tablet: 768,
  desktop: 1024,
});
