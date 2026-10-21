// app/(app)/roles.jsx
//
// Roles & Privileges matrix — layout mirrors the reference screenshot:
// title "Autorisations: {ROLE}" + Enregistrer top-right, table with
// Créer | Consulter | Éditer | Supprimer | Tout sélectionner columns,
// one expandable row per module. SmartFactory styling, dark-aware.
//
// Privilege-to-column mapping (only real backend codes):
//   MACHINES : C=MACHINE_CREATE · R=MACHINE_READ · U=MACHINE_UPDATE · D=MACHINE_DELETE
//   READINGS : R=READINGS_READ
//   SENSORS  : R=SENSOR_READ + SENSOR_HISTORY_READ (stacked)
//   DASHBOARD: R=DASHBOARD_READ
//   THRESHOLDS: R=THRESHOLD_READ · U=THRESHOLD_WRITE
//   ALERTS   : R=ALERT_READ · U=ALERT_ACKNOWLEDGE
//   USERS    : C=USER_CREATE · R=USER_READ · U=USER_UPDATE + USER_PERMISSIONS_MANAGE · D=USER_DELETE
//   ROLES    : C=ROLE_CREATE · R=ROLE_READ · U=ROLE_UPDATE · D=ROLE_DELETE
//   GROUPS   : R=GROUP_READ · U=GROUP_WRITE
//   ZONES    : R=ZONE_READ · U=ZONE_WRITE
// Legacy MACHINE_WRITE / USER_WRITE imply their whole CRUD row (server treats
// them as full access): displayed as checked, and unchecking one cell splits
// them into the remaining individual codes.

import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import AppShell from "../../src/components/AppShell";
import Card from "../../src/components/Card";
import Button from "../../src/components/Button";
import Input from "../../src/components/Input";
import Skeleton from "../../src/components/Skeleton";
import EmptyState from "../../src/components/EmptyState";
import { useBreakpoint } from "../../src/hooks/useBreakpoint";
import { useDark } from "../../src/hooks/useDark";
import { useRole, PERMISSIONS } from "../../src/hooks/useRole";
import { useDialog } from "../../src/components/dialog/DialogContext";
import { useAppDispatch } from "../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../src/hooks/useAppSelector";
import {
  fetchRoles,
  fetchRolePrivilegesCatalog,
  createRole,
  updateRole,
  deleteRole,
  clearRoleSave,
} from "../../src/store/slices/roleSlice";

const MATRIX = [
  { module: "MACHINES", create: ["MACHINE_CREATE"], read: ["MACHINE_READ"], update: ["MACHINE_UPDATE"], remove: ["MACHINE_DELETE"], legacyWrite: "MACHINE_WRITE" },
  { module: "READINGS", create: [], read: ["READINGS_READ"], update: [], remove: [] },
  { module: "SENSORS", create: [], read: ["SENSOR_READ", "SENSOR_HISTORY_READ"], update: [], remove: [] },
  { module: "DASHBOARD", create: [], read: ["DASHBOARD_READ"], update: [], remove: [] },
  { module: "THRESHOLDS", create: [], read: ["THRESHOLD_READ"], update: ["THRESHOLD_WRITE"], remove: [] },
  { module: "ALERTS", create: [], read: ["ALERT_READ"], update: ["ALERT_ACKNOWLEDGE"], remove: [] },
  { module: "MAINTENANCE", create: [], read: ["MAINTENANCE_READ"], update: ["MAINTENANCE_WRITE"], remove: [] },
  { module: "USERS", create: ["USER_CREATE"], read: ["USER_READ"], update: ["USER_UPDATE", "USER_PERMISSIONS_MANAGE"], remove: ["USER_DELETE"], legacyWrite: "USER_WRITE" },
  { module: "ROLES", create: ["ROLE_CREATE"], read: ["ROLE_READ"], update: ["ROLE_UPDATE"], remove: ["ROLE_DELETE"] },
  { module: "GROUPS", create: [], read: ["GROUP_READ"], update: ["GROUP_WRITE"], remove: [] },
  { module: "ZONES", create: [], read: ["ZONE_READ"], update: ["ZONE_WRITE"], remove: [] },
];

const MODULE_LABELS = {
  MACHINES: "Machines",
  READINGS: "Telemetry",
  SENSORS: "Sensors",
  DASHBOARD: "Dashboard",
  THRESHOLDS: "Thresholds",
  ALERTS: "Alerts",
  MAINTENANCE: "Maintenance",
  USERS: "Users",
  ROLES: "Roles",
  GROUPS: "Groups",
  ZONES: "Zones",
};

// Group modules into collapsible sections (Qualisys-style layout)
const MODULE_GROUPS = [
  {
    key: "supervision",
    label: "Supervision",
    modules: ["MACHINES", "READINGS", "SENSORS", "DASHBOARD"],
  },
  {
    key: "configuration",
    label: "Configuration",
    modules: ["THRESHOLDS"],
  },
  {
    key: "alerting",
    label: "Alerting & Maintenance",
    modules: ["ALERTS", "MAINTENANCE"],
  },
  {
    key: "access",
    label: "Access Control",
    modules: ["USERS", "ROLES", "GROUPS", "ZONES"],
  },
];

function moduleCodes(row) {
  return [...row.create, ...row.read, ...row.update, ...row.remove];
}

export default function RolesScreen() {
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const dark = useDark();
  const { isAdmin, hasPermission, hasAnyPermission, homeRoute } = useRole();
  const isDesktop = breakpoint === "desktop";

  const canView = isAdmin || hasAnyPermission(PERMISSIONS.ROLE_READ, PERMISSIONS.ROLE_CREATE, PERMISSIONS.ROLE_UPDATE, PERMISSIONS.ROLE_DELETE);
  const canEdit = isAdmin || hasPermission(PERMISSIONS.ROLE_UPDATE);
  const canCreate = isAdmin || hasPermission(PERMISSIONS.ROLE_CREATE);
  const canDelete = isAdmin || hasPermission(PERMISSIONS.ROLE_DELETE);

  const { list, status, error, saveStatus, saveError } = useAppSelector((s) => s.role);

  const [activeRole, setActiveRole] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [expanded, setExpanded] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    if (canView) {
      dispatch(fetchRoles());
      dispatch(fetchRolePrivilegesCatalog());
    }
  }, [dispatch, canView]);

  const current = useMemo(
    () => (list || []).find((r) => r.name === activeRole) || (list || [])[0] || null,
    [list, activeRole]
  );

  useEffect(() => {
    if (current) setChecked(new Set(current.privileges || []));
  }, [current?.name]);

  useEffect(() => {
    if (saveStatus === "saved") {
      dialog.alert("Saved", `Role ${current?.name || ""} updated.`, "success");
      const t = setTimeout(() => dispatch(clearRoleSave()), 2000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus]);

  const savedSet = useMemo(() => new Set(current?.privileges || []), [current]);
  const dirty = useMemo(() => {
    if (checked.size !== savedSet.size) return true;
    for (const c of checked) if (!savedSet.has(c)) return true;
    return false;
  }, [checked, savedSet]);

  function cellChecked(row, codes) {
    if (!codes.length) return null; // no privilege for this cell
    if (codes.every((c) => checked.has(c))) return true;
    if (row.legacyWrite && checked.has(row.legacyWrite)) return true;
    return codes.some((c) => checked.has(c)) ? "partial" : false;
  }

  function toggleCell(row, codes) {
    if (!canEdit || !codes.length) return;
    setChecked((prev) => {
      const next = new Set(prev);
      const allOn = codes.every((c) => next.has(c)) || (row.legacyWrite && next.has(row.legacyWrite));
      if (allOn) {
        codes.forEach((c) => next.delete(c));
        if (row.legacyWrite && next.has(row.legacyWrite)) {
          // Split legacy WRITE into the remaining individual codes.
          next.delete(row.legacyWrite);
          moduleCodes(row).forEach((c) => {
            if (!codes.includes(c)) next.add(c);
          });
        }
      } else {
        codes.forEach((c) => next.add(c));
      }
      return next;
    });
  }

  function toggleRow(row) {
    if (!canEdit) return;
    setChecked((prev) => {
      const next = new Set(prev);
      const codes = moduleCodes(row);
      const allOn = codes.every((c) => next.has(c)) || (row.legacyWrite && next.has(row.legacyWrite));
      if (allOn) {
        codes.forEach((c) => next.delete(c));
        if (row.legacyWrite) next.delete(row.legacyWrite);
      } else {
        codes.forEach((c) => next.add(c));
      }
      return next;
    });
  }

  function toggleExpand(module) {
    setExpanded((prev) => ({ ...prev, [module]: prev[module] === false }));
  }

  async function handleSave() {
    if (!current || !dirty) return;
    try {
      await dispatch(updateRole({ name: current.name, body: { privileges: [...checked] } })).unwrap();
      dispatch(fetchRoles());
    } catch {
      // Inline save error below.
    }
  }

  async function handleCreate() {
    const name = newName.trim().toUpperCase();
    if (name.length < 2) return;
    try {
      const created = await dispatch(createRole({ name, description: newDesc.trim() || undefined, privileges: [] })).unwrap();
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      setActiveRole(created?.name || name);
      dispatch(fetchRoles());
    } catch {
      // Inline save error below.
    }
  }

  async function handleDelete() {
    if (!current || current.systemRole) return;
    const ok = await dialog.confirm("Delete role", `Remove custom role ${current.name}? Blocked while assigned to users.`, {
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await dispatch(deleteRole(current.name)).unwrap();
      setActiveRole(null);
      dispatch(fetchRoles());
    } catch (e) {
      dialog.alert("Cannot delete role", e?.message || "Failed to delete role.");
    }
  }

  if (!canView) {
    return (
      <AppShell>
        <Card>
          <EmptyState
            title="Restricted area"
            message="Roles require the ROLE_READ permission (administrators)."
            action={<Button title="Go Home" variant="primary" size="sm" onPress={() => router.replace(homeRoute)} />}
          />
        </Card>
      </AppShell>
    );
  }

  const isLoading = status === "loading";
  const isError = status === "error";
  const headerText = dark ? "text-white" : "text-text";
  const subText = dark ? "text-white/60" : "text-text-muted";
  const cellBorder = dark ? "border-white/10" : "border-border";

  function CheckCell({ row, codes }) {
    if (!codes.length) {
      return (
        <View className="items-center justify-center" style={{ width: 72 }}>
          <Text className={`text-xs ${subText} font-inter`}>—</Text>
        </View>
      );
    }
    const state = cellChecked(row, codes);
    return (
      <Pressable
        onPress={() => toggleCell(row, codes)}
        disabled={!canEdit}
        className="items-center justify-center"
        style={{ width: 72 }}
      >
        <View
          className={`w-5 h-5 rounded border-2 items-center justify-center ${
            state ? "bg-primary border-primary" : dark ? "border-white/30" : "border-slate-300"
          } ${state === "partial" ? "opacity-60" : ""}`}
        >
          {state && <Text className="text-white text-[10px] font-bold">✓</Text>}
        </View>
      </Pressable>
    );
  }

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header: title + Enregistrer */}
        <View className="flex-row items-center justify-between mb-4 gap-2">
          <Text className={`text-2xl font-bold font-inter ${headerText}`}>
            Autorisations{current ? `: ${current.name}` : ""}
          </Text>
          <View className="flex-row gap-2">
            {canCreate && (
              <Button title="+ New Role" variant="outline" size="sm" onPress={() => setShowCreate((v) => !v)} />
            )}
            {dirty && canEdit && (
              <Button title="Enregistrer" variant="primary" size="sm" onPress={handleSave} loading={saveStatus === "saving"} />
            )}
          </View>
        </View>

        {showCreate && canCreate && (
          <Card className="mb-4">
            <Text className={`text-base font-bold font-inter mb-3 ${headerText}`}>New custom role</Text>
            <View className={`${isDesktop ? "flex-row gap-3 items-end" : "gap-3"}`}>
              <View className="flex-1">
                <Input label="Name (2–50, letters/numbers/_/-)" placeholder="SUPERVISOR_NIGHT" value={newName} onChangeText={(t) => setNewName(t.toUpperCase())} autoCapitalize="characters" />
              </View>
              <View className="flex-1">
                <Input label="Description (optional)" placeholder="Night-shift supervisors" value={newDesc} onChangeText={setNewDesc} />
              </View>
              <Button title="Create" variant="primary" size="sm" onPress={handleCreate} loading={saveStatus === "saving"} disabled={newName.trim().length < 2} />
              <Button title="Cancel" variant="outline" size="sm" onPress={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }} />
            </View>
            {saveStatus === "error" && saveError && (
              <Text className="text-sm text-danger font-inter mt-2">{saveError.message || "Failed to create role"}</Text>
            )}
          </Card>
        )}

        {isLoading && (
          <Card>
            <Skeleton width="40%" height={16} className="mb-3" />
            <Skeleton width="100%" height={44} className="mb-2" />
            <Skeleton width="100%" height={44} />
          </Card>
        )}

        {isError && (
          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-danger font-inter">{error?.message || "Failed to load roles"}</Text>
              <Button title="Retry" variant="outline" size="sm" onPress={() => dispatch(fetchRoles())} />
            </View>
          </Card>
        )}

        {!isLoading && !isError && (
          <>
            {/* Role tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {(list || []).map((r) => {
                  const active = current?.name === r.name;
                  return (
                    <Pressable
                      key={r.name}
                      onPress={() => setActiveRole(r.name)}
                      className={`px-4 py-2 rounded-chip flex-row items-center gap-2 ${active ? "bg-primary" : dark ? "bg-white/5 border border-white/15" : "bg-surface border border-border"}`}
                    >
                      <Text className={`text-sm font-bold font-inter ${active ? "text-white" : dark ? "text-white/80" : "text-text"}`}>
                        {r.name}
                      </Text>
                      <View className={`min-w-[20px] h-5 rounded-full items-center justify-center px-1.5 ${active ? "bg-white/20" : "bg-primary-soft"}`}>
                        <Text className={`text-[11px] font-bold font-inter ${active ? "text-white" : "text-primary"}`}>
                          {r.userCount ?? 0}
                        </Text>
                      </View>
                      {r.systemRole && (
                        <Text className={`text-[10px] font-inter ${active ? "text-white/80" : dark ? "text-white/50" : "text-text-muted"}`}>
                          system
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {current ? (
              <Card className="overflow-hidden p-0">
                <View className={`flex-row items-center justify-between px-5 py-3.5 border-b ${cellBorder}`}>
                  <View className="flex-1">
                    <Text className={`text-base font-bold font-inter ${headerText}`}>
                      Permissions: {current.name}
                    </Text>
                    {!!current.description && (
                      <Text className={`text-xs font-inter mt-0.5 ${subText}`}>{current.description}</Text>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2">
                    {current.systemRole && (
                      <View className="px-2 py-0.5 rounded-chip bg-primary-soft">
                        <Text className="text-[10px] font-bold text-primary font-inter">System</Text>
                      </View>
                    )}
                    {canDelete && !current.systemRole && (
                      <Pressable onPress={handleDelete} className="px-3 py-1.5 rounded-btn bg-danger/10">
                        <Text className="text-xs text-danger font-medium font-inter">Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {saveStatus === "error" && saveError && (
                  <View className="mx-4 mt-3 bg-danger/10 rounded-btn px-3 py-2" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
                    <Text className="text-sm text-danger font-inter">{saveError.message || "Failed to save role"}</Text>
                  </View>
                )}

                {/* Column headers */}
                <View className={`flex-row items-center px-5 py-3 border-b ${cellBorder} ${dark ? "bg-white/[0.03]" : "bg-slate-50"}`}>
                  <Text className={`flex-1 text-[11px] font-bold font-inter uppercase ${subText}`} style={{ letterSpacing: 0.5 }}>
                    Module
                  </Text>
                  {["Créer", "Consulter", "Éditer", "Supprimer", "Tout"].map((h) => (
                    <Text
                      key={h}
                      className={`text-[11px] font-bold font-inter text-center uppercase ${subText}`}
                      style={{ width: h === "Tout" ? 72 : 72, letterSpacing: 0.5 }}
                    >
                      {h}
                    </Text>
                  ))}
                </View>

                {/* Grouped modules */}
                {MODULE_GROUPS.map((group) => {
                  const groupRows = MATRIX.filter((row) =>
                    group.modules.includes(row.module)
                  );
                  if (groupRows.length === 0) return null;
                  const groupCollapsed = expanded[group.key] === false;
                  const groupCodes = groupRows.flatMap(moduleCodes);
                  const groupAllOn = groupCodes.length > 0 && groupCodes.every((c) => checked.has(c));

                  return (
                    <View key={group.key}>
                      {/* Group header */}
                      <Pressable
                        onPress={() => setExpanded((prev) => ({ ...prev, [group.key]: prev[group.key] === false ? undefined : false }))}
                        className={`flex-row items-center px-5 py-3 border-b ${cellBorder} ${dark ? "bg-white/[0.06]" : "bg-slate-100/80"}`}
                      >
                        <Text className={`text-[10px] mr-2 ${subText}`}>
                          {groupCollapsed ? "›" : "⌄"}
                        </Text>
                        <Text className={`text-sm font-bold font-inter flex-1 ${headerText}`}>
                          {group.label}
                        </Text>
                        <Text className={`text-[11px] font-inter ${subText}`}>
                          {groupCodes.filter((c) => checked.has(c)).length}/{groupCodes.length}
                        </Text>
                      </Pressable>

                      {/* Module rows */}
                      {!groupCollapsed && groupRows.map((row) => {
                        const codes = moduleCodes(row);
                        const rowOn = codes.length > 0 && (codes.every((c) => checked.has(c)) || (row.legacyWrite && checked.has(row.legacyWrite)));
                        return (
                          <View key={row.module} className={`flex-row items-center px-5 py-2.5 border-b ${cellBorder}`}>
                            <View className="flex-1 pl-4">
                              <Text className={`text-sm font-inter ${headerText}`}>
                                {MODULE_LABELS[row.module] || row.module}
                              </Text>
                            </View>
                            <CheckCell row={row} codes={row.create} />
                            <CheckCell row={row} codes={row.read} />
                            <CheckCell row={row} codes={row.update} />
                            <CheckCell row={row} codes={row.remove} />
                            <Pressable
                              onPress={() => toggleRow(row)}
                              disabled={!canEdit || !codes.length}
                              className="items-center justify-center"
                              style={{ width: 72 }}
                            >
                              <View
                                className={`w-5 h-5 rounded border-2 items-center justify-center ${
                                  rowOn ? "bg-primary border-primary" : dark ? "border-white/30" : "border-slate-300"
                                }`}
                              >
                                {rowOn && <Text className="text-white text-[10px] font-bold">✓</Text>}
                              </View>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </Card>
            ) : (
              <Card>
                <EmptyState title="No roles yet" message="Roles are seeded automatically on backend start." />
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}
