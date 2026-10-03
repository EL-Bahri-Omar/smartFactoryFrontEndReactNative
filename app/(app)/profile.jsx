// app/(app)/profile.jsx
//
// User Profile — web + mobile, same file.
// - Personal info: names+email via self-service PUT /api/users/me (JWT identity,
//   no role/status fields). Falls back to legacy ADMIN PUT /:id on 404.
// - Change password: self-service PUT /api/users/me/password (old verified
//   server-side), legacy fallback on 404. Forgot-password link included.
// - Web: two-column layout. Mobile: stacked cards + Log Out button.

import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Avatar from "../../src/components/Avatar";
import Divider from "../../src/components/Divider";
import Input from "../../src/components/Input";
import Skeleton from "../../src/components/Skeleton";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useRole } from "../../src/hooks/useRole";
import { useDialog } from "../../src/components/dialog/DialogContext";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { logoutThunk, setUser as setAuthUser } from "../../src/store/slices/authSlice";
import {
  fetchProfile,
  updateProfile,
  changePassword,
  clearSaveStatus,
  clearPasswordStatus,
} from "../../src/store/slices/userSlice";
import { formatDate } from "../../src/lib/time";

const ROLE_LABEL = {
  ADMIN: "Administrator",
  OPERATOR: "Operator",
  TECHNICIAN: "Technician",
  RESPONSABLE_INDUSTRIEL: "Responsable Industriel",
};

export default function ProfileScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const dialog = useDialog();
  const breakpoint = useBreakpoint();
  const dark = useDark();
  const isDesktop = breakpoint === "desktop";

  const authUser = useAppSelector((s) => s.auth.user);
  const {
    profile, status: profileStatus,
    saveStatus, error,
    passwordStatus, passwordError,
  } = useAppSelector((s) => s.user);

  const user = profile || authUser;

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [emailField, setEmailField] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Load fresh profile on mount (GET /api/auth/me).
  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  useEffect(() => {
    if (user) {
      setFullName(`${user.firstName || ""} ${user.lastName || ""}`.trim());
      setEmailField(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    if (saveStatus === "saved") {
      dialog.alert("Success", "Profile updated successfully.", "success");
      setIsEditing(false);
      const t = setTimeout(() => dispatch(clearSaveStatus()), 2000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus, dispatch]);

  useEffect(() => {
    if (passwordStatus === "saved") {
      dialog.alert("Success", "Password changed successfully.", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      const t = setTimeout(() => dispatch(clearPasswordStatus()), 2000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordStatus, dispatch]);

  async function handleSaveProfile() {
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    if (!firstName || !emailField.trim()) return;
    try {
      // Self-service: names+email only (role/status are never sent).
      // Sync auth.user too so Sidebar/TopBar show the new name instantly.
      const updated = await dispatch(updateProfile({
        firstName,
        lastName,
        email: emailField.trim(),
      })).unwrap();
      if (updated) dispatch(setAuthUser(updated));
    } catch (e) {
      // Until the coworker ships PUT /api/users/me, non-admin saves 403 on
      // the legacy fallback. Inline error shows; add guidance.
      if (e?.code === "FORBIDDEN" || e?.status === 403) {
        dialog.alert(
          "Update blocked by the server",
          "The self-service profile endpoint is not on the backend yet. Ask your backend coworker to add PUT /api/users/me, or ask an admin to edit it for you."
        );
      }
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      dialog.alert("Passwords don't match", "The new passwords you entered are not identical.");
      return;
    }
    if (newPassword.length < 6) {
      dialog.alert("Weak password", "The new password must be at least 6 characters.");
      return;
    }
    try {
      await dispatch(changePassword({ oldPassword: currentPassword, newPassword })).unwrap();
    } catch (e) {
      if (e?.code === "FORBIDDEN" || e?.status === 403) {
        dialog.alert(
          "Update blocked by the server",
          "The self-service password endpoint is not on the backend yet. Ask your backend coworker to add PUT /api/users/me/password, or reset it via Forgot Password on the login screen."
        );
      }
    }
  }

  async function handleLogout() {
    const ok = await dialog.confirm("Log Out", "Are you sure you want to log out?", {
      confirmText: "Log Out",
      danger: true,
    });
    if (!ok) return;
    try {
      await dispatch(logoutThunk()).unwrap();
    } catch {
      // Cleared locally regardless.
    }
    router.replace("/(auth)/login");
  }

  const displayName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "User";
  const roleLabel = ROLE_LABEL[user?.role] || user?.role || "—";
  const titleClass = `text-2xl font-bold font-inter ${dark ? "text-white" : "text-text"}`;

  function PasswordCard() {
    return (
      <Card>
        <Text className="text-base font-bold text-text font-inter mb-1">Change Password</Text>
        <Text className="text-xs text-text-muted font-inter mb-4">
          Enter your current password to set a new one.
        </Text>

        {passwordStatus === "error" && passwordError && (
          <View className="bg-danger/10 rounded-btn px-3 py-2 mb-3" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
            <Text className="text-sm text-danger font-inter">
              {passwordError.message || "Failed to change password"}
            </Text>
          </View>
        )}
        {passwordStatus === "saved" && (
          <View className="rounded-btn px-3 py-2 mb-3" style={{ backgroundColor: "rgba(22,163,74,0.1)", borderWidth: 1, borderColor: "rgba(22,163,74,0.3)" }}>
            <Text className="text-sm font-inter" style={{ color: "#16A34A" }}>Password changed successfully</Text>
          </View>
        )}

        <View className="gap-5">
          <Input label="Current Password" labelClassName="font-bold" placeholder="••••••••" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
          <Input label="New Password" labelClassName="font-bold" placeholder="Min. 6 characters" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
          <Input label="Confirm New Password" labelClassName="font-bold" placeholder="••••••••" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry onSubmitEditing={handleChangePassword} />
          <Button
            title="Change Password"
            variant="primary"
            onPress={handleChangePassword}
            loading={passwordStatus === "saving"}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          />
          <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
            <Text className="text-sm text-primary font-medium font-inter text-center">
              Forgot your password? Reset it by email
            </Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  function InfoCard() {
    return (
      <Card className="mb-4">
        <Text className="text-base font-bold text-text font-inter mb-4">Personal Information</Text>

        <View className="flex-row items-center gap-4 mb-2">
          <Avatar name={displayName} size="lg" />
          <View className="flex-1">
            <Text className="text-lg font-bold text-text font-inter">{displayName}</Text>
            <Text className="text-sm text-text-muted font-inter">{user?.email || ""}</Text>
            <View className="flex-row items-center mt-1.5 gap-2 flex-wrap">
              <View className="bg-primary-soft px-2 py-0.5 rounded-chip">
                <Text className="text-xs text-primary font-medium font-inter">{roleLabel}</Text>
              </View>
              <View
                className="px-2 py-0.5 rounded-chip"
                style={{ backgroundColor: user?.status === "ACTIVE" ? "rgba(22,163,74,0.12)" : "rgba(148,163,184,0.2)" }}
              >
                <Text
                  className="text-xs font-medium font-inter"
                  style={{ color: user?.status === "ACTIVE" ? "#16A34A" : "#64748B" }}
                >
                  {user?.status || "—"}
                </Text>
              </View>
              {user?.emailVerified && (
                <View className="px-2 py-0.5 rounded-chip" style={{ backgroundColor: "rgba(22,163,74,0.12)" }}>
                  <Text className="text-xs font-medium font-inter" style={{ color: "#16A34A" }}>✓ Verified</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <Text className="text-xs text-text-muted font-inter mb-4">
          Member since {user?.createdAt ? formatDate(user.createdAt) : "—"}
        </Text>

        {saveStatus === "error" && error && (
          <View className="bg-danger/10 rounded-btn px-3 py-2 mb-3" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
            <Text className="text-sm text-danger font-inter">{error.message || "Failed to update profile"}</Text>
          </View>
        )}
        {saveStatus === "saved" && (
          <View className="rounded-btn px-3 py-2 mb-3" style={{ backgroundColor: "rgba(22,163,74,0.1)", borderWidth: 1, borderColor: "rgba(22,163,74,0.3)" }}>
            <Text className="text-sm font-inter" style={{ color: "#16A34A" }}>Profile updated</Text>
          </View>
        )}

        <Divider />

        <View className="gap-4 mt-2">
          <Input label="Full Name" labelClassName="font-bold" placeholder="Omar Bahri" value={fullName} onChangeText={setFullName} disabled={!isEditing} />
          <Input label="Email" labelClassName="font-bold" placeholder="omar@smartfactory.com" value={emailField} onChangeText={setEmailField} keyboardType="email-address" autoCapitalize="none" disabled={!isEditing} />
          <View className="gap-1">
            <Text className="text-sm font-bold text-text font-inter">Role</Text>
            <View className="bg-bg border border-border rounded-btn px-3 py-2.5">
              <Text className="text-sm text-text-muted font-inter">{roleLabel}</Text>
            </View>
            <View className="flex-row items-center gap-2 mt-1">
              <Text className="text-sm">ℹ️</Text>
              <Text className="flex-1 text-xs font-bold text-primary font-inter">
                Role and status are managed by administrators
              </Text>
            </View>
          </View>
        </View>
      </Card>
    );
  }

  if (profileStatus === "loading" && !user) {
    return (
      <AppShell>
        <Card>
          <Skeleton width="40%" height={20} className="mb-3" />
          <Skeleton width="100%" height={38} className="mb-3" />
          <Skeleton width="100%" height={38} />
        </Card>
      </AppShell>
    );
  }

  // ── WEB ─────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <AppShell>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center mb-4">
            <Text className={titleClass}>Profile</Text>
          </View>

          <View className="flex-row gap-6 items-stretch" style={{ maxWidth: 1020 }}>
            <View className="flex-1">{InfoCard()}</View>
            <View style={{ width: 340 }}>
              {PasswordCard()}
            </View>
            {/* Action rail — same height level as the cards, matched widths */}
            <View className="gap-2" style={{ width: 160 }}>
              {!isEditing ? (
                <Button title="✎  Edit Profile" variant="primary" size="md" onPress={() => setIsEditing(true)} className="w-full" />
              ) : (
                <>
                  <Button title="Cancel" variant="ghost" size="sm" onPress={() => setIsEditing(false)} className="w-full" />
                  <Button title="Save Changes" variant="primary" size="sm" onPress={handleSaveProfile} loading={saveStatus === "saving"} className="w-full" />
                </>
              )}
              <Button title="Log Out" variant="danger" size="sm" onPress={handleLogout} className="w-full" />
            </View>
          </View>
        </ScrollView>
      </AppShell>
    );
  }

  // ── MOBILE ──────────────────────────────────────────────────────
  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="items-center pt-4 pb-2">
          <Avatar name={displayName} size="lg" color="#2563EB" />
          <Text className={`text-xl font-bold font-inter mt-3 ${dark ? "text-white" : "text-text"}`}>
            {displayName}
          </Text>
          <Text className={`text-sm font-inter mt-0.5 ${dark ? "text-white/60" : "text-text-muted"}`}>
            {user?.email || ""}
          </Text>
        </View>

        {!isEditing ? (
          <View className="flex-row gap-2 mb-4">
            <Button title="✎  Edit Profile" variant="primary" onPress={() => setIsEditing(true)} className="flex-1" />
            <Button title="Log Out" variant="danger" onPress={handleLogout} className="flex-1" />
          </View>
        ) : (
          <View className="flex-row gap-2 mb-4">
            <Button title="Cancel" variant="ghost" onPress={() => setIsEditing(false)} className="flex-1" />
            <Button title="Save" variant="primary" onPress={handleSaveProfile} loading={saveStatus === "saving"} className="flex-1" />
          </View>
        )}

        {InfoCard()}
        {PasswordCard()}
      </ScrollView>
    </AppShell>
  );
}
