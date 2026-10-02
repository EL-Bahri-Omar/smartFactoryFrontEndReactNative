// src/components/AppShell.jsx
// Wraps a screen. Desktop: Sidebar + TopBar.
// Smaller screens: TopBar (+ BottomTabs on mobile) with the Sidebar
// available as an overlay drawer via the hamburger button.
// Uses useBreakpoint() for responsive switching. Dark mode flips the
// background; cards stay light so content text remains readable.

import { useState } from "react";
import { View, Pressable } from "react-native";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useAppSelector } from "../hooks/useAppSelector";
import { useDark } from "../hooks/useDark";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomTabs from "./BottomTabs";

export default function AppShell({ children }) {
  const breakpoint = useBreakpoint();
  const user = useAppSelector((state) => state.auth.user);
  const dark = useDark();
  const [navOpen, setNavOpen] = useState(false);
  const isDesktop = breakpoint === "desktop";
  const isMobile = breakpoint === "mobile";

  return (
    <View className={`flex-1 flex-row ${dark ? "bg-[#060F24]" : "bg-bg"}`} style={{ minHeight: "100vh" }}>
      {/* Desktop sidebar */}
      {isDesktop && <Sidebar user={user} />}

      {/* Main content area */}
      <View className="flex-1 flex-col">
        <TopBar user={user} showMenu={!isDesktop} onMenuPress={() => setNavOpen(true)} />

        {/* Scrollable content */}
        <View className="flex-1 p-4">
          {children}
        </View>

        {/* Mobile bottom tabs */}
        {isMobile && <BottomTabs />}
      </View>

      {/* Drawer sidebar for tablet/mobile */}
      {!isDesktop && navOpen && (
        <View className="absolute inset-0 flex-row" style={{ zIndex: 50 }}>
          <Sidebar user={user} onNavigate={() => setNavOpen(false)} />
          <Pressable className="flex-1 bg-black/50" onPress={() => setNavOpen(false)} />
        </View>
      )}
    </View>
  );
}
