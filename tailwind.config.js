/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#F6F8FB",
        surface: "#FFFFFF",
        sidebar: "#0B1D3A",
        "sidebar-text": "#C7D2E1",
        "sidebar-active": "#1E3A8A",
        primary: "#2563EB",
        "primary-soft": "#DBEAFE",
        "accent-teal": "#0EA5A4",
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
        idle: "#FACC15",
        offline: "#94A3B8",
        text: "#0F172A",
        "text-muted": "#64748B",
        border: "#E2E8F0",
      },
      fontFamily: {
        inter: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        btn: "8px",
        chip: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.06)",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        base: "16px",
        lg: "24px",
        xl: "32px",
      },
    },
  },
  plugins: [],
};
