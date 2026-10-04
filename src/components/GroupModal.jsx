// src/components/GroupModal.jsx
// Create / edit group modal (ADMIN). Wired to createGroup / updateGroup thunks.
// CONFIRMED: POST/PUT { name, operators[], supervisorId? } — operators must
// be OPERATOR users, supervisor OPERATOR or RESPONSABLE_INDUSTRIEL (an
// operator supervisor is auto-added to members server-side).

import { useEffect, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import Input from "./Input";
import Select from "./Select";
import MultiSelect from "./MultiSelect";
import Button from "./Button";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { createGroup, updateGroup, fetchGroups } from "../store/slices/groupSlice";
import { fetchUsers } from "../store/slices/userSlice";
import { ROLES } from "../constants/roles";

export default function GroupModal({ visible, group, onClose }) {
  const dispatch = useAppDispatch();
  const { list: users, listStatus } = useAppSelector((s) => s.user);
  const isEdit = !!group;

  const [name, setName] = useState("");
  const [operatorIds, setOperatorIds] = useState([]);
  const [supervisorId, setSupervisorId] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      dispatch(fetchUsers({ page: 0, size: 100 }));
      setName(group?.name || "");
      setOperatorIds(group?.operators ? [...group.operators] : []);
      setSupervisorId(group?.supervisorId || "");
      setTouched(false);
      setError(null);
    }
  }, [visible, group, dispatch]);

  const operators = (users || []).filter((u) => u.role === ROLES.OPERATOR);
  const supervisors = (users || []).filter(
    (u) => u.role === ROLES.OPERATOR || u.role === ROLES.RESPONSABLE_INDUSTRIEL
  );
  const fullName = (u) => `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email;

  const nameErr = touched && name.trim().length < 2 ? "Group name needs at least 2 characters." : null;

  async function handleSave() {
    setTouched(true);
    if (name.trim().length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        operators: operatorIds,
        supervisorId: supervisorId || undefined,
      };
      if (isEdit) {
        await dispatch(updateGroup({ id: group.id, body })).unwrap();
      } else {
        await dispatch(createGroup(body)).unwrap();
      }
      dispatch(fetchGroups({ page: 0, size: 20 }));
      onClose();
    } catch (e) {
      // Backend codes: GROUP_ALREADY_EXISTS (409), INVALID_OPERATOR_ROLE,
      // INVALID_SUPERVISOR_ROLE (400), USER_NOT_FOUND (404), VALIDATION_ERROR.
      setError(e?.message || "Failed to save group.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable className="flex-1 bg-black/40 justify-center items-center px-4" onPress={onClose}>
        <Pressable
          className="bg-surface rounded-card w-full border border-border"
          style={{ maxWidth: 520 }}
          onPress={() => {}} // prevent bubbling
        >
          <ScrollView>
            <View className="p-6">
              <Text className="text-lg font-bold text-text font-inter mb-1">
                {isEdit ? "Edit Group" : "Add Group"}
              </Text>
              <Text className="text-sm text-text-muted font-inter mb-5">
                {isEdit ? "Rename the group and adjust its members." : "Organize operators into a supervised team."}
              </Text>

              {error && (
                <View className="bg-danger/10 rounded-btn px-3 py-2 mb-4" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
                  <Text className="text-sm text-danger font-inter">{error}</Text>
                </View>
              )}

              <View className="gap-4">
                <Input label="Group Name" placeholder="e.g. Group A" value={name} onChangeText={setName} />
                {nameErr && <Text className="text-xs text-danger font-inter -mt-2">{nameErr}</Text>}

                <Select
                  label="Supervisor"
                  value={supervisorId}
                  onValueChange={setSupervisorId}
                  placeholder={listStatus === "loading" ? "Loading users…" : "Select supervisor (optional)..."}
                  options={[{ value: "", label: "No supervisor" }, ...supervisors.map((u) => ({
                    value: u.id,
                    label: `${fullName(u)} · ${u.role === ROLES.RESPONSABLE_INDUSTRIEL ? "Responsable" : "Operator"}`,
                  }))]}
                />

                <MultiSelect
                  label={`Operators (${operatorIds.length} selected)`}
                  values={operatorIds}
                  onChange={setOperatorIds}
                  placeholder={listStatus === "loading" ? "Loading operators…" : "Select operators..."}
                  hint="Only users with the OPERATOR role can join a group."
                  options={operators.map((u) => ({ value: u.id, label: fullName(u), sublabel: u.email }))}
                />
              </View>

              <View className="flex-row gap-3 mt-6 justify-end">
                <Button title="Cancel" variant="ghost" onPress={onClose} />
                <Button
                  title={isEdit ? "Save Changes" : "Create Group"}
                  variant="primary"
                  onPress={handleSave}
                  loading={saving}
                  disabled={name.trim().length < 2}
                />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
