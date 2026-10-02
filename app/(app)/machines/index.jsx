// app/(app)/machines/index.jsx
//
// Machines List — web + mobile, same file.
// Web:  Table with tabs (All/Running/Idle/Maintenance/Failure/Offline), search, "Add Machine" (ADMIN).
// Mobile: Search + filter chips + card list.
//
// Dispatches fetchMachines on mount + filter change. Filters live in machineSlice.

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../../src/components/AppShell";
import Card from "../../../src/components/Card";
import Button from "../../../src/components/Button";
import StatusBadge from "../../../src/components/StatusBadge";
import HealthBar from "../../../src/components/HealthBar";
import Skeleton from "../../../src/components/Skeleton";
import EmptyState from "../../../src/components/EmptyState";
import Select from "../../../src/components/Select";
import AddMachineModal from "../../../src/components/AddMachineModal";
import { useBreakpoint } from "../../../src/hooks/useBreakpoint";
import { useDark } from "../../../src/hooks/useDark";
import { useRole } from "../../../src/hooks/useRole";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import {
  fetchMachines,
  fetchMachineCounts,
  deleteMachine,
  setFilters,
} from "../../../src/store/slices/machineSlice";
import { fetchZones } from "../../../src/store/slices/zoneSlice";
import { useDialog } from "../../../src/components/dialog/DialogContext";
import { relativeTime } from "../../../src/lib/time";

const STATUS_TABS = [
  { key: null, label: "All" },
  { key: "RUNNING", label: "Running" },
  { key: "IDLE", label: "Idle" },
  { key: "MAINTENANCE", label: "Maintenance" },
  { key: "FAILURE", label: "Failure" },
  { key: "OFFLINE", label: "Offline" },
];

export default function MachinesListScreen() {
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const { isAdmin, canAccess, homeRoute } = useRole();
  const dark = useDark();
  const isDesktop = breakpoint === "desktop";

  const { list, status, error, filters, counts } = useAppSelector((s) => s.machine);
  const { list: zones } = useAppSelector((s) => s.zone);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [searchInput, setSearchInput] = useState(filters.search || "");

  // Keep the visible input in sync when search is set elsewhere (e.g. TopBar).
  useEffect(() => {
    setSearchInput(filters.search || "");
  }, [filters.search]);

  // Zones for the zone filter + create/edit modal dropdown
  useEffect(() => {
    dispatch(fetchZones());
    dispatch(fetchMachineCounts());
  }, [dispatch]);

  // Fetch on mount and on filter change (status/search/zone all server-side)
  useEffect(() => {
    dispatch(
      fetchMachines({
        status: filters.status || undefined,
        search: filters.search || undefined,
        zoneId: filters.zoneId || undefined,
      })
    );
  }, [dispatch, filters.status, filters.search, filters.zoneId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        dispatch(setFilters({ search: searchInput }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, dispatch, filters.search]);

  function handleTabPress(statusKey) {
    dispatch(setFilters({ status: statusKey }));
  }

  function handleRowPress(machine) {
    router.push(`/(app)/machines/${machine.id}`);
  }

  function handleEdit(machine) {
    setEditingMachine(machine);
    setShowAddModal(true);
  }

  function openCreate() {
    setEditingMachine(null);
    setShowAddModal(true);
  }

  function handleCloseModal() {
    setShowAddModal(false);
    setEditingMachine(null);
  }

  async function handleDelete(machine) {
    const ok = await dialog.confirm("Delete machine", `Remove ${machine.code || machine.id}? This cannot be undone.`, {
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await dispatch(deleteMachine(machine.id)).unwrap();
      dispatch(fetchMachineCounts());
      dispatch(fetchMachines({
        status: filters.status || undefined,
        search: filters.search || undefined,
        zoneId: filters.zoneId || undefined,
      }));
    } catch {
      // Slice error state surfaces the failure.
    }
  }

  // Tab badges come from the unfiltered counts fetch — they stay stable
  // no matter which status/search/zone filter is active.
  function getCount(statusKey) {
    const key = statusKey || "ALL";
    if (counts && counts[key] != null) return counts[key];
    if (!statusKey) return list.length;
    return list.filter((m) => m.status === statusKey).length;
  }

  const isLoading = status === "loading";
  const isEmpty = status === "succeeded" && list.length === 0;
  const isError = status === "error";

  if (!canAccess("machines")) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            title="Restricted area"
            message="Machines are visible to administrators and responsables industriels."
            action={<Button title="Go to Factory Map" variant="primary" size="sm" onPress={() => router.replace(homeRoute)} />}
          />
        </Card>
      </AppShell>
    );
  }

  // ── WEB LAYOUT ────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <AppShell>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="flex-row items-center justify-between mb-5">
            <Text className={`text-2xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>Machines</Text>
            {isAdmin && (
              <Button
                title="+ Add Machine"
                variant="primary"
                size="sm"
                onPress={openCreate}
              />
            )}
          </View>

          {/* Tabs + Zone + Search row */}
          <View className="flex-row items-center justify-between mb-4 gap-3">
            <View className="flex-row gap-1 flex-1 flex-wrap">
              {STATUS_TABS.map((tab) => {
                const active = filters.status === tab.key;
                const count = getCount(tab.key);
                return (
                  <Pressable
                    key={tab.label}
                    onPress={() => handleTabPress(tab.key)}
                    className={`px-3 py-1.5 rounded-chip flex-row items-center gap-1.5 ${
                      active ? "bg-primary" : "bg-bg"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium font-inter ${
                        active ? "text-white" : "text-text-muted"
                      }`}
                    >
                      {tab.label}
                    </Text>
                    <View
                      className={`min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ${
                        active ? "bg-white/20" : "bg-border"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-semibold font-inter ${
                          active ? "text-white" : "text-text-muted"
                        }`}
                      >
                        {count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Zone filter + Search */}
            <View className="flex-row items-center gap-2">
              <View style={{ width: 160 }}>
                <Select
                  value={filters.zoneId}
                  onValueChange={(v) => dispatch(setFilters({ zoneId: v }))}
                  placeholder="All Zones"
                  options={[{ value: null, label: "All Zones" }, ...(zones || []).map((z) => ({ value: z.id, label: z.name }))]}
                />
              </View>
              <View className="flex-row items-center bg-bg border border-border rounded-btn px-3 py-2 gap-2" style={{ width: 220 }}>
                <Text className="text-text-muted text-sm">🔍</Text>
                <TextInput
                  className="flex-1 text-sm text-text font-inter"
                  placeholder="Search machines..."
                  placeholderTextColor="#94A3B8"
                  value={searchInput}
                  onChangeText={setSearchInput}
                  style={{ outlineStyle: "none" }}
                />
              </View>
            </View>
          </View>

          {/* Error */}
          {isError && (
            <Card className="mb-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-danger font-inter">
                  {error?.message || "Failed to load machines"}
                </Text>
                <Button
                  title="Retry"
                  variant="outline"
                  size="sm"
                  onPress={() => dispatch(fetchMachines({ status: filters.status, search: filters.search }))}
                />
              </View>
            </Card>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <Card>
              {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} className="flex-row items-center gap-4 py-3 border-b border-border">
                  <Skeleton width={60} height={14} />
                  <Skeleton width={120} height={14} />
                  <Skeleton width={60} height={14} />
                  <Skeleton width={50} height={14} />
                  <Skeleton width={70} height={24} />
                  <Skeleton width={80} height={14} />
                  <Skeleton width={70} height={14} />
                </View>
              ))}
            </Card>
          )}

          {/* Empty */}
          {isEmpty && !isLoading && (
            <Card>
              <EmptyState
                title={filters.status || filters.search ? "No machines match" : "No machines yet"}
                message={
                  filters.status || filters.search
                    ? "Try changing the filters or search term."
                    : "Add your first machine to get started."
                }
                action={
                  isAdmin && !filters.status && !filters.search ? (
                    <Button title="+ Add Machine" variant="primary" size="sm" onPress={openCreate} />
                  ) : null
                }
              />
            </Card>
          )}

          {/* Table */}
          {!isLoading && !isEmpty && !isError && (
            <Card className="overflow-hidden p-0">
              {/* Header */}
              <View className="flex-row items-center px-4 py-3 border-b border-border bg-bg">
                <Text className="w-20 text-xs font-semibold text-text-muted font-inter">ID</Text>
                <Text className="flex-1 text-xs font-semibold text-text-muted font-inter">Name</Text>
                <Text className="w-24 text-xs font-semibold text-text-muted font-inter">Type</Text>
                <Text className="w-20 text-xs font-semibold text-text-muted font-inter">Zone</Text>
                <Text className="w-28 text-xs font-semibold text-text-muted font-inter">Status</Text>
                <Text className="w-32 text-xs font-semibold text-text-muted font-inter">Health</Text>
                <Text className="w-28 text-xs font-semibold text-text-muted font-inter">Last Update</Text>
                {isAdmin && (
                  <Text className="w-24 text-xs font-semibold text-text-muted font-inter">Actions</Text>
                )}
              </View>
              {/* Rows */}
              {list.map((machine, idx) => (
                <Pressable
                  key={machine.id || idx}
                  onPress={() => handleRowPress(machine)}
                  className={`flex-row items-center px-4 py-3 border-b border-border ${
                    idx % 2 === 0 ? "bg-surface" : "bg-bg/50"
                  }`}
                  style={({ pressed }) => (pressed ? { backgroundColor: "#F0F4FA" } : {})}
                >
                  <Text className="w-20 text-sm font-semibold text-primary font-inter" numberOfLines={1}>
                    {machine.code || machine.machineCode || machine.id}
                  </Text>
                  <Text className="flex-1 text-sm text-text font-inter" numberOfLines={1}>
                    {machine.name}
                  </Text>
                  <Text className="w-24 text-sm text-text-muted font-inter" numberOfLines={1}>
                    {machine.type || "—"}
                  </Text>
                  <Text className="w-20 text-sm text-text-muted font-inter" numberOfLines={1}>
                    {machine.zoneName || machine.zone || "—"}
                  </Text>
                  <View className="w-28">
                    <StatusBadge status={machine.status} />
                  </View>
                  <View className="w-32">
                    <HealthBar value={machine.health} />
                  </View>
                  <Text className="w-28 text-xs text-text-muted font-inter" numberOfLines={1}>
                    {machine.updatedAt || machine.lastUpdate ? relativeTime(machine.updatedAt || machine.lastUpdate) : "—"}
                  </Text>
                  {isAdmin && (
                    <View className="w-24 flex-row gap-1">
                      <Pressable
                        onPress={(e) => { e.stopPropagation?.(); handleEdit(machine); }}
                        className="px-2 py-1"
                      >
                        <Text className="text-xs text-primary font-medium font-inter">Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={(e) => { e.stopPropagation?.(); handleDelete(machine); }}
                        className="px-2 py-1"
                      >
                        <Text className="text-xs text-danger font-medium font-inter">Delete</Text>
                      </Pressable>
                    </View>
                  )}
                </Pressable>
              ))}
            </Card>
          )}
        </ScrollView>

        <AddMachineModal visible={showAddModal} machine={editingMachine} onClose={handleCloseModal} />
      </AppShell>
    );
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────
  return (
    <AppShell>
      <View className="flex-1">
        {/* Title + Add */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className={`text-xl font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
            Machines
          </Text>
          {isAdmin && (
            <Pressable
              onPress={openCreate}
              className="px-4 py-2 rounded-chip bg-primary"
            >
              <Text className="text-xs font-semibold text-white font-inter">+ Add Machine</Text>
            </Pressable>
          )}
        </View>

        {/* Search bar */}
        <View className="flex-row items-center bg-surface border border-border rounded-btn px-3 py-2 gap-2 mb-3">
          <Text className="text-text-muted text-sm">🔍</Text>
          <TextInput
            className="flex-1 text-sm text-text font-inter"
            placeholder="Search machines..."
            placeholderTextColor="#94A3B8"
            value={searchInput}
            onChangeText={setSearchInput}
            style={{ outlineStyle: "none" }}
          />
        </View>

        {/* All status filters, wrapped in rows */}
        <View className="flex-row flex-wrap gap-2 mb-3">
          {STATUS_TABS.map((tab) => {
            const active = filters.status === tab.key;
            const count = getCount(tab.key);
            return (
              <Pressable
                key={tab.label}
                onPress={() => handleTabPress(tab.key)}
                className={`px-3 py-2 rounded-chip flex-row items-center gap-1.5 ${
                  active ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`text-xs font-medium font-inter ${
                    active ? "text-white" : "text-text-muted"
                  }`}
                >
                  {tab.label} · {count}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Zone filter */}
        <View className="mb-3">
          <Select
            value={filters.zoneId}
            onValueChange={(v) => dispatch(setFilters({ zoneId: v }))}
            placeholder="All Zones"
            options={[{ value: null, label: "All Zones" }, ...(zones || []).map((z) => ({ value: z.id, label: z.name }))]}
          />
        </View>

        {/* Error */}
        {isError && (
          <Card className="mb-3">
            <Text className="text-sm text-danger font-inter mb-2">
              {error?.message || "Failed to load machines"}
            </Text>
            <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchMachines({ status: filters.status, search: filters.search }))} />
          </Card>
        )}

        {/* Loading */}
        {isLoading && (
          <View className="gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <Skeleton width="40%" height={16} className="mb-2" />
                <Skeleton width="60%" height={12} className="mb-3" />
                <Skeleton width="100%" height={8} />
              </Card>
            ))}
          </View>
        )}

        {/* Empty */}
        {isEmpty && !isLoading && (
          <Card>
            <EmptyState
              title={filters.status || filters.search ? "No machines match" : "No machines yet"}
              message={
                filters.status || filters.search
                  ? "Try changing the filters."
                  : "Add your first machine to start monitoring."
              }
            />
          </Card>
        )}

        {/* Card list */}
        {!isLoading && !isEmpty && !isError && (
          <FlatList
            data={list}
            keyExtractor={(item, idx) => item.id || String(idx)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleRowPress(item)}>
                <Card>
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-3">
                      <Text className="text-sm font-semibold text-text font-inter">
                        {item.code || item.machineCode || item.id}
                      </Text>
                      <Text className="text-xs text-text-muted font-inter mt-0.5">
                        {item.name || item.type || "—"}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                  <HealthBar value={item.health} />
                  <Text className="text-[11px] text-text-muted font-inter mt-2">
                    Last update {item.updatedAt || item.lastUpdate ? relativeTime(item.updatedAt || item.lastUpdate) : "—"}
                  </Text>
                  {isAdmin && (
                    <View className="flex-row gap-4 mt-2">
                      <Pressable onPress={() => handleEdit(item)}>
                        <Text className="text-xs text-primary font-medium font-inter">Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDelete(item)}>
                        <Text className="text-xs text-danger font-medium font-inter">Delete</Text>
                      </Pressable>
                    </View>
                  )}
                </Card>
              </Pressable>
            )}
          />
        )}
      </View>

      <AddMachineModal visible={showAddModal} machine={editingMachine} onClose={handleCloseModal} />
    </AppShell>
  );
}
