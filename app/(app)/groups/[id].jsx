// app/(app)/groups/[id].jsx
//
// Group detail (US10) — web + mobile, same file.
// Header (name, supervisor, count) + supervisor card (assign, ADMIN) +
// operators list (add/remove, ADMIN). Reads anyone authenticated.

import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AppShell from "../../../src/components/AppShell";
import Card from "../../../src/components/Card";
import Button from "../../../src/components/Button";
import Skeleton from "../../../src/components/Skeleton";
import EmptyState from "../../../src/components/EmptyState";
import Avatar from "../../../src/components/Avatar";
import Breadcrumb from "../../../src/components/Breadcrumb";
import Select from "../../../src/components/Select";
import MultiSelect from "../../../src/components/MultiSelect";
import { useBreakpoint } from "../../../src/hooks/useBreakpoint";
import { useRole } from "../../../src/hooks/useRole";
import { useDialog } from "../../../src/components/dialog/DialogContext";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import {
  fetchGroupById,
  fetchGroupOperators,
  fetchGroupSupervisor,
  addGroupOperator,
  removeGroupOperator,
  assignGroupSupervisor,
  deleteGroup,
  clearGroupCurrent,
} from "../../../src/store/slices/groupSlice";
import { fetchUsers } from "../../../src/store/slices/userSlice";
import { ROLES } from "../../../src/constants/roles";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams();
  const groupId = Array.isArray(id) ? id[0] : id;
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const router = useRouter();
  const { isAdmin } = useRole();
  const isDesktop = useBreakpoint() === "desktop";

  const { current, operators, supervisor, currentStatus, currentError, membersStatus } =
    useAppSelector((s) => s.group);
  const { list: users } = useAppSelector((s) => s.user);

  const [addOpen, setAddOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState([]);
  const [supervisorPick, setSupervisorPick] = useState("");
  const [savingSup, setSavingSup] = useState(false);

  useEffect(() => {
    if (!groupId) return;
    dispatch(fetchGroupById(groupId));
    dispatch(fetchGroupOperators(groupId));
    dispatch(fetchGroupSupervisor(groupId));
    return () => {
      dispatch(clearGroupCurrent());
    };
  }, [dispatch, groupId]);

  useEffect(() => {
    if (isAdmin && groupId) dispatch(fetchUsers({ page: 0, size: 100 }));
  }, [dispatch, isAdmin, groupId]);

  useEffect(() => {
    setSupervisorPick(current?.supervisorId || "");
  }, [current?.supervisorId]);

  const fullName = (u) => `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || u?.email || "—";
  const memberIds = new Set((operators || []).map((u) => u.id));
  const eligibleOperators = (users || []).filter(
    (u) => u.role === ROLES.OPERATOR && !memberIds.has(u.id)
  );
  const eligibleSupervisors = (users || []).filter(
    (u) => u.role === ROLES.OPERATOR || u.role === ROLES.RESPONSABLE_INDUSTRIEL
  );

  const loading = currentStatus === "loading";
  const failed = currentStatus === "error";

  async function handleAddOperators() {
    if (pendingIds.length === 0) {
      setAddOpen(false);
      return;
    }
    try {
      for (const userId of pendingIds) {
        // Backend validates OPERATOR role + dedupes (409 on repeats, skipped here).
        await dispatch(addGroupOperator({ groupId, userId })).unwrap();
      }
      setPendingIds([]);
      setAddOpen(false);
      dispatch(fetchGroupOperators(groupId));
    } catch (e) {
      dialog.alert("Could not add operators", e?.message || "Failed to add operators.");
    }
  }

  async function handleRemove(user) {
    const ok = await dialog.confirm(
      "Remove operator",
      `Remove ${fullName(user)} from ${current?.name}?` +
        (current?.supervisorId === user.id ? " They are the supervisor — supervision will be cleared." : ""),
      { confirmText: "Remove", danger: true }
    );
    if (!ok) return;
    try {
      await dispatch(removeGroupOperator({ groupId, userId: user.id })).unwrap();
      dispatch(fetchGroupOperators(groupId));
      dispatch(fetchGroupSupervisor(groupId));
    } catch (e) {
      dialog.alert("Could not remove operator", e?.message || "Failed to remove operator.");
    }
  }

  async function handleAssignSupervisor() {
    if (!supervisorPick) return;
    setSavingSup(true);
    try {
      await dispatch(assignGroupSupervisor({ groupId, supervisorId: supervisorPick })).unwrap();
      dispatch(fetchGroupSupervisor(groupId));
      dialog.alert("Supervisor assigned", "The group supervisor was updated.", "success");
    } catch (e) {
      dialog.alert("Could not assign supervisor", e?.message || "Failed to assign supervisor.");
    } finally {
      setSavingSup(false);
    }
  }

  async function handleDelete() {
    const ok = await dialog.confirm(
      "Delete group",
      `Remove ${current?.name}? Its operators keep their accounts.`,
      { confirmText: "Delete", danger: true }
    );
    if (!ok) return;
    try {
      await dispatch(deleteGroup(groupId)).unwrap();
      router.replace("/(app)/groups");
    } catch {
      // Slice error state surfaces the failure.
    }
  }

  function SupervisorCard() {
    return (
      <Card className="mb-4">
        <Text className="text-base font-bold text-text font-inter mb-3">Supervisor</Text>
        {supervisor ? (
          <View className="flex-row items-center gap-3 mb-3">
            <Avatar name={fullName(supervisor)} size="sm" />
            <View className="flex-1">
              <Text className="text-sm font-bold text-text font-inter">{fullName(supervisor)}</Text>
              <Text className="text-xs text-text-muted font-inter">{supervisor.email}</Text>
            </View>
          </View>
        ) : (
          <Text className="text-sm text-text-muted font-inter mb-3">No supervisor assigned.</Text>
        )}
        {isAdmin && (
          <View className="gap-2">
            <Select
              value={supervisorPick}
              onValueChange={setSupervisorPick}
              placeholder="Select supervisor..."
              options={eligibleSupervisors.map((u) => ({
                value: u.id,
                label: `${fullName(u)} · ${u.role === ROLES.RESPONSABLE_INDUSTRIEL ? "Responsable" : "Operator"}`,
              }))}
            />
            <Button
              title="Assign Supervisor"
              variant="outline"
              size="sm"
              onPress={handleAssignSupervisor}
              loading={savingSup}
              disabled={!supervisorPick}
            />
          </View>
        )}
      </Card>
    );
  }

  function OperatorsCard() {
    return (
      <Card>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-bold text-text font-inter">
            Operators ({operators.length})
          </Text>
          {isAdmin && (
            <Button title="+ Add" variant="outline" size="sm" onPress={() => setAddOpen(true)} />
          )}
        </View>

        {membersStatus === "loading" && (
          <View className="gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} width="100%" height={48} />
            ))}
          </View>
        )}

        {membersStatus === "succeeded" && operators.length === 0 && (
          <EmptyState title="No operators yet" message="Add operators from the + Add button (admin)." />
        )}

        <View className="gap-2">
          {operators.map((u) => (
            <View key={u.id} className="flex-row items-center gap-3 bg-bg rounded-btn px-3 py-2.5">
              <Avatar name={fullName(u)} size="sm" />
              <View className="flex-1">
                <Text className="text-sm font-bold text-text font-inter" numberOfLines={1}>
                  {fullName(u)}
                  {current?.supervisorId === u.id && (
                    <Text className="text-xs text-primary font-inter"> · Supervisor</Text>
                  )}
                </Text>
                <Text className="text-xs text-text-muted font-inter" numberOfLines={1}>{u.email}</Text>
              </View>
              {isAdmin && (
                <Pressable onPress={() => handleRemove(u)} className="px-2 py-1">
                  <Text className="text-xs text-danger font-medium font-inter">Remove</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        {isAdmin && addOpen && (
          <View className="mt-4 pt-4 border-t border-border gap-3">
            <MultiSelect
              label="Pick operators to add"
              values={pendingIds}
              onChange={setPendingIds}
              placeholder="Select operators..."
              options={eligibleOperators.map((u) => ({ value: u.id, label: fullName(u), sublabel: u.email }))}
            />
            <View className="flex-row gap-2 justify-end">
              <Button title="Cancel" variant="ghost" size="sm" onPress={() => { setAddOpen(false); setPendingIds([]); }} />
              <Button title="Add Selected" variant="primary" size="sm" onPress={handleAddOperators} disabled={pendingIds.length === 0} />
            </View>
          </View>
        )}
      </Card>
    );
  }

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Breadcrumb
          items={[
            { label: "Groups", onPress: () => router.push("/(app)/groups") },
            { label: current?.name || "…" },
          ]}
        />

        {loading && (
          <Card className="mb-4">
            <Skeleton width="40%" height={20} className="mb-2" />
            <Skeleton width="60%" height={14} />
          </Card>
        )}

        {failed && (
          <Card className="mb-4">
            <Text className="text-sm text-danger font-inter mb-3">
              {currentError?.message || "Failed to load group"}
            </Text>
            <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchGroupById(groupId))} />
          </Card>
        )}

        {!loading && !failed && current && (
          <>
            <View className="flex-row items-start justify-between mb-4 gap-3">
              <View className="flex-1">
                <Text className="text-2xl font-bold text-text font-inter">{current.name}</Text>
                <Text className="text-sm text-text-muted font-inter mt-0.5">
                  {(current.operatorCount ?? (current.operators || []).length)} operators
                  {current.supervisorName ? ` · Supervised by ${current.supervisorName}` : ""}
                </Text>
              </View>
              {isAdmin && (
                <Button title="Delete Groupe" variant="danger" size="sm" onPress={handleDelete} />
              )}
            </View>

            {isDesktop ? (
              <View className="flex-row gap-6 items-stretch">
                <View className="flex-1">{SupervisorCard()}</View>
                <View className="flex-1">{OperatorsCard()}</View>
              </View>
            ) : (
              <View className="gap-0">
                {SupervisorCard()}
                {OperatorsCard()}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}
