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
import Skeleton from "../../../src/components/Skeleton";
import EmptyState from "../../../src/components/EmptyState";
import Select from "../../../src/components/Select";
import AddMachineModal from "../../../src/components/AddMachineModal";
import BusyRow from "../../../src/components/BusyRow";
import { useBreakpoint } from "../../../src/hooks/useBreakpoint";
import { useDark } from "../../../src/hooks/useDark";
import { useRole, PERMISSIONS } from "../../../src/hooks/useRole";
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
import { useSearch } from "../../../src/hooks/useSearch";

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
  const { canAccess, homeRoute, hasPermission } = useRole();
  const dark = useDark();
  const isDesktop = breakpoint === "desktop";
  const canWrite = hasPermission(PERMISSIONS.MACHINE_WRITE);
  const canReadMachines = canAccess("machines");

  const { list, status, error, filters, counts, pagination } = useAppSelector((s) => s.machine);
  const { list: zones } = useAppSelector((s) => s.zone);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [searchInput, setSearchInput] = useState(filters.search || "");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  // Client-side full-text search across all columns (complements server ?search=)
  const filteredList = useSearch(list, [
    "name", "code", "machineCode", "type", "status", "zoneName", "description",
  ], searchInput);

  function query(nextPage = page) {
    return {
      status: filters.status || undefined,
      search: filters.search || undefined,
      zoneId: filters.zoneId || undefined,
      page: nextPage,
      size: PAGE_SIZE,
    };
  }

  // Keep the visible input in sync when search is set elsewhere (e.g. TopBar).
  useEffect(() => {
    setSearchInput(filters.search || "");
  }, [filters.search]);

  // Zones for the zone filter + create/edit modal dropdown. Zones rarely
  // change — only fetch when cold so every navigation back to this screen
  // doesn't re-request them (review: slow screens).
  useEffect(() => {
    if (!canReadMachines) return;
    if ((zones || []).length === 0) dispatch(fetchZones());
    dispatch(fetchMachineCounts());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, canReadMachines]);

  // Fetch on mount and on filter/page/permission change (all server-side).
  // Re-runs when permissions flip (e.g. granted from another device) so
  // data appears without any reload.
  useEffect(() => {
    if (!canReadMachines) return;
    dispatch(fetchMachines(query()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, filters.status, filters.search, filters.zoneId, page, canReadMachines]);

  // Settings → Machines → auto-refresh interval (review: "add the machines
  // settings"): silently refetch the current page every N seconds when set.
  const autoRefreshSeconds = useAppSelector((s) => s.settings.machines?.autoRefreshSeconds || 0);
  useEffect(() => {
    if (!canReadMachines || !autoRefreshSeconds) return undefined;
    const timer = setInterval(() => dispatch(fetchMachines(query())), autoRefreshSeconds * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, autoRefreshSeconds, canReadMachines, filters.status, filters.search, filters.zoneId, page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setPage(0);
        dispatch(setFilters({ search: searchInput }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, dispatch, filters.search]);

  function handleTabPress(statusKey) {
    setPage(0);
    dispatch(setFilters({ status: statusKey }));
  }

  function handleZoneChange(zoneId) {
    setPage(0);
    dispatch(setFilters({ zoneId }));
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
    // Server is truth after any save (create/update normalize fields) —
    // refresh the current page + tab counts so nothing needs a reload.
    dispatch(fetchMachines(query()));
    dispatch(fetchMachineCounts());
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
      dispatch(fetchMachines(query()));
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

  const totalPages = Math.max(1, pagination?.totalPages || 1);
  const totalElements = pagination?.totalElements ?? list.length;
  const safePage = Math.min(page, totalPages - 1);

  function goPage(next) {
    setPage(Math.max(0, Math.min(totalPages - 1, next)));
  }

  function Pager() {
    if (totalPages <= 1) return null;
    const prevDisabled = safePage === 0;
    const nextDisabled = safePage >= totalPages - 1;
    return (
      <View className="flex-row items-center justify-center mt-4 gap-5">
        <Pressable
          onPress={() => goPage(safePage - 1)}
          disabled={prevDisabled}
          className={`px-4 py-1.5 rounded-btn ${prevDisabled ? (dark ? "bg-white/5 border border-white/15 opacity-40" : "bg-bg border border-border opacity-40") : "bg-primary"}`}
        >
          <Text className={`text-sm font-bold font-inter ${prevDisabled ? (dark ? "text-white/50" : "text-text-muted") : "text-white"}`}>‹ Prev</Text>
        </Pressable>
        <Text className={`text-sm font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
          Page <Text className={`font-bold font-inter ${dark ? "text-white" : "text-text"}`}>{safePage + 1}</Text> of {totalPages} · <Text className={`font-bold font-inter ${dark ? "text-white" : "text-text"}`}>{totalElements} machine{totalElements === 1 ? "" : "s"}</Text>
        </Text>
        <Pressable
          onPress={() => goPage(safePage + 1)}
          disabled={nextDisabled}
          className={`px-4 py-1.5 rounded-btn ${nextDisabled ? (dark ? "bg-white/5 border border-white/15 opacity-40" : "bg-bg border border-border opacity-40") : "bg-primary"}`}
        >
          <Text className={`text-sm font-bold font-inter ${nextDisabled ? (dark ? "text-white/50" : "text-text-muted") : "text-white"}`}>Next ›</Text>
        </Pressable>
      </View>
    );
  }

  const isLoading = status === "loading";
  // Cold load (nothing on screen yet) → skeletons. A fetch that runs while
  // rows are already visible (search typing, tab/zone filter change) keeps
  // the stale rows but dimmed + a BusyRow, so no layout flash while typing.
  const isLoadingCold = isLoading && list.length === 0;
  const isRefreshing = isLoading && list.length > 0;
  const isEmpty = status === "succeeded" && list.length === 0;
  const isError = status === "error";

  if (!canAccess("machines")) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            title="Restricted area"
            message="Machines require the MACHINE_READ permission."
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
            {canWrite && (
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
                      active ? "bg-primary" : dark ? "bg-white/5 border border-white/15" : "bg-bg"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium font-inter ${
                        active ? "text-white" : dark ? "text-white/60" : "text-text-muted"
                      }`}
                    >
                      {tab.label}
                    </Text>
                    <View
                      className={`min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ${
                        active ? "bg-white/20" : dark ? "bg-white/10" : "bg-border"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-semibold font-inter ${
                          active ? "text-white" : dark ? "text-white/60" : "text-text-muted"
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
                  onValueChange={handleZoneChange}
                  placeholder="All Zones"
                  options={[{ value: null, label: "All Zones" }, ...(zones || []).map((z) => ({ value: z.id, label: z.name }))]}
                />
              </View>
              <View className={`flex-row items-center border rounded-btn px-3 py-1.5 gap-2 ${dark ? "bg-white/5 border-white/15" : "bg-bg border-border"}`} style={{ width: 220 }}>
                <Text className={`text-sm ${dark ? "text-white/50" : "text-text-muted"}`}>🔍</Text>
                <TextInput
                  className={`flex-1 text-sm font-inter ${dark ? "text-white" : "text-text"}`}
                placeholder="Search by name, code, type, zone, status…"
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
                  onPress={() => dispatch(fetchMachines(query()))}
                />
              </View>
            </Card>
          )}

          {/* Loading skeleton — cold load only (no data on screen yet) */}
          {isLoadingCold && (
            <Card>
              {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} className={`flex-row items-center gap-4 py-3 border-b ${dark ? "border-white/10" : "border-border"}`}>
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
                  canWrite && !filters.status && !filters.search ? (
                    <Button title="+ Add Machine" variant="primary" size="sm" onPress={openCreate} />
                  ) : null
                }
              />
            </Card>
          )}

          {/* Refresh feedback while old rows are on screen */}
          {isRefreshing && <BusyRow label="Updating machines…" className="mb-2" />}

          {/* Table — stays visible (dimmed) while a refresh fetch runs */}
          {!isEmpty && !isError && !isLoadingCold && (
            <Card className="overflow-hidden p-0" style={isRefreshing ? { opacity: 0.6 } : undefined}>
              {/* Header */}
              <View className={`flex-row items-center px-4 py-3 border-b ${dark ? "border-white/10 bg-white/5" : "border-border bg-bg"}`}>
                <Text className={`w-20 text-xs font-semibold font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>ID</Text>
                <Text className={`flex-1 text-xs font-semibold font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>Name</Text>
                <Text className={`w-24 text-xs font-semibold font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>Type</Text>
                <Text className={`w-20 text-xs font-semibold font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>Zone</Text>
                <Text className={`w-28 text-xs font-semibold font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>Status</Text>
                <Text className={`w-28 text-xs font-semibold font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>Last Update</Text>
                {canWrite && (
                  <Text className={`w-24 text-xs font-semibold font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>Actions</Text>
                )}
              </View>
              {/* Rows */}
              {list.map((machine, idx) => (
                <Pressable
                  key={machine.id || idx}
                  onPress={() => handleRowPress(machine)}
                  className={`flex-row items-center px-4 py-3 border-b ${dark ? "border-white/10" : "border-border"} ${
                    dark ? (idx % 2 === 0 ? "" : "bg-white/5") : idx % 2 === 0 ? "bg-surface" : "bg-bg/50"
                  }`}
                  style={({ pressed }) => (pressed ? { backgroundColor: dark ? "rgba(255,255,255,0.08)" : "#F0F4FA" } : {})}
                >
                  <Text className="w-20 text-sm font-semibold text-primary font-inter" numberOfLines={1}>
                    {machine.code || machine.machineCode || machine.id}
                  </Text>
                  <Text className={`flex-1 text-sm font-inter ${dark ? "text-white" : "text-text"}`} numberOfLines={1}>
                    {machine.name}
                  </Text>
                  <Text className={`w-24 text-sm font-inter ${dark ? "text-white/60" : "text-text-muted"}`} numberOfLines={1}>
                    {machine.type || "—"}
                  </Text>
                  <Text className={`w-20 text-sm font-inter ${dark ? "text-white/60" : "text-text-muted"}`} numberOfLines={1}>
                    {machine.zoneName || machine.zone || "—"}
                  </Text>
                  <View className="w-28">
                    <StatusBadge status={machine.status} />
                  </View>
                  <Text className={`w-28 text-xs font-inter ${dark ? "text-white/60" : "text-text-muted"}`} numberOfLines={1}>
                    {machine.updatedAt || machine.lastUpdate ? relativeTime(machine.updatedAt || machine.lastUpdate) : "—"}
                  </Text>
                  {canWrite && (
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

          {!isLoadingCold && !isError && <Pager />}
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
          {canWrite && (
            <Pressable
              onPress={openCreate}
              className="px-4 py-2 rounded-chip bg-primary"
            >
              <Text className="text-xs font-semibold text-white font-inter">+ Add Machine</Text>
            </Pressable>
          )}
        </View>

        {/* Search bar */}
        <View className={`flex-row items-center border rounded-btn px-3 py-1.5 gap-2 mb-3 ${dark ? "bg-white/5 border-white/15" : "bg-surface border-border"}`}>
          <Text className={`text-sm ${dark ? "text-white/50" : "text-text-muted"}`}>🔍</Text>
          <TextInput
            className={`flex-1 text-sm font-inter ${dark ? "text-white" : "text-text"}`}
            placeholder="Search by name, code, type, zone, status…"
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
                  active ? "bg-primary" : dark ? "bg-white/5 border border-white/15" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`text-xs font-medium font-inter ${
                    active ? "text-white" : dark ? "text-white/60" : "text-text-muted"
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
            onValueChange={(v) => handleZoneChange(v)}
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
            <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchMachines(query()))} />
          </Card>
        )}

        {/* Loading — cold load only */}
        {isLoadingCold && (
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

        {/* Refresh feedback while old cards are on screen */}
        {isRefreshing && <BusyRow label="Updating machines…" className="mb-2" />}

        {/* Card list — dimmed while refreshing */}
        {!isEmpty && !isError && !isLoadingCold && (
          <FlatList
            data={list}
            keyExtractor={(item, idx) => item.id || String(idx)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
            style={isRefreshing ? { opacity: 0.6 } : undefined}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleRowPress(item)}>
                <Card>
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-3">
                      <Text className={`text-sm font-semibold font-inter ${dark ? "text-white" : "text-text"}`}>
                        {item.code || item.machineCode || item.id}
                      </Text>
                      <Text className={`text-xs font-inter mt-0.5 ${dark ? "text-white/60" : "text-text-muted"}`}>
                        {item.name || item.type || "—"}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>
                  <Text className={`text-[11px] font-inter mt-2 ${dark ? "text-white/50" : "text-text-muted"}`}>
                    Last update {item.updatedAt || item.lastUpdate ? relativeTime(item.updatedAt || item.lastUpdate) : "—"}
                  </Text>
                  {canWrite && (
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

        {!isLoadingCold && !isError && <Pager />}
      </View>

      <AddMachineModal visible={showAddModal} machine={editingMachine} onClose={handleCloseModal} />
    </AppShell>
  );
}
