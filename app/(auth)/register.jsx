// app/(auth)/register.jsx
//
// Business rule (CONFIRMED Sprint 1): new users get role = OPERATOR (default)
// and status = ACTIVE with emailVerified = false until the OTP is verified.
// The signup screen must NOT let the user pick a role (server enforces this).
//
// Signup screen — web + mobile, same file. Visually mirrors login.jsx:
// Web: factory photo background + dark overlay + centered white card (~420px, radius 16).
// Mobile: full-bleed dark background + inline form fields (same choice as Login mobile,
// NOT a white card — keeps both auth screens consistent).
//
// Dispatches registerThunk → authService.register → lib/axios.
// Never calls axios directly. No token stored — navigates to verify-account on success.

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
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { registerThunk } from "../../src/store/slices/authSlice";
import { emailError, passwordError } from "../../src/lib/validators";
import { TERMS_SECTIONS, TERMS_UPDATED } from "../../src/constants/terms";
import Button from "../../src/components/Button";

const factoryBg = require("../../assets/images/factory-bg.jpg");

function validate(values) {
  const errors = {};
  if (!values.firstName.trim()) errors.firstName = "First name is required.";
  if (!values.lastName.trim()) errors.lastName = "Last name is required.";
  const emailErr = emailError(values.email);
  if (emailErr) errors.email = emailErr;
  const passwordErr = passwordError(values.password);
  if (passwordErr) errors.password = passwordErr;
  if (!values.confirmPassword) errors.confirmPassword = "Please confirm your password.";
  else if (values.confirmPassword !== values.password) errors.confirmPassword = "Passwords do not match.";
  if (!values.acceptTerms) errors.acceptTerms = "You must accept the Terms of Use.";
  return errors;
}

function FieldError({ message, dark = false }) {
  if (!message) return null;
  return (
    <Text className={`text-xs font-inter mt-1 ${dark ? "text-red-300" : "text-danger"}`}>
      {message}
    </Text>
  );
}

export default function RegisterScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const { status, error } = useAppSelector((s) => s.auth);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(null);

  const isDesktop = breakpoint === "desktop" || breakpoint === "tablet";
  const isLoading = status === "loading";

  const values = { firstName, lastName, email, password, confirmPassword, acceptTerms };
  const fieldErrors = touched ? validate(values) : {};
  const hasClientErrors = Object.keys(validate(values)).length > 0;

  const serverMessage = error?.message || (status === "error" ? "Registration failed. Please try again." : null);
  const serverCode = error?.code;
  // Backend codes: USER_ALREADY_EXISTS (409), VALIDATION_ERROR (400).
  const isEmailTaken =
    serverCode === "USER_ALREADY_EXISTS" ||
    (serverMessage || "").toLowerCase().includes("already registered") ||
    (serverMessage || "").toLowerCase().includes("already in use") ||
    (serverMessage || "").toLowerCase().includes("already used");

  async function handleRegister() {
    setTouched(true);
    if (Object.keys(validate(values)).length > 0) return;
    try {
      await dispatch(
        registerThunk({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
        })
      ).unwrap();
      router.replace(`/(auth)/verify-account?email=${encodeURIComponent(email.trim())}`);
    } catch {
      // Error surfaced via slice state
    }
  }

  function inputWrap(active, dark) {
    if (dark) {
      return {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: active ? "#2563EB" : "rgba(255,255,255,0.15)",
      };
    }
    return null;
  }

  function TermsModal() {
    return (
      <Modal visible={termsOpen} transparent animationType="fade" onRequestClose={() => setTermsOpen(false)}>
        <Pressable
          onPress={() => setTermsOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(11,29,58,0.6)", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <Pressable
            onPress={() => {}}
            className="bg-white w-full p-6"
            style={{ maxWidth: 480, maxHeight: "85%", borderRadius: 16 }}
          >
            <Text className="text-lg font-bold text-text font-inter mb-1">Terms of Use</Text>
            <Text className="text-xs text-text-muted font-inter mb-3">Last updated: {TERMS_UPDATED}</Text>
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={true}>
              {TERMS_SECTIONS.map((s) => (
                <View key={s.title} className="mb-3">
                  <Text className="text-sm font-semibold text-text font-inter mb-1">{s.title}</Text>
                  <Text className="text-sm text-text-muted font-inter leading-5">{s.body}</Text>
                </View>
              ))}
            </ScrollView>
            <Button title="Close" variant="primary" onPress={() => setTermsOpen(false)} className="w-full mt-4" />
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // ── WEB LAYOUT (compact card; cover photo + navy page fallback) ──
  if (isDesktop) {
    return (
      <ImageBackground
        source={factoryBg}
        style={{ width: "100%", minHeight: "100vh", backgroundColor: "#0B1D3A" }}
        resizeMode="cover"
      >
        <View className="px-4" style={{ backgroundColor: "rgba(11,29,58,0.72)", width: "100%", minHeight: "100vh", paddingHorizontal: 16, paddingVertical: 16, alignItems: "center", justifyContent: "center" }}>
          <ScrollView style={{ width: "100%" }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", width: "100%" }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="bg-white w-full p-6" style={{ width: "100%", maxWidth: 420, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 32, elevation: 10 }}>
              {/* Logo */}
              <View className="items-center mb-4">
                <View className="w-12 h-12 rounded-xl bg-primary items-center justify-center mb-2">
                  <Text className="text-white text-xl font-bold">⚙</Text>
                </View>
                <Text className="text-lg font-bold text-text font-inter">SmartFactory</Text>
                <Text className="text-xs text-text-muted font-inter">Industrial Intelligence</Text>
              </View>

              <Text className="text-xl font-bold text-text font-inter text-center mb-1">Create Account</Text>
              <Text className="text-sm text-text-muted font-inter text-center mb-4">Sign up to get started</Text>

              {/* Server error */}
              {serverMessage && (
                <View className="bg-danger/10 rounded-btn px-3 py-2.5 mb-4" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
                  <Text className="text-sm text-danger font-inter text-center">{serverMessage}</Text>
                  {isEmailTaken && (
                    <Pressable onPress={() => router.push("/(auth)/login")} className="mt-1">
                      <Text className="text-sm text-primary font-medium font-inter text-center">Sign in instead</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* First + Last */}
              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-text font-inter mb-1.5">First name</Text>
                  <View className={`flex-row items-center border rounded-btn px-3 py-2 bg-white ${focused === "firstName" ? "border-primary" : "border-border"}`}>
                    <TextInput className="flex-1 text-sm text-text font-inter" placeholder="Omar" placeholderTextColor="#94A3B8" value={firstName} onChangeText={setFirstName} autoCapitalize="words" editable={!isLoading} onFocus={() => setFocused("firstName")} onBlur={() => setFocused(null)} style={{ outlineStyle: "none" }} />
                  </View>
                  <FieldError message={fieldErrors.firstName} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-text font-inter mb-1.5">Last name</Text>
                  <View className={`flex-row items-center border rounded-btn px-3 py-2 bg-white ${focused === "lastName" ? "border-primary" : "border-border"}`}>
                    <TextInput className="flex-1 text-sm text-text font-inter" placeholder="Bahri" placeholderTextColor="#94A3B8" value={lastName} onChangeText={setLastName} autoCapitalize="words" editable={!isLoading} onFocus={() => setFocused("lastName")} onBlur={() => setFocused(null)} style={{ outlineStyle: "none" }} />
                  </View>
                  <FieldError message={fieldErrors.lastName} />
                </View>
              </View>

              {/* Email */}
              <View className="mb-3">
                <Text className="text-sm font-medium text-text font-inter mb-1.5">Email address</Text>
                <View className={`flex-row items-center border rounded-btn px-3 py-2 bg-white ${focused === "email" ? "border-primary" : "border-border"}`}>
                  <TextInput className="flex-1 text-sm text-text font-inter" placeholder="name@company.com" placeholderTextColor="#94A3B8" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!isLoading} onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} style={{ outlineStyle: "none" }} />
                </View>
                <FieldError message={fieldErrors.email} />
              </View>

              {/* Password */}
              <View className="mb-3">
                <Text className="text-sm font-medium text-text font-inter mb-1.5">Password</Text>
                <View className={`flex-row items-center border rounded-btn px-3 py-2 bg-white ${focused === "password" ? "border-primary" : "border-border"}`}>
                  <TextInput className="flex-1 text-sm text-text font-inter" placeholder="••••••••" placeholderTextColor="#94A3B8" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!isLoading} onFocus={() => setFocused("password")} onBlur={() => setFocused(null)} style={{ outlineStyle: "none" }} />
                  <Pressable onPress={() => setShowPassword(!showPassword)} className="pl-2">
                    <Text className="text-xs text-text-muted font-semibold font-inter">{showPassword ? "HIDE" : "SHOW"}</Text>
                  </Pressable>
                </View>
                <FieldError message={fieldErrors.password} />
              </View>

              {/* Confirm */}
              <View className="mb-3">
                <Text className="text-sm font-medium text-text font-inter mb-1.5">Confirm password</Text>
                <View className={`flex-row items-center border rounded-btn px-3 py-2 bg-white ${focused === "confirm" ? "border-primary" : "border-border"}`}>
                  <TextInput className="flex-1 text-sm text-text font-inter" placeholder="••••••••" placeholderTextColor="#94A3B8" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} editable={!isLoading} onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)} onSubmitEditing={handleRegister} style={{ outlineStyle: "none" }} />
                  <Pressable onPress={() => setShowConfirm(!showConfirm)} className="pl-2">
                    <Text className="text-xs text-text-muted font-semibold font-inter">{showConfirm ? "HIDE" : "SHOW"}</Text>
                  </Pressable>
                </View>
                <FieldError message={fieldErrors.confirmPassword} />
              </View>

              {/* Terms */}
              <Pressable onPress={() => setAcceptTerms(!acceptTerms)} className="flex-row items-start gap-2 mb-4">
                <View className={`rounded border-2 items-center justify-center mt-0.5 ${acceptTerms ? "bg-primary border-primary" : "bg-white border-border"}`} style={{ width: 18, height: 18 }}>
                  {acceptTerms && <Text className="text-white text-[10px] font-bold">✓</Text>}
                </View>
                <Text className="text-sm text-text font-inter flex-1">
                  I agree to the{" "}
                  <Text className="text-primary font-medium" onPress={() => setTermsOpen(true)}>Terms of Use</Text>
                </Text>
              </Pressable>
              <FieldError message={fieldErrors.acceptTerms} />

              <Button title="Create Account" variant="primary" onPress={handleRegister} loading={isLoading} disabled={isLoading || (touched && hasClientErrors)} className="w-full mb-4" />

              <Text className="text-sm text-text-muted font-inter text-center">
                Already have an account?{" "}
                <Text className="text-primary font-medium" onPress={() => router.push("/(auth)/login")}>Sign in</Text>
              </Text>
            </View>
          </ScrollView>
        </View>
        <TermsModal />
      </ImageBackground>
    );
  }

  // ── MOBILE LAYOUT (same full-bleed choice as Login mobile) ──────────
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

            <Text className="text-xl font-bold text-white font-inter text-center mb-1">Create Account</Text>
            <Text className="text-sm text-sidebar-text font-inter text-center mb-6">Sign up to get started</Text>

            {serverMessage && (
              <View className="rounded-btn px-3 py-2.5 mb-4" style={{ backgroundColor: "rgba(220,38,38,0.15)", borderWidth: 1, borderColor: "rgba(220,38,38,0.3)" }}>
                <Text className="text-sm text-white font-inter text-center">{serverMessage}</Text>
                {isEmailTaken && (
                  <Pressable onPress={() => router.push("/(auth)/login")} className="mt-1">
                    <Text className="text-sm text-primary font-medium font-inter text-center">Sign in instead</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View className="mb-3">
              <Text className="text-sm font-medium text-white/90 font-inter mb-1.5">First name</Text>
              <View className="flex-row items-center rounded-btn px-3 py-2.5" style={inputWrap(focused === "firstName", true)}>
                <TextInput className="flex-1 text-sm text-white font-inter" placeholder="Omar" placeholderTextColor="rgba(255,255,255,0.35)" value={firstName} onChangeText={setFirstName} autoCapitalize="words" editable={!isLoading} onFocus={() => setFocused("firstName")} onBlur={() => setFocused(null)} style={{ outlineStyle: "none" }} />
              </View>
              <FieldError message={fieldErrors.firstName} dark />
            </View>

            <View className="mb-3">
              <Text className="text-sm font-medium text-white/90 font-inter mb-1.5">Last name</Text>
              <View className="flex-row items-center rounded-btn px-3 py-2.5" style={inputWrap(focused === "lastName", true)}>
                <TextInput className="flex-1 text-sm text-white font-inter" placeholder="Bahri" placeholderTextColor="rgba(255,255,255,0.35)" value={lastName} onChangeText={setLastName} autoCapitalize="words" editable={!isLoading} onFocus={() => setFocused("lastName")} onBlur={() => setFocused(null)} style={{ outlineStyle: "none" }} />
              </View>
              <FieldError message={fieldErrors.lastName} dark />
            </View>

            <View className="mb-3">
              <Text className="text-sm font-medium text-white/90 font-inter mb-1.5">Email</Text>
              <View className="flex-row items-center rounded-btn px-3 py-2.5" style={inputWrap(focused === "email", true)}>
                <TextInput className="flex-1 text-sm text-white font-inter" placeholder="name@company.com" placeholderTextColor="rgba(255,255,255,0.35)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!isLoading} onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} style={{ outlineStyle: "none" }} />
              </View>
              <FieldError message={fieldErrors.email} dark />
            </View>

            <View className="mb-3">
              <Text className="text-sm font-medium text-white/90 font-inter mb-1.5">Password</Text>
              <View className="flex-row items-center rounded-btn px-3 py-2.5" style={inputWrap(focused === "password", true)}>
                <TextInput className="flex-1 text-sm text-white font-inter" placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.35)" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} editable={!isLoading} onFocus={() => setFocused("password")} onBlur={() => setFocused(null)} style={{ outlineStyle: "none" }} />
                <Pressable onPress={() => setShowPassword(!showPassword)} className="pl-2">
                  <Text className="text-xs text-white/50 font-semibold font-inter">{showPassword ? "HIDE" : "SHOW"}</Text>
                </Pressable>
              </View>
              <FieldError message={fieldErrors.password} dark />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-white/90 font-inter mb-1.5">Confirm password</Text>
              <View className="flex-row items-center rounded-btn px-3 py-2.5" style={inputWrap(focused === "confirm", true)}>
                <TextInput className="flex-1 text-sm text-white font-inter" placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.35)" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} editable={!isLoading} onFocus={() => setFocused("confirm")} onBlur={() => setFocused(null)} onSubmitEditing={handleRegister} style={{ outlineStyle: "none" }} />
                <Pressable onPress={() => setShowConfirm(!showConfirm)} className="pl-2">
                  <Text className="text-xs text-white/50 font-semibold font-inter">{showConfirm ? "HIDE" : "SHOW"}</Text>
                </Pressable>
              </View>
              <FieldError message={fieldErrors.confirmPassword} dark />
            </View>

            <Pressable onPress={() => setAcceptTerms(!acceptTerms)} className="flex-row items-start gap-2 mb-2">
              <View className="rounded border-2 items-center justify-center mt-0.5" style={{ width: 18, height: 18, backgroundColor: acceptTerms ? "#2563EB" : "transparent", borderColor: acceptTerms ? "#2563EB" : "rgba(255,255,255,0.3)" }}>
                {acceptTerms && <Text className="text-white text-[10px] font-bold">✓</Text>}
              </View>
              <Text className="text-sm text-white/70 font-inter flex-1">
                I agree to the <Text className="text-primary font-medium" onPress={() => setTermsOpen(true)}>Terms of Use</Text>
              </Text>
            </Pressable>
            <FieldError message={fieldErrors.acceptTerms} dark />
          </View>

          <View className="mt-6">
            <Button title="Create Account" variant="primary" onPress={handleRegister} loading={isLoading} disabled={isLoading || (touched && hasClientErrors)} className="w-full mb-5" size="lg" />
            <Text className="text-sm text-sidebar-text font-inter text-center">
              Already have an account?{" "}
              <Text className="text-primary font-medium" onPress={() => router.push("/(auth)/login")}>Sign in</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
      <TermsModal />
    </KeyboardAvoidingView>
  );
}
