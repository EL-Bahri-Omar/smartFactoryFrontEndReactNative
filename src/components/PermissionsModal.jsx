// src/components/PermissionsModal.jsx
//
// Per-user permission checklist (backend USER_PERMISSIONS_MANAGE).
// Shows all 14 permissions grouped by category, checked = effective.
// Saves the full checklist via PUT /api/users/:id/permissions — the server
// recalculates granted/revoked against the role. Opened from the Users screen.

import { useEffect, useMemo, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import Button from "./Button";
import Skeleton from "./Skeleton";
import EmptyState from "./EmptyState";
import { useDark } from "../hooks/useDark";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import {
  fetchPermissionsCatalog,
  fetchUserPermissions,
  updateUserPermissions,
  clearPermsDetail,
} from "../store/slices/userSlice";
import { meThunk } from "../store/slices/authSlice";
import {
  PERMISSION_LIST,
  PERMISSION_LABELS,
  PERMISSION_CATEGORIES,
  PERMISSION_CATEGORY_OF,
} from "../constants/permissions";

export default function PermissionsModal({ visible, user, onClose }) {
  const dispatch = useAppDispatch();
  const dark = useDark();
  const { catalog, catalogStatus, permsDetail, permsStatus, permsError, permsSaveStatus, permsSaveError } =
    useAppSelector((s) => s.user);
  const ownId = useAppSelector((s) => s.auth.user?.id);

  const [checked, setChecked] = useState(new Set());

  useEffect(() => {
    if (visible && user?.id) {
      dispatch(fetchPermissionsCatalog());
      dispatch(fetchUserPermissions(user.id));
    }
    if (!visible) {
      dispatch(clearPermsDetail());
      setChecked(new Set());
    }
  }, [dispatch, visible, user?.id]);

  useEffect(() => {
    if (permsDetail?.effectivePermissions) {
      setChecked(new Set(permsDetail.effectivePermissions));
    }
  }, [permsDetail]);

  const catalogPerms = useMemo(() => {
    if (Array.isArray(catalog?.permissions) && catalog.permissions.length) return catalog.permissions;
    // Fallback when the catalog is unreachable (codes are the contract).
    return PERMISSION_LIST.map((code) => ({
      code,
      description: PERMISSION_LABELS[code] || code,
      category: PERMISSION_CATEGORY_OF[code] || "OTHER",
    }));
  }, [catalog]);

  const groups = useMemo(() => {
    const order = [...PERMISSION_CATEGORIES];
    const map = {};
    catalogPerms.forEach((p) => {
      const cat = p.category || "OTHER";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
      if (!order.includes(cat)) order.push(cat);
    });
    return order.filter((c) => map[c]).map((c) => ({ category: c, items: map[c] }));
  }, [catalogPerms]);

  const roleDefaults = useMemo(
    () => new Set(permsDetail?.roleDefaultPermissions || []),
    [permsDetail]
  );

  function toggle(code) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function handleSave() {
    if (!user?.id) return;
    try {
      await dispatch(updateUserPermissions({ id: user.id, permissions: [...checked] })).unwrap();
      // Editing yourself changes your own authorities — refresh the session.
      if (user.id === ownId) dispatch(meThunk());
      onClose();
    } catch {
      // Inline save error below.
    }
  }

  const loading = permsStatus === "loading" || catalogStatus === "loading";
  const saving = permsSaveStatus === "saving";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-center items-center px-4" onPress={onClose}>
        <Pressable
          className={`rounded-card w-full border ${dark ? "bg-darkcard border-white/15" : "bg-surface border-border"}`}
          style={{ maxWidth: 560, maxHeight: "85%" }}
          onPress={() => {}}
        >
          <View className="p-6 pb-3">
            <Text className={`text-lg font-bold font-inter mb-1 ${dark ? "text-white" : "text-text"}`}>
              Permissions
            </Text>
            <Text className={`text-sm font-inter ${dark ? "text-white/60" : "text-text-muted"}`}>
              {user?.firstName || user?.email || "User"}
              {permsDetail?.role ? ` · ${permsDetail.role}` : ""}
            </Text>
            <Text className={`text-xs font-inter mt-1 ${dark ? "text-white/50" : "text-text-muted"}`}>
              Checked = effective. Saving recalculates granted/revoked against the role.
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            <View className="px-6 pb-2">
              {loading && (
                <View className="gap-2 py-2">
                  <Skeleton width="40%" height={14} />
                  <Skeleton width="100%" height={40} />
                  <Skeleton width="100%" height={40} />
                </View>
              )}

              {!loading && permsStatus === "error" && (
                <View className="bg-danger/10 rounded-btn px-3 py-2 mb-3" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
                  <Text className="text-sm text-danger font-inter">
                    {permsError?.message || "Failed to load permissions"}
                  </Text>
                  {(permsError?.status || permsError?.code) && (
                    <Text className="text-xs text-danger font-inter mt-0.5 opacity-80">
                      HTTP {permsError?.status ?? "?"} · {permsError?.code ?? "UNKNOWN"}
                      {permsError?.status === 403 ? " (requires USER_READ)" : ""}
                    </Text>
                  )}
                </View>
              )}

              {!loading && permsStatus !== "error" && groups.map((g) => (
                <View key={g.category} className="mb-3">
                  <Text className={`text-xs font-bold font-inter mb-1.5 ${dark ? "text-white/50" : "text-text-muted"}`}>
                    {g.category}
                  </Text>
                  {g.items.map((p) => {
                    const on = checked.has(p.code);
                    const isDefault = roleDefaults.has(p.code);
                    return (
                      <Pressable
                        key={p.code}
                        onPress={() => toggle(p.code)}
                        className={`flex-row items-center gap-3 px-3 py-2.5 rounded-btn border mb-1.5 ${dark ? "border-white/10 bg-white/5" : "border-border bg-bg"}`}
                      >
                        <View
                          className={`w-5 h-5 rounded border-2 items-center justify-center ${on ? "bg-primary border-primary" : dark ? "border-white/30" : "border-border"}`}
                        >
                          {on && <Text className="text-white text-[10px] font-bold">✓</Text>}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text className={`text-sm font-bold font-inter ${dark ? "text-white" : "text-text"}`}>
                              {PERMISSION_LABELS[p.code] || p.code}
                            </Text>
                            <View className={`px-1.5 py-0.5 rounded-chip ${isDefault ? "bg-primary-soft" : "bg-warning/15"}`}>
                              <Text className={`font-inter ${isDefault ? "text-primary" : "text-warning"}`} style={{ fontSize: 9 }}>
                                {isDefault ? "role" : "custom"}
                              </Text>
                            </View>
                          </View>
                          <Text className={`text-[11px] font-inter ${dark ? "text-white/50" : "text-text-muted"}`}>
                            {p.code}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}

              {permsSaveStatus === "error" && permsSaveError && (
                <View className="bg-danger/10 rounded-btn px-3 py-2 mb-3" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
                  <Text className="text-sm text-danger font-inter">
                    {permsSaveError?.message || "Failed to save permissions"}
                  </Text>
                  {(permsSaveError?.status || permsSaveError?.code) && (
                    <Text className="text-xs text-danger font-inter mt-0.5 opacity-80">
                      HTTP {permsSaveError?.status ?? "?"} · {permsSaveError?.code ?? "UNKNOWN"}
                      {permsSaveError?.status === 403 ? " (requires USER_PERMISSIONS_MANAGE)" : ""}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          <View className="flex-row gap-3 p-6 pt-3 justify-end">
            <Button title="Cancel" variant="ghost" onPress={onClose} />
            <Button
              title="Save Permissions"
              variant="primary"
              onPress={handleSave}
              loading={saving}
              disabled={permsStatus !== "succeeded"}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
