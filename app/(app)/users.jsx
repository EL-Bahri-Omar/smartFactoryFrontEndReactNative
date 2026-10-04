// app/(app)/users.jsx
//
// Users — ADMIN only, web + mobile, same file.
// Web: table Name · Email · Role · Status · Verified · actions (Edit/Delete).
// Mobile: search + card list.
// Non-admins see an "Administrators only" empty state (RB10, UI-only gating).

import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, FlatList } from "react-native";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Skeleton from "../../src/components/Skeleton";
import EmptyState from "../../src/components/EmptyState";
import Avatar from "../../src/components/Avatar";
import UserModal from "../../src/components/UserModal";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useRole } from "../../src/hooks/useRole";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import { fetchUsers, deleteUser } from "../../src/store/slices/userSlice";
import { ROLES } from "../../src/constants/roles";
import { useDialog } from "../../src/components/dialog/DialogContext";

const ROLE_LABEL = {
  ADMIN: "Administrator",
  OPERATOR: "Operator",
  TECHNICIAN: "Technician",
  RESPONSABLE_INDUSTRIEL: "Responsable",
};

export default function UsersScreen() {
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const breakpoint = useBreakpoint();
  const { isAdmin } = useRole();
  const dark = useDark();
  const isDesktop = breakpoint === "desktop";
  const { list, listStatus, listError } = useAppSelector((s) => s.user);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // The backend has no ?role= filter, so role filtering + paging happen
  // client-side over one full fetch (backend caps size at 100).
  const [roleFilter, setRoleFilter] = useState(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);

  const refresh = () => dispatch(fetchUsers({ page: 0, size: 100 }));

  useEffect(() => {
    if (isAdmin) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, isAdmin]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
        setPage(0);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list || []).filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (!q) return true;
      return `${u.firstName || ""} ${u.lastName || ""} ${u.email || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [list, search, roleFilter]);

  // Badge counts per role from the full list — stable no matter which
  // role/search filter is active (same pattern as the machines tabs).
  const roleCounts = useMemo(() => {
    const counts = { ALL: (list || []).length };
    (list || []).forEach((u) => {
      if (u?.role) counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [list]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function pickRole(role) {
    setRoleFilter(role);
    setPage(0);
  }

  async function handleDelete(user) {
    const ok = await dialog.confirm("Delete user", `Remove ${user.email}? This cannot be undone.`, {
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await dispatch(deleteUser(user.id)).unwrap();
      refresh();
    } catch {
      // Error shown inline via listError on next fetch; nothing to do here.
    }
  }

  function openEdit(user) {
    setEditing(user);
    setModalVisible(true);
  }

  function openCreate() {
    setEditing(null);
    setModalVisible(true);
  }

  const isLoading = listStatus === "loading";
  const isError = listStatus === "error";
  const isEmpty = listStatus === "succeeded" && filtered.length === 0;

  const ROLE_TABS = [
    { key: null, label: "All" },
    { key: ROLES.ADMIN, label: "Admins" },
    { key: ROLES.OPERATOR, label: "Operators" },
    { key: ROLES.TECHNICIAN, label: "Technicians" },
    { key: ROLES.RESPONSABLE_INDUSTRIEL, label: "Responsables" },
  ];

  function roleCount(key) {
    if (!key) return roleCounts.ALL || 0;
    return roleCounts[key] || 0;
  }

  function Pagination({ compact = false }) {
    if (totalPages <= 1) return null;
    return (
      <View className={`flex-row items-center justify-center ${compact ? "mt-2" : "mt-6"} gap-5`}>
        <Pressable
          onPress={() => setPage((p) => Math.max(0, p - 1))}
          disabled={safePage === 0}
          className={`px-4 py-1.5 rounded-btn ${safePage === 0 ? "bg-bg border border-border opacity-40" : "bg-primary"}`}
          style={safePage !== 0 ? { shadowColor: "#2563EB", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 } : {}}
        >
          <Text className={`text-sm font-bold font-inter ${safePage === 0 ? "text-text-muted" : "text-white"}`}>‹ Prev</Text>
        </Pressable>
        <Text className="text-sm text-text-muted font-inter">
          Page <Text className="font-bold text-text font-inter">{safePage + 1}</Text> of {totalPages} · <Text className="font-bold text-text font-inter">{filtered.length} user{filtered.length === 1 ? "" : "s"}</Text>
        </Text>
        <Pressable
          onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={safePage >= totalPages - 1}
          className={`px-4 py-1.5 rounded-btn ${safePage >= totalPages - 1 ? "bg-bg border border-border opacity-40" : "bg-primary"}`}
          style={safePage < totalPages - 1 ? { shadowColor: "#2563EB", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 } : {}}
        >
          <Text className={`text-sm font-bold font-inter ${safePage >= totalPages - 1 ? "text-text-muted" : "text-white"}`}>Next ›</Text>
        </Pressable>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <Card>
          <EmptyState title="Administrators only" message="User management is restricted to administrators." />
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
            <Text className={`text-2xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
              Users{filtered.length ? ` (${filtered.length})` : ""}
            </Text>
            <Button title="+ Add User" variant="primary" size="sm" onPress={openCreate} />
          </View>

          <View className="flex-row items-center justify-between mb-4 gap-3">
            <View className="flex-row gap-1 flex-1 flex-wrap">
              {ROLE_TABS.map((tab) => {
                const active = roleFilter === tab.key;
                return (
                  <Pressable
                    key={tab.label}
                    onPress={() => pickRole(tab.key)}
                    className={`px-3 py-1.5 rounded-chip flex-row items-center gap-1.5 ${active ? "bg-primary" : "bg-bg"}`}
                  >
                    <Text className={`text-xs font-medium font-inter ${active ? "text-white" : "text-text-muted"}`}>
                      {tab.label}
                    </Text>
                    <View className={`min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ${active ? "bg-white/20" : "bg-border"}`}>
                      <Text className={`text-[10px] font-bold font-inter ${active ? "text-white" : "text-text-muted"}`}>
                        {roleCount(tab.key)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View className="flex-row items-center bg-bg border border-border rounded-btn px-3 py-2 gap-2" style={{ width: 220 }}>
              <Text className="text-text-muted text-sm">🔍</Text>
              <TextInput
                className="flex-1 text-sm text-text font-inter"
                placeholder="Search users..."
                placeholderTextColor="#94A3B8"
                value={searchInput}
                onChangeText={setSearchInput}
                style={{ outlineStyle: "none" }}
              />
            </View>
          </View>

          {isError && (
            <Card className="mb-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-danger font-inter">{listError?.message || "Failed to load users"}</Text>
                <Button title="Retry" variant="outline" size="sm" onPress={refresh} />
              </View>
            </Card>
          )}

          {isLoading && (
            <Card>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} className="flex-row items-center gap-4 py-3 border-b border-border">
                  <Skeleton width={120} height={14} />
                  <Skeleton width={160} height={14} />
                  <Skeleton width={80} height={14} />
                  <Skeleton width={60} height={14} />
                </View>
              ))}
            </Card>
          )}

          {isEmpty && !isLoading && (
            <Card>
              <EmptyState
                title={search || roleFilter ? "No users match" : "No users yet"}
                message={search || roleFilter ? "Try changing the filters." : "Add your first user to get started."}
              />
            </Card>
          )}

          {!isLoading && !isEmpty && !isError && (
            <Card className="overflow-hidden p-0">
              <View className="flex-row items-center px-4 py-3 border-b border-border bg-bg">
                <Text className="flex-1 text-xs font-semibold text-text-muted font-inter">Name</Text>
                <Text className="w-56 text-xs font-semibold text-text-muted font-inter">Email</Text>
                <Text className="w-32 text-xs font-semibold text-text-muted font-inter">Role</Text>
                <Text className="w-24 text-xs font-semibold text-text-muted font-inter">Status</Text>
                <Text className="w-28 text-xs font-semibold text-text-muted font-inter">Actions</Text>
              </View>
              {pageItems.map((u, idx) => (
                <View
                  key={u.id || idx}
                  className={`flex-row items-center px-4 py-3 border-b border-border ${idx % 2 === 0 ? "bg-surface" : "bg-bg/50"}`}
                >
                  <View className="flex-1 flex-row items-center gap-2">
                    <Avatar name={`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email} size="sm" />
                    <Text className="text-sm text-text font-inter" numberOfLines={1}>
                      {u.firstName} {u.lastName}
                    </Text>
                  </View>
                  <Text className="w-56 text-sm text-text-muted font-inter" numberOfLines={1}>{u.email}</Text>
                  <View className="w-32">
                    <View className="bg-primary-soft px-2 py-0.5 rounded-chip self-start">
                      <Text className="text-xs text-primary font-medium font-inter">{ROLE_LABEL[u.role] || u.role}</Text>
                    </View>
                  </View>
                  <Text className="w-24 text-sm text-text-muted font-inter">{u.status}</Text>
                  <View className="w-28 flex-row gap-2">
                    <Pressable onPress={() => openEdit(u)} className="px-2 py-1">
                      <Text className="text-sm text-primary font-medium font-inter">Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDelete(u)} className="px-2 py-1">
                      <Text className="text-sm text-danger font-medium font-inter">Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </Card>
          )}

          {!isLoading && !isError && <Pagination />}
        </ScrollView>

        <UserModal visible={modalVisible} user={editing} onClose={() => setModalVisible(false)} />
      </AppShell>
    );
  }

  // ── MOBILE ──────────────────────────────────────────────────────
  return (
    <AppShell>
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-3">
          <Text className={`text-xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>Users</Text>
          <Pressable onPress={openCreate} className="px-3 py-1.5 rounded-chip bg-primary">
            <Text className="text-xs font-semibold text-white font-inter">+ Add</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center bg-surface border border-border rounded-btn px-3 py-2 gap-2 mb-3">
          <Text className="text-text-muted text-sm">🔍</Text>
          <TextInput
            className="flex-1 text-sm text-text font-inter"
            placeholder="Search users..."
            placeholderTextColor="#94A3B8"
            value={searchInput}
            onChangeText={setSearchInput}
            style={{ outlineStyle: "none" }}
          />
        </View>

        <View className="flex-row flex-wrap gap-2 mb-3">
          {ROLE_TABS.map((tab) => {
            const active = roleFilter === tab.key;
            return (
              <Pressable
                key={tab.label}
                onPress={() => pickRole(tab.key)}
                className={`px-3 py-2 rounded-chip flex-row items-center gap-1.5 ${active ? "bg-primary" : "bg-surface border border-border"}`}
              >
                <Text className={`text-xs font-medium font-inter ${active ? "text-white" : "text-text-muted"}`}>
                  {tab.label}
                </Text>
                <View className={`min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ${active ? "bg-white/20" : "bg-border"}`}>
                  <Text className={`text-[10px] font-bold font-inter ${active ? "text-white" : "text-text-muted"}`}>
                    {roleCount(tab.key)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {isError && (
          <Card className="mb-3">
            <Text className="text-sm text-danger font-inter mb-2">{listError?.message || "Failed to load users"}</Text>
            <Button title="Retry" variant="outline" size="sm" onPress={refresh} />
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
            <EmptyState title={search || roleFilter ? "No users match" : "No users yet"} message="Add users from the + Add button." />
          </Card>
        )}

        {!isLoading && !isEmpty && !isError && (
          <FlatList
            data={pageItems}
            keyExtractor={(item, idx) => item.id || String(idx)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
            ListFooterComponent={<Pagination compact />}
            renderItem={({ item }) => (
              <Card>
                <View className="flex-row items-center gap-3">
                  <Avatar name={`${item.firstName || ""} ${item.lastName || ""}`.trim() || item.email} size="sm" />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-text font-inter">{item.firstName} {item.lastName}</Text>
                    <Text className="text-xs text-text-muted font-inter">{item.email}</Text>
                    <Text className="text-xs text-primary font-inter mt-0.5">{ROLE_LABEL[item.role] || item.role} · {item.status}</Text>
                  </View>
                  <Pressable onPress={() => openEdit(item)} className="px-2 py-1">
                    <Text className="text-sm text-primary font-medium font-inter">Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)} className="px-2 py-1">
                    <Text className="text-sm text-danger font-medium font-inter">Del</Text>
                  </Pressable>
                </View>
              </Card>
            )}
          />
        )}
      </View>

      <UserModal visible={modalVisible} user={editing} onClose={() => setModalVisible(false)} />
    </AppShell>
  );
}
