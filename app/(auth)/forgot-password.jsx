// app/(auth)/forgot-password.jsx
//
// Forgot Password screen — web + mobile, same file. Visually mirrors
// login.jsx / register.jsx / verify-account.jsx:
// Web: factory photo background + dark overlay + centered white card (~420px, radius 16).
// Mobile: full-bleed dark background + inline fields (same choice as Login mobile).
//
// Security: do NOT reveal whether the email exists. The backend always returns 200
// regardless of whether the email is registered, and this screen always shows the
// same success path (navigate to reset-password-verify) on fulfilled. Only genuine
// network/server failures surface as errors — never "email not found".
//
// Dispatches forgotPasswordThunk → authService.forgotPassword → lib/axios.
// Never calls axios directly. No token stored.

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
import { useRouter } from "expo-router";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { forgotPasswordThunk } from "../../src/store/slices/authSlice";
import Button from "../../src/components/Button";

const factoryBg = require("../../assets/images/factory-bg.jpg");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const { forgotStatus, forgotError } = useAppSelector((s) => s.auth);

  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);

  const isDesktop = breakpoint === "desktop" || breakpoint === "tablet";
  const isLoading = forgotStatus === "loading";

  const trimmed = email.trim();
  const fieldError = touched
    ? !trimmed
      ? "Email is required."
      : !EMAIL_RE.test(trimmed)
        ? "Enter a valid email address."
        : null
    : null;

  const serverMessage =
    forgotError?.message || (forgotStatus === "error" ? "Request failed. Please check your connection and try again." : null);

  async function handleSubmit() {
    setTouched(true);
    if (!trimmed || !EMAIL_RE.test(trimmed)) return;
    try {
      // Always navigates on fulfilled — even for unknown emails the backend
      // returns 200, so reaching here reveals nothing about email existence.
      await dispatch(forgotPasswordThunk({ email: trimmed })).unwrap();
      router.replace(`/(auth)/reset-password-verify?email=${encodeURIComponent(trimmed)}`);
    } catch {
      // Genuine network/server failure only — surfaced via slice state.
    }
  }

  function Form({ dark }) {
    return (
      <View>
        <Text className={`text-2xl font-bold font-inter text-center mb-1 ${dark ? "text-white" : "text-text"}`}>
          Forgot your password?
        </Text>
        <Text className={`text-sm font-inter text-center mb-6 ${dark ? "text-sidebar-text" : "text-text-muted"}`}>
          Enter your email and we&apos;ll send you a code to reset it.
        </Text>

        {serverMessage && (
          <View
            className="rounded-btn px-3 py-2.5 mb-4"
            style={
              dark
                ? { backgroundColor: "rgba(220,38,38,0.15)", borderWidth: 1, borderColor: "rgba(220,38,38,0.3)" }
                : { backgroundColor: "rgba(220,38,38,0.08)", borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }
            }
          >
            <Text className={`text-sm font-inter text-center ${dark ? "text-white" : "text-danger"}`}>{serverMessage}</Text>
          </View>
        )}

        <View className="mb-4">
          <Text className={`text-sm font-medium font-inter mb-1.5 ${dark ? "text-white/90" : "text-text"}`}>Email address</Text>
          <View
            className={`flex-row items-center rounded-btn px-3 py-2.5 ${dark ? "" : `border ${focused ? "border-primary" : "border-border"} bg-white`}`}
            style={
              dark
                ? { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: focused ? "#2563EB" : "rgba(255,255,255,0.15)" }
                : null
            }
          >
            <TextInput
              className={`flex-1 text-sm font-inter ${dark ? "text-white" : "text-text"}`}
              placeholder="name@company.com"
              placeholderTextColor={dark ? "rgba(255,255,255,0.35)" : "#94A3B8"}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!isLoading}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={handleSubmit}
              style={{ outlineStyle: "none" }}
            />
          </View>
          {fieldError && (
            <Text className={`text-xs font-inter mt-1 ${dark ? "text-red-300" : "text-danger"}`}>{fieldError}</Text>
          )}
        </View>

        <Button
          title="Send reset code"
          variant="primary"
          onPress={handleSubmit}
          loading={isLoading}
          disabled={isLoading}
          className="w-full mb-4"
          size={dark ? "lg" : "md"}
        />

        <Pressable onPress={() => router.push("/(auth)/login")}>
          <Text className={`text-sm font-inter text-center ${dark ? "text-sidebar-text" : "text-text-muted"}`}>
            <Text className="text-primary font-medium">Back to sign in</Text>
          </Text>
        </Pressable>
      </View>
    );
  }

  // ── WEB ─────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <ImageBackground
        source={factoryBg}
        style={{ width: "100%", minHeight: "100vh", backgroundColor: "#0B1D3A" }}
        resizeMode="cover"
      >
        <View className="px-4" style={{ backgroundColor: "rgba(11,29,58,0.72)", width: "100%", minHeight: "100vh", paddingHorizontal: 16, paddingVertical: 24, alignItems: "center", justifyContent: "center" }}>
          <ScrollView style={{ width: "100%" }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", width: "100%" }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="bg-white w-full p-8" style={{ width: "100%", maxWidth: 420, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 32, elevation: 10 }}>
              <View className="items-center mb-6">
                <View className="w-14 h-14 rounded-xl bg-primary items-center justify-center mb-3">
                  <Text className="text-white text-2xl font-bold">⚙</Text>
                </View>
                <Text className="text-xl font-bold text-text font-inter">SmartFactory</Text>
                <Text className="text-xs text-text-muted font-inter">Industrial Intelligence</Text>
              </View>
              {Form({ dark: false })}
            </View>
          </ScrollView>
        </View>
      </ImageBackground>
    );
  }

  // ── MOBILE (same full-bleed choice as Login) ────────────────────
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
      <ScrollView className="flex-1 bg-sidebar" contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 px-6 pt-16 pb-10 justify-between" style={{ minHeight: "100vh" }}>
          <View>
            <View className="items-center pt-6 mb-6">
              <View className="w-16 h-16 rounded-xl bg-primary items-center justify-center mb-4">
                <Text className="text-white text-3xl font-bold">⚙</Text>
              </View>
              <Text className="text-2xl font-bold text-white font-inter mb-1">SmartFactory</Text>
              <Text className="text-sm text-sidebar-text font-inter">Industrial Intelligence</Text>
            </View>
            {Form({ dark: true })}
          </View>
          <View className="mt-6">
            <Text className="text-sm text-sidebar-text font-inter text-center">
              Remembered it?{" "}
              <Text className="text-primary font-medium" onPress={() => router.push("/(auth)/login")}>Sign in</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
