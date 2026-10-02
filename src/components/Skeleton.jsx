// src/components/Skeleton.jsx
// Animated loading placeholder.

import { View } from "react-native";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";

export default function Skeleton({ width, height = 16, rounded = false, className = "" }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={`bg-border ${rounded ? "rounded-full" : "rounded-btn"} ${className}`}
      style={{
        width,
        height,
        opacity,
      }}
    />
  );
}
