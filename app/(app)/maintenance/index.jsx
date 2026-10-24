// app/(app)/maintenance/index.jsx
//
// Maintenance — web + mobile (Sprint 6, CONFIRMED MaintenanceController).
// Lives in the maintenance/ directory (index + [id] + _layout) to match
// machines/ — a sibling maintenance.jsx would register a duplicate screen.
//
// Tabs: Interventions · Schedule.
//  Web: title + primary "Create Intervention", filters row (status / type /
//       search), table Ref · Machine · Intervention · Type · Priority ·
//       Status · Date.
//  Mobile: tabs as chips, search + selects, card list per intervention.
//
// Server filters (CONFIRMED params): type + status. Priority and free-text
// search are NOT server params — they filter client-side over the fetched
// page. The backend has no intervention code field, so rows show `INT-…`
// derived from the Mongo id.
//
// Roles: only RESPONSABLE_INDUSTRIEL creates interventions. TECHNICIAN and
// RESPONSABLE_INDUSTRIEL edit them with different scopes (execution vs.
// details/assignment/closure — see [id].jsx). ADMIN and every non-OPERATOR
// role can consult the list; OPERATOR has no access.

import { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AppShell from "../../../src/components/AppShell";
import Card from "../../../src/components/Card";
import Button from "../../../src/components/Button";
import Select from "../../../src/components/Select";
import Tabs from "../../../src/components/Tabs";
import Skeleton from "../../../src/components/Skeleton";
import EmptyState from "../../../src/components/EmptyState";
import InterventionModal from "../../../src/components/InterventionModal";
import BusyRow from "../../../src/components/BusyRow";
import { useBreakpoint } from "../../../src/hooks/useBreakpoint";
import { useDark } from "../../../src/hooks/useDark";
import { useRole } from "../../../src/hooks/useRole";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import {
  fetchInterventions,
  setFilters,
} from "../../../src/store/slices/interventionSlice";
import {
  getTicketPriority,
  getTicketStatus,
  INTERVENTION_TYPE_LABELS,
  PREVENTIVE_SUBTYPE_LABELS,
} from "../../../src/lib/status";
import { formatDate } from "../../../src/lib/time";

const SCREEN_TABS = [
  { key: "interventions", label: "Interventions" },
  { key: "schedule", label: "Schedule" },
];

const STATUS_OPTIONS = [
  { value: null, label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const TYPE_OPTIONS = [
  { value: null, label: "All Types" },
  { value: "CORRECTIVE", label: INTERVENTION_TYPE_LABELS.CORRECTIVE },
  { value: "PREVENTIVE", label: INTERVENTION_TYPE_LABELS.PREVENTIVE },
  { value: "IMPROVEMENT", label: INTERVENTION_TYPE_LABELS.IMPROVEMENT },
];

const PRIORITY_OPTIONS = [
  { value: null, label: "All Priorities" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

function intCode(t) {
  return `INT-${String(t.id).slice(0, 6).toUpperCase()}`;
}

/** "Mon 21 Oct 2026 · Today / Tomorrow" for the Schedule tab headers. */
function formatScheduleDay(day) {
  const d = new Date(`${day}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - today) / 86400000);
  const label = d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (diffDays === 0) return `${label} · Today`;
  if (diffDays === 1) return `${label} · Tomorrow`;
  if (diffDays === -1) return `${label} · Yesterday`;
  return label;
}

function machineLabel(t) {
  return t.machineCode || (t.machineId ? String(t.machineId).slice(0, 8) : "—");
}

function typeLabel(t) {
  return INTERVENTION_TYPE_LABELS[t.type] || t.type || "—";
}

function subtypeLabel(t) {
  if (t.type !== "PREVENTIVE" || !t.preventiveSubtype) return null;
  return PREVENTIVE_SUBTYPE_LABELS[t.preventiveSubtype] || t.preventiveSubtype;
}

export default function MaintenanceScreen() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useLocalSearchParams();
  const isDesktop = useBreakpoint() === "desktop";
  const dark = useDark();
  const { canAccess, homeRoute, role, user } = useRole();

  const { list, status, error, filters, pagination } = useAppSelector((s) => s.maintenance);
  const [tab, setTab] = useState("interventions");
  const [searchInput, setSearchInput] = useState(filters.search || "");
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState({});

  // Only the responsable industriel creates interventions (product rule).
  // ADMIN consults, TECHNICIAN executes; the backend is the final guard.
  const canCreate = role === "RESPONSABLE_INDUSTRIEL";

  // "Create Intervention" opened from the Alerts screen carries the alert
  // context (alert → intervention link):
  // /(app)/maintenance?alertId=…&machineId=…&message=…&priority=…
  useEffect(() => {
    if (!canCreate) return;
    if (params.alertId || params.machineCode || params.message) {
      setCreatePrefill({
        alertId: params.alertId || undefined,
        machineId: params.machineId || undefined,
        machineCode: params.machineCode || undefined,
        title: params.message ? `Fix: ${params.message}` : "",
        description: params.description || "",
        priority: params.priority || undefined,
      });
      setCreateOpen(true);
      // Clear the params so a later re-render / tab switch doesn't re-open it.
      router.setParams?.({ alertId: undefined, machineCode: undefined, message: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.alertId, params.machineCode, params.message, canCreate]);

  // Fetch on mount and on server-param change (CONFIRMED: status + type are
  // server params; priority + free-text search are applied client-side).
  useEffect(() => {
    if (!canAccess("maintenance")) return;
    dispatch(
      fetchInterventions({
        status: filters.status || undefined,
        type: filters.type || undefined,
        page,
        size: 100,
      })
    );
  }, [dispatch, filters.status, filters.type, page, canAccess]);

  // Debounced search.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setPage(0);
        dispatch(setFilters({ search: searchInput }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, dispatch, filters.search]);

  // NOTE: the restricted-area early return must stay BELOW every hook (the
  // useMemos) — on logout canAccess() flips false and an early return
  // above a hook throws "Rendered fewer hooks than expected".
  //
  // Per-user scope (review): every connected user sees only the interventions
  // assigned to them or created by them. ADMIN keeps the full factory view.
  const myList = useMemo(() => {
    if (role === "ADMIN") return list;
    const keys = [user?.id, user?.email, user?.username].filter(Boolean).map(String);
    if (keys.length === 0) return list;
    const mine = (t) =>
      [t.technicianId, ...(Array.isArray(t.technicianIds) ? t.technicianIds : []), t.assignedBy]
        .filter(Boolean)
        .some((v) => keys.includes(String(v)));
    return list.filter((t) => mine(t));
  }, [list, role, user]);

  const loading = status === "loading" && list.length === 0;
  // Refresh state — a fetch running while rows are already on screen
  // (filter change). No layout flash: BusyRow + dim.
  const refreshing = status === "loading" && list.length > 0;
  const searchPending = searchInput !== (filters.search || "");
  const empty = status !== "loading" && !error && myList.length === 0;
  const failed = status === "error" && list.length === 0;
  // 403 means the role is missing MAINTENANCE_READ (backend role table) —
  // that is a permission problem, not a network problem, and retrying will
  // never help. Say so instead of "check your connection".
  const forbidden = failed && (error?.status === 403 || error?.code === "FORBIDDEN");
  const darkText = dark ? "text-white" : "text-text";
  const darkMuted = dark ? "text-white/60" : "text-text-muted";

  // Client-side filters (not server params): priority + free-text search.
  const visibleList = useMemo(
    () =>
      myList.filter((t) => {
        if (filters.priority && t.priority !== filters.priority) return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const hay = [intCode(t), t.title, t.description, machineLabel(t), typeLabel(t)]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [myList, filters.priority, filters.search]
  );
  const clientFiltered = Boolean(filters.priority || filters.search);

  // Filter options with LIVE COUNTS (review: "add numbers count in
  // interventions filters"). Counts run over an UNFILTERED snapshot of the
  // list: status/type are SERVER params (fetch effect above), so picking one
  // filter shrinks `myList` to just that subset and every other count would
  // read 0 (review: "when i select a filter the other filters count become
  // 0"). The snapshot only refreshes while no status/type filter is active,
  // so the numbers stay stable while the user compares options.
  const [countBase, setCountBase] = useState([]);
  useEffect(() => {
    if (!filters.status && !filters.type) setCountBase(myList);
  }, [myList, filters.status, filters.type]);
  const countOf = (field, value) => countBase.filter((t) => t[field] === value).length;
  // Compact labels ("All (12)", "Pending (3)") — the mobile width can't fit
  // "All Statuses (12)" (review: "filters count not seen in mobile"). The
  // empty-value option carries the total so the count is visible even before
  // any filter is picked.
  const statusOptions = useMemo(
    () =>
      STATUS_OPTIONS.filter((o) => o.value).map((o) => ({
        ...o,
        label: `${o.label} (${countOf("status", o.value)})`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countBase]
  );
  const typeOptions = useMemo(
    () =>
      TYPE_OPTIONS.filter((o) => o.value).map((o) => ({
        ...o,
        label: `${o.label} (${countOf("type", o.value)})`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countBase]
  );
  const priorityOptions = useMemo(
    () =>
      PRIORITY_OPTIONS.filter((o) => o.value).map((o) => ({
        ...o,
        label: `${o.label} (${countOf("priority", o.value)})`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countBase]
  );

  // Schedule tab: interventions that carry a planned date, grouped by day.
  const scheduleGroups = useMemo(() => {
    const planned = myList
      .filter((t) => t.scheduledAt && t.status !== "COMPLETED" && t.status !== "CANCELLED")
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const groups = new Map();
    planned.forEach((t) => {
      const day = new Date(t.scheduledAt).toISOString().slice(0, 10);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day).push(t);
    });
    return [...groups.entries()];
  }, [myList]);

  if (!canAccess("maintenance")) {
    return (
      <AppShell>
        <Card className="my-4">
          <EmptyState
            title="Restricted area"
            message="Maintenance is available to administrators, responsables industriels and technicians."
            action={
              <Button title="Go back home" variant="primary" size="sm" onPress={() => router.replace(homeRoute)} />
            }
          />
        </Card>
      </AppShell>
    );
  }

  function openCreate(prefill = {}) {
    if (!canCreate) return;
    setCreatePrefill(prefill);
    setCreateOpen(true);
  }

  function renderTicketRow(t) {
    const pMeta = getTicketPriority(t.priority);
    const sMeta = getTicketStatus(t.status);
    const chipStyle = (color) => ({ backgroundColor: color + "1A" });

    if (!isDesktop) {
      /* Mobile card */
      return (
        <Pressable
          key={t.id}
          onPress={() => router.push(`/(app)/maintenance/${t.id}`)}
          className={`rounded-card border p-4 mb-3 ${dark ? "bg-darkcard border-white/10" : "bg-surface border-border"}`}
        >
          <View className="flex-row items-center justify-between mb-1">
            <Text className={`text-sm font-bold font-inter ${darkText}`}>{intCode(t)}</Text>
            <Text className={`text-xs font-inter ${darkMuted}`}>{formatDate(t.createdAt)}</Text>
          </View>
          <Text className={`text-xs font-inter mb-2 ${darkMuted}`}>
            {machineLabel(t)}
            {subtypeLabel(t) ? ` · ${typeLabel(t)} · ${subtypeLabel(t)}` : ` · ${typeLabel(t)}`}
          </Text>
          <Text numberOfLines={2} className={`text-sm font-inter mb-3 ${darkText}`}>
            {t.title}
          </Text>
          <View className="flex-row items-center">
            <View className="px-2 py-0.5 rounded-chip" style={chipStyle(pMeta.color)}>
              <Text className="text-[10px] font-bold font-inter" style={{ color: pMeta.color }}>
                {pMeta.label}
              </Text>
            </View>
            <View className="px-2 py-0.5 rounded-chip ml-2" style={chipStyle(sMeta.color)}>
              <Text className="text-[10px] font-bold font-inter" style={{ color: sMeta.color }}>
                {sMeta.label}
              </Text>
            </View>
            <View className="flex-1" />
            <Text className={`text-xs ${darkMuted}`}>›</Text>
          </View>
        </Pressable>
      );
    }

    /* Desktop row — Ref · Machine · Intervention · Type · Priority · Status · Date */
    return (
      <Pressable
        key={t.id}
        onPress={() => router.push(`/(app)/maintenance/${t.id}`)}
        className={`flex-row items-center px-3 py-3 border-b ${dark ? "border-white/5" : "border-border/50"}`}
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : {})}
      >
        <Text className={`text-xs font-bold font-inter ${darkText}`} style={{ width: 90 }}>
          {intCode(t)}
        </Text>
        <Text className={`text-xs font-inter ${darkText}`} style={{ width: 120 }}>
          {machineLabel(t)}
        </Text>
        <Text numberOfLines={1} className={`flex-1 text-xs font-inter ${darkText}`}>
          {t.title}
        </Text>
        <Text className={`text-xs font-inter ${darkMuted}`} style={{ width: 96 }}>
          {typeLabel(t)}
        </Text>
        <View
          className="px-2.5 py-0.5 rounded-chip justify-center"
          style={{ width: 96, marginRight: 14, backgroundColor: pMeta.color + "1A" }}
        >
          <Text className="text-[10px] font-bold font-inter text-center" style={{ color: pMeta.color }}>
            {pMeta.label}
          </Text>
        </View>
        <View
          className="px-2.5 py-0.5 rounded-chip justify-center"
          style={{ width: 104, backgroundColor: sMeta.color + "1A" }}
        >
          <Text className="text-[10px] font-bold font-inter text-center" style={{ color: sMeta.color }}>
            {sMeta.label}
          </Text>
        </View>
        <Text className={`text-xs font-inter text-right ${darkMuted}`} style={{ width: 110 }}>
          {formatDate(t.createdAt)}
        </Text>
      </Pressable>
    );
  }

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className={`mb-4 ${isDesktop ? "flex-row items-start justify-between" : ""}`}>
          <View className="mb-2">
            <Text className={`text-xl font-bold font-inter ${darkText}`}>Maintenance</Text>
            <Text className={`text-sm font-inter ${darkMuted}`}>
              Interventions, assignments and linked alerts.
            </Text>
          </View>
          {canCreate && (
            <Button
              title="+ Create Intervention"
              variant="primary"
              onPress={() => openCreate({})}
            />
          )}
        </View>

        {/* Tabs — chips on mobile, underline tabs on desktop */}
        <View className="mb-4">
          <Tabs tabs={SCREEN_TABS} active={tab} onChange={setTab} scrollable={!isDesktop} />
        </View>

        {tab === "schedule" && (
          <Card>
            {scheduleGroups.length === 0 ? (
              <EmptyState
                icon={
                  <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(37,99,235,0.08)" }}>
                    <Text className="text-3xl">📅</Text>
                  </View>
                }
                title="Nothing scheduled yet"
                message="Pick a date when creating a Preventive or Improvement intervention and it will show up here, grouped by day."
              />
            ) : (
              <View className="gap-5">
                {scheduleGroups.map(([day, rows]) => (
                  <View key={day}>
                    <Text className={`text-sm font-bold font-inter mb-2 ${darkText}`}>{formatScheduleDay(day)}</Text>
                    <View className="gap-2">
                      {rows.map((t) => {
                        const pMeta = getTicketPriority(t.priority);
                        const sMeta = getTicketStatus(t.status);
                        return (
                          <Pressable
                            key={t.id}
                            onPress={() => router.push(`/(app)/maintenance/${t.id}`)}
                            className={`flex-row items-center gap-3 p-3 rounded-btn border ${dark ? "bg-white/5 border-white/10" : "bg-bg border-border"}`}
                          >
                            <View className="items-center" style={{ width: 52 }}>
                              <Text className={`text-sm font-bold font-inter ${darkText}`}>
                                {new Date(t.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </Text>
                            </View>
                            <View className="flex-1">
                              <Text numberOfLines={1} className={`text-sm font-bold font-inter ${darkText}`}>{t.title}</Text>
                              <Text numberOfLines={1} className={`text-xs font-inter ${darkMuted}`}>
                                {machineLabel(t)} · {typeLabel(t)}
                              </Text>
                            </View>
                            <View className="px-2 py-0.5 rounded-chip" style={{ backgroundColor: pMeta.color + "1A" }}>
                              <Text className="text-[10px] font-bold font-inter" style={{ color: pMeta.color }}>{pMeta.label}</Text>
                            </View>
                            <View className="px-2 py-0.5 rounded-chip" style={{ backgroundColor: sMeta.color + "1A" }}>
                              <Text className="text-[10px] font-bold font-inter" style={{ color: sMeta.color }}>{sMeta.label}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {tab === "interventions" && (
          <View>
            {/* Filters row (status / type / priority / search) */}
            {isDesktop ? (
              <View className="flex-row items-end gap-3 mb-4">
                <View style={{ width: 160 }}>
                  <Select
                    value={filters.status}
                    onValueChange={(val) => { setPage(0); dispatch(setFilters({ status: val })); }}
                    options={[{ value: "", label: `All (${countBase.length})` }, ...statusOptions]}
                    placeholder="All Statuses"
                  />
                </View>
                <View style={{ width: 160 }}>
                  <Select
                    value={filters.type}
                    onValueChange={(val) => { setPage(0); dispatch(setFilters({ type: val })); }}
                    options={[{ value: "", label: `All (${countBase.length})` }, ...typeOptions]}
                    placeholder="All Types"
                  />
                </View>
                <View style={{ width: 160 }}>
                  <Select
                    value={filters.priority}
                    onValueChange={(val) => dispatch(setFilters({ priority: val }))}
                    options={[{ value: "", label: `All (${countBase.length})` }, ...priorityOptions]}
                    placeholder="All Priorities"
                  />
                </View>
                <View className="flex-1">
                  <SearchBox value={searchInput} onChange={setSearchInput} dark={dark} busy={searchPending || refreshing} />
                </View>
              </View>
            ) : (
              <View className="mb-3 gap-2">
                <SearchBox value={searchInput} onChange={setSearchInput} dark={dark} busy={searchPending || refreshing} />
                <View className="flex-row gap-2">
                  <View style={{ flex: 1 }}>
                    <Select
                      value={filters.status}
                      onValueChange={(val) => { setPage(0); dispatch(setFilters({ status: val })); }}
                      options={[{ value: "", label: `All (${countBase.length})` }, ...statusOptions]}
                      placeholder="All Statuses"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Select
                      value={filters.type}
                      onValueChange={(val) => { setPage(0); dispatch(setFilters({ type: val })); }}
                      options={[{ value: "", label: `All (${countBase.length})` }, ...typeOptions]}
                      placeholder="All Types"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Select
                      value={filters.priority}
                      onValueChange={(val) => dispatch(setFilters({ priority: val }))}
                      options={[{ value: "", label: `All (${countBase.length})` }, ...priorityOptions]}
                      placeholder="All Priorities"
                    />
                  </View>
                </View>
              </View>
            )}

            {refreshing && <BusyRow label="Updating interventions…" className="mb-2" />}

            <Card style={refreshing ? { opacity: 0.6 } : undefined}>
              {loading && (
                <View className="p-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} width="100%" height={44} />
                  ))}
                </View>
              )}

              {(empty || failed || (clientFiltered && visibleList.length === 0 && !loading)) && (
                <EmptyState
                  title={
                    failed
                      ? forbidden
                        ? "No access to interventions"
                        : "Interventions unavailable"
                      : clientFiltered
                        ? "No matches"
                        : "No interventions"
                  }
                  message={
                    failed
                      ? forbidden
                        ? "Your account does not have the maintenance permission yet. Ask an administrator to grant MAINTENANCE_READ, then reload this screen."
                        : "Failed to load interventions. Check your connection and retry."
                      : clientFiltered
                        ? "No intervention matches the current priority/search filters. Clear them or try another term."
                        : "No maintenance intervention matches the current status/type filters."
                  }
                  action={
                    failed && !forbidden ? (
                      <Button
                        title="Retry"
                        variant="outline"
                        size="sm"
                        onPress={() => dispatch(fetchInterventions({ page, size: 100 }))}
                      />
                    ) : undefined
                  }
                />
              )}

              {!loading && visibleList.length > 0 && !failed && (
                isDesktop ? (
                  <View>
                    {/* Table header */}
                    <View
                      className={`flex-row items-center py-2 px-3 border-b rounded-t-lg ${
                        dark ? "border-white/10 bg-white/[0.03]" : "border-border bg-slate-50"
                      }`}
                    >
                      <Text className={`text-[11px] font-bold font-inter uppercase ${darkMuted}`} style={{ width: 90, letterSpacing: 0.5 }}>Ref</Text>
                      <Text className={`text-[11px] font-bold font-inter uppercase ${darkMuted}`} style={{ width: 120, letterSpacing: 0.5 }}>Machine</Text>
                      <Text className={`flex-1 text-[11px] font-bold font-inter uppercase ${darkMuted}`} style={{ letterSpacing: 0.5 }}>Intervention</Text>
                      <Text className={`text-[11px] font-bold font-inter uppercase ${darkMuted}`} style={{ width: 96, letterSpacing: 0.5 }}>Type</Text>
                      <Text className={`text-[11px] font-bold font-inter uppercase ${darkMuted}`} style={{ width: 96, marginRight: 14, letterSpacing: 0.5 }}>Priority</Text>
                      <Text className={`text-[11px] font-bold font-inter uppercase ${darkMuted}`} style={{ width: 104, letterSpacing: 0.5 }}>Status</Text>
                      <Text className={`text-[11px] font-bold font-inter uppercase text-right ${darkMuted}`} style={{ width: 110, letterSpacing: 0.5 }}>Date</Text>
                    </View>
                    {visibleList.map(renderTicketRow)}
                    {!clientFiltered && pagination.totalPages > 1 && (
                      <View className="flex-row items-center justify-center mt-3 gap-4 py-2">
                        <Pressable
                          onPress={() => setPage((p) => Math.max(0, p - 1))}
                          disabled={page === 0}
                          className={`px-3 py-1.5 rounded-btn ${page === 0 ? "opacity-40" : ""} ${dark ? "bg-white/5" : "bg-bg"}`}
                        >
                          <Text className={`text-xs font-bold font-inter ${darkMuted}`}>‹ Prev</Text>
                        </Pressable>
                        <Text className={`text-xs font-inter ${darkMuted}`}>
                          {`Page ${page + 1} of ${pagination.totalPages}`}
                        </Text>
                        <Pressable
                          onPress={() => setPage((p) => Math.min(pagination.totalPages - 1, p + 1))}
                          disabled={page >= pagination.totalPages - 1}
                          className={`px-3 py-1.5 rounded-btn ${page >= pagination.totalPages - 1 ? "opacity-40" : ""} ${dark ? "bg-white/5" : "bg-bg"}`}
                        >
                          <Text className={`text-xs font-bold font-inter ${darkMuted}`}>Next ›</Text>
                        </Pressable>
                      </View>
                    )}
                    {clientFiltered && (
                      <Text className={`text-xs font-inter py-2 text-center ${darkMuted}`}>
                        {`${visibleList.length} of ${pagination.totalElements} interventions shown (priority/search filter applied)`}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View>{visibleList.map((t) => renderTicketRow(t))}</View>
                )
              )}
            </Card>
          </View>
        )}

        {/* Create intervention modal (centered on web, bottom sheet on mobile) */}
        <InterventionModal visible={createOpen} prefill={createPrefill} onClose={() => setCreateOpen(false)} />
      </ScrollView>
    </AppShell>
  );
}

/** Inline search box with live "searching" feedback. */
function SearchBox({ value, onChange, dark, busy = false }) {
  return (
    <View
      className={`flex-row items-center gap-2 border rounded-btn px-3 py-1.5 ${dark ? "border-white/15 bg-white/5" : "border-border bg-surface"}`}
    >
      {busy ? (
        <ActivityIndicator size="small" color={dark ? "#60A5FA" : "#2563EB"} />
      ) : (
        <Text className={dark ? "text-white/40" : "text-text-muted"}>🔍</Text>
      )}
      <TextInput
        className={`flex-1 text-sm font-inter ${dark ? "text-white" : "text-text"}`}
        placeholder="Search interventions..."
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChange}
        style={{ outlineStyle: "none" }}
      />
    </View>
  );
}
