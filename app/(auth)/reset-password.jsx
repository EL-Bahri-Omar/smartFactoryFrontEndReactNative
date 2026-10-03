// app/(auth)/reset-password.jsx
//
// Reset Password screen — web + mobile, same file. Visually mirrors
// login.jsx / register.jsx / verify-account.jsx:
// Web: factory photo background + dark overlay + centered white card (~420px, radius 16).
// Mobile: full-bleed dark background + inline fields (same choice as Login mobile).
//
// Guard: resetToken lives in Redux only (never persisted). If it is missing
// (reload, expiry, deep link), redirect to /(auth)/forgot-password on mount
// and do not render the form.
//
// Dispatches resetPasswordThunk({ email, resetToken, newPassword }) → authService → lib/axios.
// Never calls axios directly. Success clears resetToken (single use) and
// navigates to /(auth)/login?reset=1.

import { useEffect, useState } from "react";
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
import { resetPasswordThunk } from "../../src/store/slices/authSlice";
import { passwordError } from "../../src/lib/validators";
import Button from "../../src/components/Button";
import EyeIcon from "../../src/components/EyeIcon";

const factoryBg = require("../../assets/images/factory-bg.jpg");

export default function ResetPasswordScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const { resetToken, resetEmail, resetPasswordStatus, resetPasswordError } = useAppSelector((s) => s.auth);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(null);

  const isDesktop = breakpoint === "desktop" || breakpoint === "tablet";
  const isLoading = resetPasswordStatus === "loading";

  // Guard: no token/email (reload/expiry/deep link) → back to forgot-password.
  useEffect(() => {
    if (!resetToken || !resetEmail) {
      router.replace("/(auth)/forgot-password");
    }
  }, [resetToken, resetEmail, router]);

  const passwordErr = touched ? passwordError(password) : null;
  const confirmErr = touched
    ? !confirmPassword
      ? "Please confirm your new password."
      : confirmPassword !== password
        ? "Passwords do not match."
        : null
    : null;

  const serverMessage =
    resetPasswordError?.message || (resetPasswordStatus === "error" ? "Reset failed. Please try again." : null);
  const serverCode = resetPasswordError?.code;
  // Backend codes: RESET_TOKEN_INVALID, RESET_TOKEN_EXPIRED, VALIDATION_ERROR.
  const isTokenProblem =
    serverCode === "RESET_TOKEN_INVALID" ||
    serverCode === "RESET_TOKEN_EXPIRED" ||
    (serverMessage || "").toLowerCase().includes("expired");

  async function handleSubmit() {
    setTouched(true);
    if (passwordError(password) || !confirmPassword || confirmPassword !== password) return;
    try {
      // resetToken is cleared in the slice on fulfilled (single use).
      await dispatch(resetPasswordThunk({ email: resetEmail, resetToken, newPassword: password })).unwrap();
      router.replace("/(auth)/login?reset=1");
    } catch {
      // Error surfaced via slice state
    }
  }

  function PasswordField({ label, value, onChange, show, onToggle, focusKey, onSubmit, dark }) {
    return (
      <View className="mb-3">
        <Text className={`text-sm font-medium font-inter mb-1.5 ${dark ? "text-white/90" : "text-text"}`}>{label}</Text>
        <View
          className={`flex-row items-center rounded-btn px-3 py-2.5 ${dark ? "" : `border ${focused === focusKey ? "border-primary" : "border-border"} bg-white`}`}
          style={
            dark
              ? { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: focused === focusKey ? "#2563EB" : "rgba(255,255,255,0.15)" }
              : null
          }
        >
          <TextInput
            className={`flex-1 text-sm font-inter ${dark ? "text-white" : "text-text"}`}
            placeholder="••••••••"
            placeholderTextColor={dark ? "rgba(255,255,255,0.35)" : "#94A3B8"}
            value={value}
            onChangeText={onChange}
            secureTextEntry={!show}
            editable={!isLoading}
            onFocus={() => setFocused(focusKey)}
            onBlur={() => setFocused(null)}
            onSubmitEditing={onSubmit}
            style={{ outlineStyle: "none" }}
          />
          <Pressable onPress={onToggle} className="pl-2" accessibilityLabel={show ? "Hide password" : "Show password"}>
            <EyeIcon open={!show} size={22} color={dark ? "rgba(255,255,255,0.65)" : "#64748B"} />
          </Pressable>
        </View>
      </View>
    );
  }

  function Form({ dark }) {
    return (
      <View>
        <Text className={`text-2xl font-bold font-inter text-center mb-1 ${dark ? "text-white" : "text-text"}`}>
          Set a new password
        </Text>
        <Text className={`text-sm font-inter text-center mb-6 ${dark ? "text-sidebar-text" : "text-text-muted"}`}>
          Choose a strong password you haven&apos;t used before.
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
            {isTokenProblem && (
              <Pressable onPress={() => router.push("/(auth)/forgot-password")} className="mt-1">
                <Text className="text-sm text-primary font-medium font-inter text-center">Request a new code</Text>
              </Pressable>
            )}
          </View>
        )}

        {PasswordField({ label: "New password", value: password, onChange: setPassword, show: showPassword, onToggle: () => setShowPassword(!showPassword), focusKey: "password", onSubmit: handleSubmit, dark })}
        {passwordErr ? (
          <Text className={`text-xs font-inter -mt-2 mb-3 ${dark ? "text-red-300" : "text-danger"}`}>{passwordErr}</Text>
        ) : (
          <Text className={`text-xs font-inter -mt-2 mb-3 ${dark ? "text-white/50" : "text-text-muted"}`}>
            At least 8 chars, one letter, one digit.
          </Text>
        )}

        {PasswordField({ label: "Confirm new password", value: confirmPassword, onChange: setConfirmPassword, show: showConfirm, onToggle: () => setShowConfirm(!showConfirm), focusKey: "confirm", onSubmit: handleSubmit, dark })}
        {confirmErr && (
          <Text className={`text-xs font-inter -mt-2 mb-3 ${dark ? "text-red-300" : "text-danger"}`}>{confirmErr}</Text>
        )}

        <Button
          title="Reset password"
          variant="primary"
          onPress={handleSubmit}
          loading={isLoading}
          disabled={isLoading}
          className="w-full mb-4 mt-1"
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

  // Guard: do not render the form without a token + email.
  if (!resetToken || !resetEmail) {
    return <View className="flex-1 bg-sidebar" style={{ minHeight: "100vh" }} />;
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
