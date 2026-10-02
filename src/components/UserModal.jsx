// src/components/UserModal.jsx
// Create / edit user modal (ADMIN). Wired to createUser / updateUserById thunks.
// CONFIRMED Sprint 1: POST /api/users { firstName, lastName, email, password, role, status? }
// PUT /api/users/:id { firstName, lastName, email, role, status, password? } (password optional).

import { useEffect, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import Input from "./Input";
import Select from "./Select";
import Button from "./Button";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { createUser, updateUserById, fetchUsers } from "../store/slices/userSlice";
import { ROLES } from "../constants/roles";

const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: "Administrator" },
  { value: ROLES.OPERATOR, label: "Operator" },
  { value: ROLES.TECHNICIAN, label: "Technician" },
  { value: ROLES.RESPONSABLE_INDUSTRIEL, label: "Responsable Industriel" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

export default function UserModal({ visible, user, onClose }) {
  const dispatch = useAppDispatch();
  const isEdit = !!user;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(ROLES.OPERATOR);
  const [status, setStatus] = useState("ACTIVE");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      setFirstName(user?.firstName || "");
      setLastName(user?.lastName || "");
      setEmail(user?.email || "");
      setPassword("");
      setRole(user?.role || ROLES.OPERATOR);
      setStatus(user?.status || "ACTIVE");
      setTouched(false);
      setError(null);
    }
  }, [visible, user]);

  const emailErr = touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter a valid email address." : null;
  const passwordErr = touched && !isEdit && password.length < 6 ? "Password must be at least 6 characters." : null;
  const nameErr = touched && (!firstName.trim() || !lastName.trim()) ? "First and last name are required." : null;
  const hasErrors = !!(emailErr || passwordErr || nameErr) || !role;

  async function handleSave() {
    setTouched(true);
    if (!firstName.trim() || !lastName.trim() || emailErr || (!isEdit && password.length < 6) || !role) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const body = { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), role, status };
        if (password) body.password = password; // optional on update
        await dispatch(updateUserById({ id: user.id, body })).unwrap();
      } else {
        await dispatch(createUser({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          role,
          status: "ACTIVE",
        })).unwrap();
      }
      dispatch(fetchUsers({ page: 0, size: 20 }));
      onClose();
    } catch (e) {
      // Backend codes: USER_ALREADY_EXISTS (409), VALIDATION_ERROR (400), FORBIDDEN.
      setError(e?.message || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable className="flex-1 bg-black/40 justify-center items-center px-4" onPress={onClose}>
        <Pressable className="bg-surface rounded-card w-full border border-border" style={{ maxWidth: 480 }} onPress={() => {}}>
          <ScrollView>
            <View className="p-6">
              <Text className="text-lg font-bold text-text font-inter mb-1">
                {isEdit ? "Edit User" : "Add User"}
              </Text>
              <Text className="text-sm text-text-muted font-inter mb-5">
                {isEdit ? "Update role, status and details." : "New users start as Operator."}
              </Text>

              {error && (
                <View className="bg-danger/10 rounded-btn px-3 py-2 mb-4" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
                  <Text className="text-sm text-danger font-inter">{error}</Text>
                </View>
              )}

              <View className="gap-4">
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Input label="First Name" placeholder="Omar" value={firstName} onChangeText={setFirstName} />
                  </View>
                  <View className="flex-1">
                    <Input label="Last Name" placeholder="Bahri" value={lastName} onChangeText={setLastName} />
                  </View>
                </View>
                {nameErr && <Text className="text-xs text-danger font-inter -mt-2">{nameErr}</Text>}
                <Input label="Email" placeholder="name@company.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!isEdit} />
                {emailErr && <Text className="text-xs text-danger font-inter -mt-2">{emailErr}</Text>}
                <Input label={isEdit ? "New Password (optional)" : "Password"} placeholder="••••••" value={password} onChangeText={setPassword} secureTextEntry />
                {passwordErr && <Text className="text-xs text-danger font-inter -mt-2">{passwordErr}</Text>}
                <Select label="Role" value={role} onValueChange={setRole} options={ROLE_OPTIONS} />
                {isEdit && <Select label="Status" value={status} onValueChange={setStatus} options={STATUS_OPTIONS} />}
              </View>

              <View className="flex-row gap-3 mt-6 justify-end">
                <Button title="Cancel" variant="ghost" onPress={onClose} />
                <Button title={isEdit ? "Save Changes" : "Create User"} variant="primary" onPress={handleSave} loading={saving} disabled={saving} />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
