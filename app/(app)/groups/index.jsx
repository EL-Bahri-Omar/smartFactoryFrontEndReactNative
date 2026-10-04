// app/(app)/groups.jsx
//
// Groups — web + mobile, same file (US10).
// Any authenticated role can view (backend GETs are open); only ADMIN sees
// Add/Edit/Delete (backend writes are ADMIN-only).
// Web: table Group · Supervisor · Operators · Created · Actions.
// Mobile: search + card list.

import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, FlatList } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../../src/components/AppShell";
import Card from "../../../src/components/Card";
import Button from "../../../src/components/Button";
import Skeleton from "../../../src/components/Skeleton";
import EmptyState from "../../../src/components/EmptyState";
import Avatar from "../../../src/components/Avatar";
import GroupModal from "../../../src/components/GroupModal";
import { useBreakpoint } from "../../../src/hooks/useBreakpoint";
import { useRole } from "../../../src/hooks/useRole";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import { fetchGroups, deleteGroup, setGroupFilters } from "../../../src/store/slices/groupSlice";
import { useDialog } from "../../../src/components/dialog/DialogContext";
import { formatDate } from "../../../src/lib/time";

export default function GroupsScreen() {
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const { isAdmin, canAccess, homeRoute } = useRole();
  const isDesktop = breakpoint === "desktop";
  const { list, totalElements, status, error, filters } = useAppSelector((s) => s.group);

  const [searchInput, setSearchInput] = useState(filters.search || "");
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    dispatch(fetchGroups({ search: filters.search || undefined, page: 0, size: 20 }));
  }, [dispatch, filters.search]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== filters.search) dispatch(setGroupFilters({ search: searchInput }));
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, filters.search, dispatch]);

  function openCreate() {
    setEditing(null);
    setModalVisible(true);
  }

  function openEdit(group) {
    setEditing(group);
    setModalVisible(true);
  }

  function openDetail(group) {
    router.push(`/(app)/groups/${group.id}`);
  }

  async function handleDelete(group) {
    const ok = await dialog.confirm("Delete group", `Remove ${group.name}? Its operators keep their accounts.`, {
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await dispatch(deleteGroup(group.id)).unwrap();
      dispatch(fetchGroups({ search: filters.search || undefined, page: 0, size: 20 }));
    } catch {
      // Slice error state surfaces the failure.
    }
  }

  const isLoading = status === "loading";
  const isError = status === "error";
  const isEmpty = status === "succeeded" && list.length === 0;

  if (!canAccess("groups")) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            title="Restricted area"
            message="Group management is reserved for administrators."
            action={<Button title="Go Back" variant="primary" size="sm" onPress={() => router.replace(homeRoute)} />}
          />
        </Card>
      </AppShell>
    );
  }

  // ── WEB ─────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <AppShell>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center justify-between mb-5">
            <Text className="text-2xl font-bold text-text font-inter">
              Groups{totalElements ? ` (${totalElements})` : ""}
            </Text>
            {isAdmin && (
              <Button title="+ Add Group" variant="primary" size="sm" onPress={openCreate} />
            )}
          </View>

          <View className="flex-row items-center bg-bg border border-border rounded-btn px-3 py-2 gap-2 mb-4" style={{ width: 260 }}>
            <Text className="text-text-muted text-sm">🔍</Text>
            <TextInput
              className="flex-1 text-sm text-text font-inter"
              placeholder="Search groups..."
              placeholderTextColor="#94A3B8"
              value={searchInput}
              onChangeText={setSearchInput}
              style={{ outlineStyle: "none" }}
            />
          </View>

          {isError && (
            <Card className="mb-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-danger font-inter">{error?.message || "Failed to load groups"}</Text>
                <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchGroups({ search: filters.search || undefined, page: 0, size: 20 }))} />
              </View>
            </Card>
          )}

          {isLoading && (
            <Card>
              {[1, 2, 3].map((i) => (
                <View key={i} className="flex-row items-center gap-4 py-3 border-b border-border">
                  <Skeleton width={140} height={14} />
                  <Skeleton width={160} height={14} />
                  <Skeleton width={80} height={14} />
                  <Skeleton width={70} height={14} />
                </View>
              ))}
            </Card>
          )}

          {isEmpty && !isLoading && (
            <Card>
              <EmptyState
                title={filters.search ? "No groups match" : "No groups yet"}
                message={filters.search ? "Try a different search term." : "Create your first operator group to get started."}
                action={isAdmin && !filters.search ? (
                  <Button title="+ Add Group" variant="primary" size="sm" onPress={openCreate} />
                ) : null}
              />
            </Card>
          )}

          {!isLoading && !isEmpty && !isError && (
            <Card className="overflow-hidden p-0">
              <View className="flex-row items-center px-4 py-3 border-b border-border bg-bg">
                <Text className="flex-1 text-xs font-semibold text-text-muted font-inter">Group</Text>
                <Text className="w-48 text-xs font-semibold text-text-muted font-inter">Supervisor</Text>
                <Text className="w-28 text-xs font-semibold text-text-muted font-inter">Operators</Text>
                <Text className="w-28 text-xs font-semibold text-text-muted font-inter">Created</Text>
                {isAdmin && (
                  <Text className="w-28 text-xs font-semibold text-text-muted font-inter">Actions</Text>
                )}
              </View>
              {list.map((g, idx) => (
                <Pressable
                  key={g.id || idx}
                  onPress={() => openDetail(g)}
                  className={`flex-row items-center px-4 py-3 border-b border-border ${idx % 2 === 0 ? "bg-surface" : "bg-bg/50"}`}
                  style={({ pressed }) => (pressed ? { backgroundColor: "#F0F4FA" } : {})}
                >
                  <Text className="flex-1 text-sm font-semibold text-primary font-inter" numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text className="w-48 text-sm text-text-muted font-inter" numberOfLines={1}>
                    {g.supervisorName || "—"}
                  </Text>
                  <View className="w-28">
                    <View className="bg-primary-soft px-2 py-0.5 rounded-chip self-start">
                      <Text className="text-xs text-primary font-medium font-inter">
                        {g.operatorCount ?? (g.operators || []).length}
                      </Text>
                    </View>
                  </View>
                  <Text className="w-28 text-xs text-text-muted font-inter" numberOfLines={1}>
                    {g.createdAt ? formatDate(g.createdAt) : "—"}
                  </Text>
                  {isAdmin && (
                    <View className="w-28 flex-row gap-1">
                      <Pressable onPress={(e) => { e.stopPropagation?.(); openEdit(g); }} className="px-2 py-1">
                        <Text className="text-xs text-primary font-medium font-inter">Edit</Text>
                      </Pressable>
                      <Pressable onPress={(e) => { e.stopPropagation?.(); handleDelete(g); }} className="px-2 py-1">
                        <Text className="text-xs text-danger font-medium font-inter">Delete</Text>
                      </Pressable>
                    </View>
                  )}
                </Pressable>
              ))}
            </Card>
          )}
        </ScrollView>

        <GroupModal visible={modalVisible} group={editing} onClose={() => setModalVisible(false)} />
      </AppShell>
    );
  }

  // ── MOBILE ──────────────────────────────────────────────────────
  return (
    <AppShell>
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xl font-bold text-text font-inter">Groups</Text>
          {isAdmin && (
            <Pressable onPress={openCreate} className="px-4 py-2 rounded-chip bg-primary">
              <Text className="text-xs font-semibold text-white font-inter">+ Add Group</Text>
            </Pressable>
          )}
        </View>

        <View className="flex-row items-center bg-surface border border-border rounded-btn px-3 py-2 gap-2 mb-3">
          <Text className="text-text-muted text-sm">🔍</Text>
          <TextInput
            className="flex-1 text-sm text-text font-inter"
            placeholder="Search groups..."
            placeholderTextColor="#94A3B8"
            value={searchInput}
            onChangeText={setSearchInput}
            style={{ outlineStyle: "none" }}
          />
        </View>

        {isError && (
          <Card className="mb-3">
            <Text className="text-sm text-danger font-inter mb-2">{error?.message || "Failed to load groups"}</Text>
            <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchGroups({ search: filters.search || undefined, page: 0, size: 20 }))} />
          </Card>
        )}

        {isLoading && (
          <View className="gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <Skeleton width="50%" height={16} className="mb-2" />
                <Skeleton width="70%" height={12} />
              </Card>
            ))}
          </View>
        )}

        {isEmpty && !isLoading && (
          <Card>
            <EmptyState title={filters.search ? "No groups match" : "No groups yet"} message="Create groups from the + Add Group button (admin)." />
          </Card>
        )}

        {!isLoading && !isEmpty && !isError && (
          <FlatList
            data={list}
            keyExtractor={(item, idx) => item.id || String(idx)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => openDetail(item)}>
                <Card>
                  <View className="flex-row items-center gap-3">
                    <Avatar name={item.name} size="sm" />
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-text font-inter">{item.name}</Text>
                      <Text className="text-xs text-text-muted font-inter" numberOfLines={1}>
                        {item.supervisorName ? `Supervised by ${item.supervisorName}` : "No supervisor"}
                      </Text>
                      <Text className="text-xs text-primary font-inter mt-0.5">
                        {item.operatorCount ?? (item.operators || []).length} operators
                      </Text>
                    </View>
                    {isAdmin && (
                      <Pressable onPress={() => openEdit(item)} className="px-2 py-1">
                        <Text className="text-sm text-primary font-medium font-inter">Edit</Text>
                      </Pressable>
                    )}
                  </View>
                </Card>
              </Pressable>
            )}
          />
        )}
      </View>

      <GroupModal visible={modalVisible} group={editing} onClose={() => setModalVisible(false)} />
    </AppShell>
  );
}
