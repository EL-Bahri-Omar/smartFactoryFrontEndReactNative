// app/(auth)/reset-password-verify.jsx
//
// Reset Password Code screen — web + mobile, same file. Mirrors
// verify-account.jsx (same 6 digit boxes, same card, same background):
// Web: factory photo background + dark overlay + centered white card (~420px, radius 16).
// Mobile: full-bleed dark background + inline fields (same choice as Login mobile).
//
// Dispatches verifyResetCodeThunk({ email, code }) → authService → lib/axios.
// Never calls axios directly. Success stores resetToken in Redux memory only
// (never persisted) and navigates to /(auth)/reset-password.
// Resend reuses forgotPasswordThunk (sends a fresh reset code), NOT the
// account-verification resend endpoint.

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import {
  verifyResetCodeThunk,
  forgotPasswordThunk,
} from "../../src/store/slices/authSlice";
import Button from "../../src/components/Button";

const factoryBg = require("../../assets/images/factory-bg.jpg");

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function ResetPasswordVerifyScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const params = useLocalSearchParams();
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;

  const email = typeof emailParam === "string" ? emailParam : "";

  const { verifyCodeStatus, verifyCodeError, forgotStatus, forgotError } = useAppSelector((s) => s.auth);

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef([]);
  const timerRef = useRef(null);

  const isDesktop = breakpoint === "desktop" || breakpoint === "tablet";
  const isVerifying = verifyCodeStatus === "loading";
  const isResending = forgotStatus === "loading";
  const code = digits.join("");
  const canContinue = code.length === CODE_LENGTH && !isVerifying && email;

  const errorMessage =
    verifyCodeError?.message || (verifyCodeStatus === "error" ? "Invalid code. Please try again." : null);
  const resendMessage =
    forgotError?.message || (forgotStatus === "error" ? "Could not resend the code." : null);
  const resentOk = forgotStatus === "succeeded";

  // Countdown timer — cleaned up on unmount.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    timerRef.current = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function focusBox(index) {
    const ref = inputRefs.current[index];
    if (ref?.focus) ref.focus();
  }

  function handleChange(index, text) {
    const clean = (text || "").replace(/\D/g, "");
    if (!clean) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }
    // Paste of several digits fills forward from this box.
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < clean.length && index + i < CODE_LENGTH; i += 1) {
        next[index + i] = clean[i];
      }
      return next;
    });
    if (clean.length === 1) {
      if (index < CODE_LENGTH - 1) focusBox(index + 1);
    } else {
      focusBox(Math.min(index + clean.length, CODE_LENGTH - 1));
    }
  }

  function handleKeyPress(index, e) {
    if (e?.nativeEvent?.key === "Backspace" && !digits[index] && index > 0) {
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        return next;
      });
      focusBox(index - 1);
    }
  }

  async function handleContinue() {
    if (!canContinue) return;
    try {
      // resetToken is stored in Redux memory only by the thunk's fulfilled reducer.
      await dispatch(verifyResetCodeThunk({ email, code })).unwrap();
      router.replace("/(auth)/reset-password");
    } catch {
      // Error surfaced via slice state
    }
  }

  async function handleResend() {
    if (!email || cooldown > 0 || isResending) return;
    try {
      await dispatch(forgotPasswordThunk({ email })).unwrap();
      setCooldown(RESEND_COOLDOWN);
    } catch {
      // Error surfaced via slice state
    }
  }

  function DigitBoxes({ dark }) {
    return (
      <View className="flex-row justify-between gap-2 mb-4" style={{ gap: 8 }}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => {
              inputRefs.current[i] = r;
            }}
            value={d}
            onChangeText={(t) => handleChange(i, t)}
            onKeyPress={(e) => handleKeyPress(i, e)}
            onSubmitEditing={handleContinue}
            keyboardType="number-pad"
            maxLength={i === 0 ? CODE_LENGTH : 1}
            selectTextOnFocus
            editable={!isVerifying}
            textAlign="center"
            className={`font-inter font-bold ${dark ? "text-white" : "text-text"}`}
            style={
              dark
                ? {
                    width: 44,
                    height: 52,
                    borderRadius: 8,
                    fontSize: 20,
                    textAlign: "center",
                    paddingHorizontal: 0,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.15)",
                    outlineStyle: "none",
                  }
                : {
                    width: 44,
                    height: 52,
                    borderRadius: 8,
                    fontSize: 20,
                    textAlign: "center",
                    paddingHorizontal: 0,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                    outlineStyle: "none",
                  }
            }
          />
        ))}
      </View>
    );
  }

  function Body({ dark }) {
    return (
      <View>
        <Text className={`text-2xl font-bold font-inter text-center mb-1 ${dark ? "text-white" : "text-text"}`}>
          Enter reset code
        </Text>
        {email ? (
          <Text className={`text-sm font-inter text-center mb-6 ${dark ? "text-sidebar-text" : "text-text-muted"}`}>
            We sent a 6-digit code to {email}.
          </Text>
        ) : (
          <View className="mb-6">
            <Text className={`text-sm font-inter text-center ${dark ? "text-sidebar-text" : "text-text-muted"}`}>
              We sent a 6-digit code to your email address.
            </Text>
            <Pressable onPress={() => router.push("/(auth)/forgot-password")} className="mt-1">
              <Text className="text-sm text-primary font-medium font-inter text-center">Back to forgot password</Text>
            </Pressable>
          </View>
        )}

        {errorMessage && (
          <View
            className="rounded-btn px-3 py-2.5 mb-4"
            style={
              dark
                ? { backgroundColor: "rgba(220,38,38,0.15)", borderWidth: 1, borderColor: "rgba(220,38,38,0.3)" }
                : { backgroundColor: "rgba(220,38,38,0.08)", borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }
            }
          >
            <Text className={`text-sm font-inter text-center ${dark ? "text-white" : "text-danger"}`}>{errorMessage}</Text>
          </View>
        )}

        {DigitBoxes({ dark })}

        <Button
          title="Continue"
          variant="primary"
          onPress={handleContinue}
          loading={isVerifying}
          disabled={!canContinue}
          className="w-full mb-4"
          size={dark ? "lg" : "md"}
        />

        <View className="flex-row items-center justify-center mb-2">
          {cooldown > 0 ? (
            <Text className={`text-sm font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>
              Resend in {cooldown}s
            </Text>
          ) : isResending ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#2563EB" />
              <Text className={`text-sm font-inter ${dark ? "text-white/70" : "text-text-muted"}`}>Sending…</Text>
            </View>
          ) : (
            <Pressable onPress={handleResend}>
              <Text className="text-sm text-primary font-medium font-inter">Resend code</Text>
            </Pressable>
          )}
        </View>
        {resendMessage && (
          <Text className={`text-xs font-inter text-center mb-2 ${dark ? "text-red-300" : "text-danger"}`}>{resendMessage}</Text>
        )}
        {resentOk && !resendMessage && (
          <Text className={`text-xs font-inter text-center mb-2 ${dark ? "text-green-300" : "text-success"}`}>A new code was sent.</Text>
        )}

        <Pressable onPress={() => router.push("/(auth)/forgot-password")} className="mt-2">
          <Text className={`text-sm font-inter text-center ${dark ? "text-sidebar-text" : "text-text-muted"}`}>
            Use a different email
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
              {Body({ dark: false })}
            </View>
          </ScrollView>
        </View>
      </ImageBackground>
    );
  }

  // ── MOBILE (same full-bleed choice as Login/Signup) ─────────────
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
            {Body({ dark: true })}
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
