// app/(auth)/login.jsx
//
// Login screen — web + mobile, same file.
// Web:    factory background + centered white card (~420px)
// Mobile: dark full-bleed background + centered logo + inline form fields
//
// Dispatches loginThunk → authService.login → lib/axios.
// Never calls axios directly. On success navigates to /(app)/dashboard.

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { loginThunk } from "../../src/store/slices/authSlice";
import { homeRouteFor } from "../../src/hooks/useRole";
import Button from "../../src/components/Button";

const factoryBg = require("../../assets/images/factory-bg.jpg");

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const justVerified = routeParams.verified === "1" || routeParams.verified === 1;
  const justReset = routeParams.reset === "1" || routeParams.reset === 1;
  const successMessage = justReset
    ? "Password updated. Please sign in."
    : justVerified
      ? "Account verified. Please sign in."
      : null;
  const breakpoint = useBreakpoint();
  const { status, error } = useAppSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const isDesktop = breakpoint === "desktop" || breakpoint === "tablet";
  const isLoading = status === "loading";

  const errorMessage =
    error?.message || (status === "error" ? "Invalid credentials. Please try again." : null);
  // Backend codes: INVALID_CREDENTIALS (401), USER_INACTIVE (401),
  // EMAIL_NOT_VERIFIED (403) — offer a shortcut to the verify screen.
  const isNotVerified = error?.code === "EMAIL_NOT_VERIFIED";

  async function handleLogin() {
    if (!email.trim() || !password.trim()) return;
    try {
      const data = await dispatch(loginThunk({ email: email.trim(), password })).unwrap();
      router.replace(homeRouteFor(data?.user?.role));
    } catch {
      // Error handled via slice state
    }
  }

  // ── WEB LAYOUT (compact card fits 100vh; cover photo + navy page fallback) ──
  if (isDesktop) {
    return (
      <ImageBackground
        source={factoryBg}
        style={{ width: "100%", minHeight: "100vh", backgroundColor: "#0B1D3A" }}
        resizeMode="cover"
      >
        <View
          className="px-4"
          style={{ backgroundColor: "rgba(11,29,58,0.72)", width: "100%", minHeight: "100vh", paddingHorizontal: 16, paddingVertical: 16, alignItems: "center", justifyContent: "center" }}
        >
          <ScrollView
            style={{ width: "100%" }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", width: "100%" }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <View
            className="bg-white w-full p-6"
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 32,
              elevation: 10,
            }}
          >
            {/* Logo */}
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-xl bg-primary items-center justify-center mb-2">
                <Text className="text-white text-xl font-bold">⚙</Text>
              </View>
              <Text className="text-lg font-bold text-text font-inter">SmartFactory</Text>
              <Text className="text-xs text-text-muted font-inter">Industrial Intelligence</Text>
            </View>

            <Text className="text-xl font-bold text-text font-inter text-center mb-1">
              Welcome Back
            </Text>
            <Text className="text-sm text-text-muted font-inter text-center mb-4">
              Sign in to your account
            </Text>

            {/* Verified toast */}
            {successMessage && !errorMessage && (
              <View className="rounded-btn px-3 py-2.5 mb-4" style={{ backgroundColor: "rgba(22,163,74,0.1)", borderWidth: 1, borderColor: "rgba(22,163,74,0.3)" }}>
                <Text className="text-sm font-inter text-center" style={{ color: "#16A34A" }}>{successMessage}</Text>
              </View>
            )}

            {/* Error */}
            {errorMessage && (
              <View className="bg-danger/10 rounded-btn px-3 py-2.5 mb-4" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
                <Text className="text-sm text-danger font-inter text-center">{errorMessage}</Text>
                {isNotVerified && (
                  <Pressable onPress={() => router.push(`/(auth)/verify-account?email=${encodeURIComponent(email.trim())}`)} className="mt-1">
                    <Text className="text-sm text-primary font-medium font-inter text-center">Verify your email</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Email field */}
            <View className="mb-3">
              <Text className="text-sm font-medium text-text font-inter mb-1.5">Email address</Text>
              <View className={`flex-row items-center border rounded-btn px-3 py-2 bg-white ${emailFocused ? "border-primary" : "border-border"}`}>
                <TextInput
                  className="flex-1 text-sm text-text font-inter"
                  placeholder="name@company.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={{ outlineStyle: "none" }}
                />
              </View>
            </View>

            {/* Password field */}
            <View className="mb-3">
              <Text className="text-sm font-medium text-text font-inter mb-1.5">Password</Text>
              <View className={`flex-row items-center border rounded-btn px-3 py-2 bg-white ${passwordFocused ? "border-primary" : "border-border"}`}>
                <TextInput
                  className="flex-1 text-sm text-text font-inter"
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onSubmitEditing={handleLogin}
                  style={{ outlineStyle: "none" }}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} className="pl-2">
                  <Text className="text-xs text-text-muted font-semibold font-inter">
                    {showPassword ? "HIDE" : "SHOW"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Remember + Forgot */}
            <View className="flex-row items-center justify-between mb-4">
              <Pressable onPress={() => setRemember(!remember)} className="flex-row items-center gap-2">
                <View className={`w-4.5 h-4.5 rounded border-2 items-center justify-center ${remember ? "bg-primary border-primary" : "bg-white border-border"}`}
                  style={{ width: 18, height: 18 }}
                >
                  {remember && <Text className="text-white text-[10px] font-bold">✓</Text>}
                </View>
                <Text className="text-sm text-text font-inter">Remember me</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                <Text className="text-sm text-primary font-medium font-inter">Forgot password?</Text>
              </Pressable>
            </View>

            {/* Sign In */}
            <Button
              title="Sign In"
              variant="primary"
              onPress={handleLogin}
              loading={isLoading}
              disabled={!email.trim() || !password.trim()}
              className="w-full mb-4"
            />

            {/* Divider */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-border" />
              <Text className="text-xs text-text-muted mx-3 font-inter">or continue with</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            {/* SSO (disabled) */}
            <View className="flex-row gap-3 mb-3">
              <Pressable className="flex-1 flex-row items-center justify-center gap-2 border border-border rounded-btn py-2.5 bg-bg opacity-50" disabled>
                <Text className="text-lg">G</Text>
                <Text className="text-sm font-medium text-text font-inter">Google</Text>
              </Pressable>
              <Pressable className="flex-1 flex-row items-center justify-center gap-2 border border-border rounded-btn py-2.5 bg-bg opacity-50" disabled>
                <Text className="text-lg">M</Text>
                <Text className="text-sm font-medium text-text font-inter">Microsoft</Text>
              </Pressable>
            </View>
            <Text className="text-[10px] text-text-muted text-center font-inter mb-3">
              SSO coming soon — not in current scope
            </Text>

            {/* Footer */}
            <Text className="text-sm text-text-muted font-inter text-center">
              Don&apos;t have an account?{" "}
              <Text className="text-primary font-medium" onPress={() => router.push("/(auth)/register")}>Sign Up</Text>
            </Text>
          </View>
          </ScrollView>
        </View>
      </ImageBackground>
    );
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        className="flex-1 bg-sidebar"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="flex-1 px-6 pt-16 pb-10 justify-between"
          style={{ minHeight: "100vh" }}
        >
          {/* Top: Logo + tagline */}
          <View className="items-center pt-6">
            <View className="w-16 h-16 rounded-xl bg-primary items-center justify-center mb-4">
              <Text className="text-white text-3xl font-bold">⚙</Text>
            </View>
            <Text className="text-2xl font-bold text-white font-inter mb-1">
              SmartFactory
            </Text>
            <Text className="text-sm text-sidebar-text font-inter mb-4">
              Industrial Intelligence
            </Text>
            <Text className="text-base text-white/70 font-inter text-center leading-6">
              Smarter factories.{"\n"}Safer tomorrow.
            </Text>
          </View>

          {/* Form */}
          <View className="mt-8 mb-4">
            {successMessage && !errorMessage && (
              <View className="rounded-btn px-3 py-2.5 mb-4" style={{ backgroundColor: "rgba(22,163,74,0.15)", borderWidth: 1, borderColor: "rgba(22,163,74,0.35)" }}>
                <Text className="text-sm text-white font-inter text-center">{successMessage}</Text>
              </View>
            )}
            {errorMessage && (
              <View
                className="rounded-btn px-3 py-2.5 mb-4"
                style={{
                  backgroundColor: "rgba(220,38,38,0.15)",
                  borderWidth: 1,
                  borderColor: "rgba(220,38,38,0.3)",
                }}
              >
                <Text className="text-sm text-white font-inter text-center">
                  {errorMessage}
                </Text>
                {isNotVerified && (
                  <Pressable onPress={() => router.push(`/(auth)/verify-account?email=${encodeURIComponent(email.trim())}`)} className="mt-1">
                    <Text className="text-sm text-primary font-medium font-inter text-center">Verify your email</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Email */}
            <View className="mb-3">
              <Text className="text-sm font-medium text-white/90 font-inter mb-1.5">
                Email
              </Text>
              <View
                className={`flex-row items-center rounded-btn px-3 py-2.5 ${emailFocused ? "border-primary" : "border-white/20"}`}
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: emailFocused
                    ? "#2563EB"
                    : "rgba(255,255,255,0.15)",
                }}
              >
                <TextInput
                  className="flex-1 text-sm text-white font-inter"
                  placeholder="name@company.com"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={{ outlineStyle: "none" }}
                />
              </View>
            </View>

            {/* Password */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-white/90 font-inter mb-1.5">
                Password
              </Text>
              <View
                className="flex-row items-center rounded-btn px-3 py-2.5"
                style={{
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: passwordFocused
                    ? "#2563EB"
                    : "rgba(255,255,255,0.15)",
                }}
              >
                <TextInput
                  className="flex-1 text-sm text-white font-inter"
                  placeholder="••••••••"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onSubmitEditing={handleLogin}
                  style={{ outlineStyle: "none" }}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  className="pl-2"
                >
                  <Text className="text-xs text-white/50 font-semibold font-inter">
                    {showPassword ? "HIDE" : "SHOW"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Remember + Forgot */}
            <View className="flex-row items-center justify-between mb-2">
              <Pressable
                onPress={() => setRemember(!remember)}
                className="flex-row items-center gap-2"
              >
                <View
                  className={`rounded border-2 items-center justify-center ${remember ? "bg-primary border-primary" : "border-white/30"}`}
                  style={{ width: 18, height: 18 }}
                >
                  {remember && (
                    <Text className="text-white text-[10px] font-bold">✓</Text>
                  )}
                </View>
                <Text className="text-sm text-white/70 font-inter">
                  Remember me
                </Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
                <Text className="text-sm text-primary font-medium font-inter">
                  Forgot password?
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Bottom */}
          <View>
            <Button
              title="Sign In"
              variant="primary"
              onPress={handleLogin}
              loading={isLoading}
              disabled={!email.trim() || !password.trim()}
              className="w-full mb-5"
              size="lg"
            />
            <Text className="text-sm text-sidebar-text font-inter text-center">
              Don&apos;t have an account?{" "}
              <Text className="text-primary font-medium" onPress={() => router.push("/(auth)/register")}>Sign Up</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
