// app/(app)/maintenance/[id].jsx
//
// Sprint 6 — Intervention detail (CONFIRMED backend MaintenanceController).
//   GET   /api/maintenance/:id                    full entity (initial state)
//   PUT   /api/maintenance/:id/assign             technician assignment (US43)
//   GET   /api/maintenance/:id/anomaly            anomaly + sensor context (US44)
//   POST  /api/maintenance/:id/diagnoses          probable cause + details
//   POST  /api/maintenance/:id/actions            realized action + parts
//   POST  /api/maintenance/:id/observations       technical observation
//   PUT   /api/maintenance/:id/close              terminal closure
//
// UI gating mirrors the product rule (the server enforces the truth):
//   create                     → RESPONSABLE_INDUSTRIEL only (maintenance list)
//   assign / details / close   → RESPONSABLE_INDUSTRIEL
//   diagnosis / action / obs   → TECHNICIAN
//   status (start / complete)  → TECHNICIAN
//   ADMIN                      → read-only consult
// Everyone except OPERATOR can consult the interventions list.

import { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AppShell from "../../../src/components/AppShell";
import Card from "../../../src/components/Card";
import Button from "../../../src/components/Button";
import Input from "../../../src/components/Input";
import Select from "../../../src/components/Select";
import Skeleton from "../../../src/components/Skeleton";
import EmptyState from "../../../src/components/EmptyState";
import BottomSheet from "../../../src/components/BottomSheet";
import BusyRow from "../../../src/components/BusyRow";
import { useDark } from "../../../src/hooks/useDark";
import { useRole } from "../../../src/hooks/useRole";
import { useAppDispatch } from "../../../src/hooks/useAppDispatch";
import { useAppSelector } from "../../../src/hooks/useAppSelector";
import {
  fetchInterventionById,
  assignIntervention,
  addInterventionDiagnosis,
  addInterventionAction,
  addInterventionObservation,
  closeIntervention,
  updateInterventionStatus,
  updateInterventionDetails,
  updateInterventionDiagnosis,
  updateInterventionAction,
  updateInterventionObservation,
} from "../../../src/store/slices/interventionSlice";
import { fetchUsers } from "../../../src/store/slices/userSlice";
import {
  getTicketPriority,
  getTicketStatus,
  INTERVENTION_TYPE_LABELS,
  PREVENTIVE_SUBTYPE_LABELS,
  OBSERVATION_CATEGORY_LABELS,
} from "../../../src/lib/status";
import { formatDateTime, relativeTime } from "../../../src/lib/time";

const OBSERVATION_CATEGORIES = [
  { value: "GENERAL", label: OBSERVATION_CATEGORY_LABELS.GENERAL },
  { value: "SAFETY", label: OBSERVATION_CATEGORY_LABELS.SAFETY },
  { value: "PERFORMANCE", label: OBSERVATION_CATEGORY_LABELS.PERFORMANCE },
  { value: "OPERATING_CONDITION", label: OBSERVATION_CATEGORY_LABELS.OPERATING_CONDITION },
];

function refCode(t) {
  return `INT-${String(t?.id || "").slice(0, 6).toUpperCase()}`;
}

export default function InterventionDetailScreen() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const dispatch = useAppDispatch();
  const dark = useDark();
  const { role, user } = useRole();

  const { current, currentStatus, currentError, mutating } = useAppSelector((s) => s.maintenance);
  const { list: users } = useAppSelector((s) => s.user);

  const [sheet, setSheet] = useState(null); // 'assign' | 'diagnosis' | 'action' | 'observation' | 'close' | 'status' | 'details' | 'editDiagnosis' | 'editAction' | 'editObservation' | null
  const [assignTech, setAssignTech] = useState(null);
  const [diagForm, setDiagForm] = useState({ probableCause: "", details: "" });
  const [actionForm, setActionForm] = useState({ description: "", partsReplaced: "", durationMinutes: "" });
  const [obsForm, setObsForm] = useState({ content: "", category: "GENERAL" });
  const [closeForm, setCloseForm] = useState({ closureNotes: "", restoreMachineStatus: true });
  const [sheetError, setSheetError] = useState(null);
  // Item 10 — technician edit flows.
  const [detailsForm, setDetailsForm] = useState({ title: "", description: "", priority: "MEDIUM" });
  const [statusChoice, setStatusChoice] = useState(null); // IN_PROGRESS | COMPLETED
  const [editTarget, setEditTarget] = useState(null); // { kind, index, entry }

  useEffect(() => {
    if (id) dispatch(fetchInterventionById(id));
  }, [dispatch, id]);

  // Best-effort technician list for the assign sheet (needs USER_READ; a
  // 403 just leaves the manual entry). Skipped when the list is already
  // warm (perf: no refetch on every navigation back to a detail).
  useEffect(() => {
    if (users.length === 0) dispatch(fetchUsers({ size: 100 })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const refresh = useCallback(() => {
    if (id) dispatch(fetchInterventionById(id));
  }, [dispatch, id]);

  const darkText = dark ? "text-white" : "text-text";
  const darkMuted = dark ? "text-white/60" : "text-text-muted";
  const isResponsable = role === "RESPONSABLE_INDUSTRIEL";
  const isTechnician = role === "TECHNICIAN";
  // A technician edits only the intervention assigned to them (the backend
  // enforces this too). The assigned technicianId is the canonical user id.
  const assignedToMe =
    !!current?.technicianId &&
    (current.technicianId === user?.id || current.technicianId === user?.email);
  const canWorkOnIt = !isTechnician || assignedToMe;
  // Different edit scopes for the two editing roles:
  //  - RESPONSABLE_INDUSTRIEL: assignment, core details, closure.
  //  - TECHNICIAN: diagnoses / actions / observations, work status, closure.
  //  - ADMIN: read-only consult (only the responsable creates; RESP + TECH edit).
  const canAssign = isResponsable;
  const canDiagnose = isTechnician && canWorkOnIt;
  const canObserve = isTechnician && canWorkOnIt;
  const canClose = isResponsable || (isTechnician && canWorkOnIt);
  const canEditDetails = isResponsable;
  const canChangeStatus = isTechnician && canWorkOnIt;
  const openStatus = current && current.status !== "COMPLETED" && current.status !== "CANCELLED";

  const technicianOptions = useMemo(
    () =>
      (users || [])
        .filter((u) => u.role === "TECHNICIAN")
        .map((u) => ({
          // Prefer the Mongo id; the backend also accepts the email.
          value: u.id || u.email || u.username,
          label: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || u.username || u.id,
        })),
    [users]
  );

  const sheetBusy = mutating === "loading";

  async function submitAssign() {
    if (!assignTech) return;
    setSheetError(null);
    try {
      await dispatch(assignIntervention({ id, technicianId: assignTech })).unwrap();
      setSheet(null);
    } catch (e) {
      setSheetError(e?.message || "Failed to assign.");
    }
  }

  async function submitDiagnosis() {
    if (!diagForm.probableCause.trim()) return;
    setSheetError(null);
    try {
      await dispatch(
        addInterventionDiagnosis({
          id,
          probableCause: diagForm.probableCause.trim(),
          details: diagForm.details.trim(),
        })
      ).unwrap();
      setDiagForm({ probableCause: "", details: "" });
      setSheet(null);
    } catch (e) {
      setSheetError(e?.message || "Failed to record diagnosis.");
    }
  }

  async function submitAction() {
    if (!actionForm.description.trim()) return;
    setSheetError(null);
    const minutes = parseInt(actionForm.durationMinutes, 10);
    try {
      await dispatch(
        addInterventionAction({
          id,
          description: actionForm.description.trim(),
          partsReplaced: actionForm.partsReplaced.trim(),
          durationMinutes: Number.isFinite(minutes) ? minutes : undefined,
        })
      ).unwrap();
      setActionForm({ description: "", partsReplaced: "", durationMinutes: "" });
      setSheet(null);
    } catch (e) {
      setSheetError(e?.message || "Failed to record action.");
    }
  }

  async function submitObservation() {
    if (!obsForm.content.trim()) return;
    setSheetError(null);
    try {
      await dispatch(
        addInterventionObservation({
          id,
          content: obsForm.content.trim(),
          category: obsForm.category,
        })
      ).unwrap();
      setObsForm({ content: "", category: "GENERAL" });
      setSheet(null);
    } catch (e) {
      setSheetError(e?.message || "Failed to add observation.");
    }
  }

  async function submitClose() {
    setSheetError(null);
    try {
      await dispatch(
        closeIntervention({
          id,
          closureNotes: closeForm.closureNotes.trim(),
          restoreMachineStatus: closeForm.restoreMachineStatus,
        })
      ).unwrap();
      setSheet(null);
    } catch (e) {
      setSheetError(e?.message || "Failed to close the intervention.");
    }
  }

  // ── Item 10 — technician flows ───────────────────────────────────────────

  /** "Start (In progress)" / "Complete" — explicit status transition. */
  async function submitStatus() {
    if (!statusChoice) return;
    setSheetError(null);
    try {
      await dispatch(updateInterventionStatus({ id, status: statusChoice })).unwrap();
      setStatusChoice(null);
      setSheet(null);
    } catch (e) {
      setSheetError(
        e?.message ||
          "The status endpoint is not available on the backend yet (PUT /api/maintenance/:id/status). The technician status control stays visible so nothing else changes."
      );
    }
  }

  /** Edit the intervention core fields (title / description / priority). */
  async function submitDetails() {
    if (!detailsForm.title.trim()) return;
    setSheetError(null);
    try {
      await dispatch(
        updateInterventionDetails({
          id,
          title: detailsForm.title.trim(),
          description: detailsForm.description.trim(),
          priority: detailsForm.priority,
        })
      ).unwrap();
      setSheet(null);
    } catch (e) {
      setSheetError(e?.message || "Could not save the changes yet (backend update pending).");
    }
  }

  /** Edit one timeline entry (diagnosis / action+parts / observation). */
  async function submitEditEntry() {
    if (!editTarget) return;
    setSheetError(null);
    const { kind, entry, index } = editTarget;
    try {
      if (kind === "diagnosis") {
        await dispatch(
          updateInterventionDiagnosis({
            id,
            entryId: entry.id || index,
            probableCause: diagForm.probableCause.trim(),
            details: diagForm.details.trim(),
          })
        ).unwrap();
      } else if (kind === "action") {
        const minutes = parseInt(actionForm.durationMinutes, 10);
        await dispatch(
          updateInterventionAction({
            id,
            entryId: entry.id || index,
            description: actionForm.description.trim(),
            partsReplaced: actionForm.partsReplaced.trim(),
            durationMinutes: Number.isFinite(minutes) ? minutes : undefined,
          })
        ).unwrap();
      } else if (kind === "observation") {
        await dispatch(
          updateInterventionObservation({
            id,
            entryId: entry.id || index,
            content: obsForm.content.trim(),
            category: obsForm.category,
          })
        ).unwrap();
      }
      setEditTarget(null);
      setSheet(null);
    } catch (e) {
      setSheetError(e?.message || "Could not save the edit yet (backend update pending).");
    }
  }

  function openEdit(kind, entry, index) {
    setSheetError(null);
    setEditTarget({ kind, entry, index });
    if (kind === "diagnosis") {
      setDiagForm({ probableCause: entry.probableCause || "", details: entry.details || "" });
    } else if (kind === "action") {
      setActionForm({
        description: entry.description || "",
        partsReplaced: entry.partsReplaced || "",
        durationMinutes: entry.durationMinutes != null ? String(entry.durationMinutes) : "",
      });
    } else if (kind === "observation") {
      setObsForm({ content: entry.content || "", category: entry.category || "GENERAL" });
    }
    setSheet(`edit${kind.charAt(0).toUpperCase()}${kind.slice(1)}`);
  }

  const chip = (color) => ({ backgroundColor: color + "1A" });

  // Every action sheet shares one pinned footer: Cancel + the primary action.
  // It lives outside the body (see BottomSheet) so the buttons are always
  // visible — no scrolling inside a dialog to reach "Save".
  const sheetFooter = (label, onPress, { disabled = false, loading = false } = {}) => (
    <View className="flex-row gap-2 justify-end">
      <Button title="Cancel" variant="ghost" size="sm" onPress={() => setSheet(null)} />
      <Button
        title={label}
        variant="primary"
        size="sm"
        loading={loading}
        disabled={disabled}
        onPress={onPress}
      />
    </View>
  );

  return (
    <AppShell>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className={`text-lg font-bold font-inter ${darkText}`}>
              {current ? refCode(current) : "Intervention"}
            </Text>
            <Text className={`text-sm font-inter ${darkMuted}`}>
              {current ? `${INTERVENTION_TYPE_LABELS[current.type] || current.type} maintenance` : "Detail"}
            </Text>
          </View>
          <Button title="← Back" variant="outline" size="sm" onPress={() => router.push("/(app)/maintenance")} />
        </View>

        {/* Refresh feedback while the detail reloads (mutating ops upsert in place) */}
        {currentStatus === "loading" && !!current && <BusyRow label="Refreshing…" className="mb-2" />}

        <Card className="mb-4" style={currentStatus === "loading" && current ? { opacity: 0.7 } : undefined}>
          {currentStatus === "loading" && !current && (
            <View className="gap-2 py-3">
              <Skeleton width="45%" height={18} />
              <Skeleton width="70%" height={14} />
              <Skeleton width="100%" height={14} />
              <Skeleton width="60%" height={14} />
            </View>
          )}

          {!current && currentStatus !== "loading" && (
            <EmptyState
              title="Intervention unavailable"
              message={currentError?.message || "This intervention could not be loaded."}
              action={<Button title="Retry" variant="outline" size="sm" onPress={() => refresh()} />}
            />
          )}

          {current && (
            <View className="gap-3">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 mr-2">
                  <Text className={`text-base font-bold font-inter ${darkText}`}>{current.title}</Text>
                  {current.description ? (
                    <Text className={`text-sm font-inter mt-1 ${darkMuted}`}>{current.description}</Text>
                  ) : null}
                </View>
                <View className="px-2.5 py-1 rounded-chip" style={chip(getTicketStatus(current.status).color)}>
                  <Text className="text-xs font-bold font-inter" style={{ color: getTicketStatus(current.status).color }}>
                    {getTicketStatus(current.status).label}
                  </Text>
                </View>
              </View>

              <View className="gap-2 mt-1">
                {[
                  ["Machine", current.machineCode || (current.machineId ? String(current.machineId).slice(0, 8) : "—")],
                  ["Type", `${INTERVENTION_TYPE_LABELS[current.type] || current.type}${current.preventiveSubtype ? ` · ${PREVENTIVE_SUBTYPE_LABELS[current.preventiveSubtype] || current.preventiveSubtype}` : ""}`],
                  ["Priority", getTicketPriority(current.priority).label],
                  ["Technician", current.technicianName || current.technicianId || "Unassigned"],
                  ["Scheduled", current.scheduledAt ? formatDateTime(current.scheduledAt) : "—"],
                  ["Created", formatDateTime(current.createdAt)],
                  ...(current.assignedAt ? [["Assigned", `${formatDateTime(current.assignedAt)}${current.assignedBy ? ` by ${current.assignedBy}` : ""}`]] : []),
                  ...(current.closedAt ? [["Closed", `${formatDateTime(current.closedAt)}${current.closedBy ? ` by ${current.closedBy}` : ""}`]] : []),
                ].map(([k, v]) => (
                  <View
                    key={k}
                    className={`flex-row justify-between items-center py-2 px-3 rounded-btn ${dark ? "bg-white/5" : "bg-bg"}`}
                  >
                    <Text className={`text-xs font-inter ${darkMuted}`}>{k}</Text>
                    <Text className={`text-xs font-bold font-inter text-right flex-1 ${darkText}`} numberOfLines={1}>
                      {v}
                    </Text>
                  </View>
                ))}
              </View>

              {current.closureNotes ? (
                <View className={`rounded-btn p-3 mt-1 ${dark ? "bg-white/5" : "bg-bg"}`}>
                  <Text className={`text-xs font-semibold font-inter mb-1 ${darkMuted}`}>Closure notes</Text>
                  <Text className={`text-sm font-inter ${darkText}`}>{current.closureNotes}</Text>
                </View>
              ) : null}

              {/* Actions row */}
              <View className="flex-row flex-wrap gap-2 mt-3">
                {canAssign && openStatus && (
                  <Button
                    title={current.technicianId ? "Reassign" : "Assign technician"}
                    variant="primary"
                    size="sm"
                    onPress={() => { setSheet("assign"); setSheetError(null); setAssignTech(current.technicianId || null); }}
                  />
                )}
                {/* Item 10 — technician/manager status control. Default is
                    "To do" (PENDING); "In progress" starts the work,
                    "Complete" is the close flow. */}
                {canChangeStatus && openStatus && (
                  <Button
                    title={current.status === "IN_PROGRESS" ? "Mark completed" : "Start (in progress)"}
                    variant={current.status === "IN_PROGRESS" ? "primary" : "outline"}
                    size="sm"
                    onPress={() => {
                      setStatusChoice(current.status === "IN_PROGRESS" ? "COMPLETED" : "IN_PROGRESS");
                      setSheetError(null);
                      setSheet("status");
                    }}
                  />
                )}
                {canEditDetails && openStatus && (
                  <Button
                    title="Edit details"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      setDetailsForm({
                        title: current.title || "",
                        description: current.description || "",
                        priority: current.priority || "MEDIUM",
                      });
                      setSheetError(null);
                      setSheet("details");
                    }}
                  />
                )}
                {canDiagnose && openStatus && (
                  <Button title="+ Diagnosis" variant="outline" size="sm" onPress={() => { setSheet("diagnosis"); setSheetError(null); }} />
                )}
                {canDiagnose && openStatus && (
                  <Button title="+ Action" variant="outline" size="sm" onPress={() => { setSheet("action"); setSheetError(null); }} />
                )}
                {canObserve && (
                  <Button title="+ Observation" variant="outline" size="sm" onPress={() => { setSheet("observation"); setSheetError(null); }} />
                )}
                {canClose && openStatus && (
                  <Button
                    title="Close"
                    variant={current.status === "IN_PROGRESS" || current.status === "ASSIGNED" ? "primary" : "outline"}
                    size="sm"
                    onPress={() => { setSheet("close"); setSheetError(null); }}
                  />
                )}
              </View>
              {mutating === "loading" && <BusyRow label="Saving…" className="mt-2" />}
              {mutating === "error" && (
                <Text className="text-xs font-inter text-danger mt-1">
                  The last action failed — retry or reload the page.
                </Text>
              )}
            </View>
          )}
        </Card>

        {/* Timeline — diagnoses / actions / observations (nested lists) */}
        {current && (
          <View className="gap-4">
            {/* Diagnoses */}
            <Card>
              <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>
                Diagnoses ({current.diagnoses.length})
              </Text>
              {current.diagnoses.length === 0 ? (
                <Text className={`text-sm font-inter ${darkMuted}`}>
                  No diagnosis recorded yet.
                </Text>
              ) : (
                <View className="gap-2">
                  {current.diagnoses.map((d, i) => (
                    <View key={d.id || i} className={`p-3 rounded-btn ${dark ? "bg-white/5" : "bg-bg"}`}>
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className={`text-sm font-bold font-inter flex-1 ${darkText}`}>{d.probableCause}</Text>
                        <View className="flex-row items-center gap-2">
                          <Text className={`text-[10px] font-inter ${darkMuted}`}>{relativeTime(d.recordedAt)}</Text>
                          {canDiagnose && openStatus && (
                            <Pressable onPress={() => openEdit("diagnosis", d, i)} hitSlop={6}>
                              <Text className="text-[11px] font-inter font-semibold text-primary">Edit</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                      {d.details ? (
                        <Text className={`text-xs font-inter ${darkMuted}`}>{d.details}</Text>
                      ) : null}
                      {d.technicianName ? (
                        <Text className={`text-[10px] font-inter mt-1 ${darkMuted}`}>by {d.technicianName}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Actions */}
            <Card>
              <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>
                Actions performed ({current.actions.length})
              </Text>
              {current.actions.length === 0 ? (
                <Text className={`text-sm font-inter ${darkMuted}`}>
                  No maintenance action recorded yet.
                </Text>
              ) : (
                <View className="gap-2">
                  {current.actions.map((a, i) => (
                    <View key={a.id || i} className={`p-3 rounded-btn ${dark ? "bg-white/5" : "bg-bg"}`}>
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className={`text-sm font-inter flex-1 ${darkText}`}>{a.description}</Text>
                        <View className="flex-row items-center gap-2 ml-2">
                          {typeof a.durationMinutes === "number" ? (
                            <Text className={`text-[10px] font-inter ${darkMuted}`}>{a.durationMinutes} min</Text>
                          ) : null}
                          {canDiagnose && openStatus && (
                            <Pressable onPress={() => openEdit("action", a, i)} hitSlop={6}>
                              <Text className="text-[11px] font-inter font-semibold text-primary">Edit</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                      <View className="flex-row items-center justify-between">
                        {a.partsReplaced ? (
                          <Text className={`text-xs font-inter flex-1 ${darkMuted}`}>Parts: {a.partsReplaced}</Text>
                        ) : (
                          <View className="flex-1" />
                        )}
                        <Text className={`text-[10px] font-inter ${darkMuted}`}>{relativeTime(a.performedAt)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Observations */}
            <Card>
              <Text className={`text-base font-bold font-inter mb-3 ${darkText}`}>
                Observations ({current.observations.length})
              </Text>
              {current.observations.length === 0 ? (
                <Text className={`text-sm font-inter ${darkMuted}`}>
                  No observation recorded yet.
                </Text>
              ) : (
                <View className="gap-2">
                  {current.observations.map((o, i) => (
                    <View key={o.id || i} className={`p-3 rounded-btn ${dark ? "bg-white/5" : "bg-bg"}`}>
                      <View className="flex-row items-center justify-between mb-1">
                        <View className="px-2 py-0.5 rounded-chip" style={chip("#2563EB")}>
                          <Text className="text-[10px] font-bold font-inter" style={{ color: "#2563EB" }}>
                            {OBSERVATION_CATEGORY_LABELS[o.category] || o.category || "General"}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Text className={`text-[10px] font-inter ${darkMuted}`}>{relativeTime(o.recordedAt)}</Text>
                          {canObserve && openStatus && (
                            <Pressable onPress={() => openEdit("observation", o, i)} hitSlop={6}>
                              <Text className="text-[11px] font-inter font-semibold text-primary">Edit</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                      <Text className={`text-sm font-inter ${darkText}`}>{o.content}</Text>
                      {o.authorName ? (
                        <Text className={`text-[10px] font-inter mt-1 ${darkMuted}`}>by {o.authorName}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </View>
        )}
      </ScrollView>

      {/* ── Action sheets ─────────────────────────────────────────────── */}
      <BottomSheet
        visible={sheet === "assign"}
        onClose={() => setSheet(null)}
        title="Assign technician"
        maxWidth={520}
        footer={sheetFooter("Assign", submitAssign, { disabled: !assignTech, loading: sheetBusy })}
      >
        {sheetError && <Text className="text-sm text-danger font-inter mb-3">{sheetError}</Text>}
        {technicianOptions.length > 0 ? (
          <Select
            label="Technician"
            value={assignTech}
            onValueChange={setAssignTech}
            options={technicianOptions}
            placeholder="Select technician..."
          />
        ) : (
          <Input
            label="Technician email or ID"
            placeholder="e.g. js@company.com"
            value={assignTech || ""}
            onChangeText={setAssignTech}
          />
        )}
      </BottomSheet>

      <BottomSheet
        visible={sheet === "diagnosis"}
        onClose={() => setSheet(null)}
        title="Record diagnosis"
        maxWidth={520}
        footer={sheetFooter("Save diagnosis", submitDiagnosis, {
          disabled: !diagForm.probableCause.trim(),
          loading: sheetBusy,
        })}
      >
        {sheetError && <Text className="text-sm text-danger font-inter mb-3">{sheetError}</Text>}
        <View className="gap-3">
          <Input
            label="Probable cause *"
            placeholder="e.g. Bearing wear / couplings misaligned"
            value={diagForm.probableCause}
            onChangeText={(v) => setDiagForm((f) => ({ ...f, probableCause: v }))}
          />
          <Input
            label="Details"
            placeholder="Technical details..."
            value={diagForm.details}
            onChangeText={(v) => setDiagForm((f) => ({ ...f, details: v }))}
            multiline
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === "action"}
        onClose={() => setSheet(null)}
        title="Record action performed"
        maxWidth={520}
        footer={sheetFooter("Save action", submitAction, {
          disabled: !actionForm.description.trim(),
          loading: sheetBusy,
        })}
      >
        {sheetError && <Text className="text-sm text-danger font-inter mb-3">{sheetError}</Text>}
        <View className="gap-3">
          <Input
            label="Description *"
            placeholder="e.g. Replaced the drive coupling"
            value={actionForm.description}
            onChangeText={(v) => setActionForm((f) => ({ ...f, description: v }))}
          />
          <Input
            label="Parts replaced"
            placeholder="e.g. SKF-608 bearing"
            value={actionForm.partsReplaced}
            onChangeText={(v) => setActionForm((f) => ({ ...f, partsReplaced: v }))}
          />
          <Input
            label="Duration (minutes)"
            placeholder="e.g. 45"
            value={actionForm.durationMinutes}
            onChangeText={(v) => setActionForm((f) => ({ ...f, durationMinutes: v }))}
            keyboardType="number-pad"
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === "observation"}
        onClose={() => setSheet(null)}
        title="Add observation"
        maxWidth={520}
        footer={sheetFooter("Save observation", submitObservation, {
          disabled: !obsForm.content.trim(),
          loading: sheetBusy,
        })}
      >
        {sheetError && <Text className="text-sm text-danger font-inter mb-3">{sheetError}</Text>}
        <View className="gap-3">
          <Select
            label="Category"
            value={obsForm.category}
            onValueChange={(v) => setObsForm((f) => ({ ...f, category: v }))}
            options={OBSERVATION_CATEGORIES}
          />
          <Input
            label="Observation *"
            placeholder="What did you notice on the machine?"
            value={obsForm.content}
            onChangeText={(v) => setObsForm((f) => ({ ...f, content: v }))}
            multiline
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === "close"}
        onClose={() => setSheet(null)}
        title="Close intervention"
        maxWidth={520}
        footer={sheetFooter("Close intervention", submitClose, {
          disabled: !!current && current.diagnoses.length === 0 && current.actions.length === 0,
          loading: sheetBusy,
        })}
      >
        {sheetError && <Text className="text-sm text-danger font-inter mb-3">{sheetError}</Text>}
        <Text className={`text-xs font-inter mb-3 ${darkMuted}`}>
          Closing is terminal — the intervention will no longer be editable.
        </Text>
        {current && current.diagnoses.length === 0 && current.actions.length === 0 ? (
          <View
            className="bg-danger/10 rounded-btn px-3 py-2 mb-3"
            style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}
          >
            <Text className="text-xs text-danger font-inter">
              Record at least one diagnosis or action before closing — the
              server requires it.
            </Text>
          </View>
        ) : null}
        <View className="gap-3">
          <Input
            label="Closure notes"
            placeholder="Root cause, outcome, recommendations..."
            value={closeForm.closureNotes}
            onChangeText={(v) => setCloseForm((f) => ({ ...f, closureNotes: v }))}
            multiline
          />
          {isResponsable && (
            <Pressable
              onPress={() => setCloseForm((f) => ({ ...f, restoreMachineStatus: !f.restoreMachineStatus }))}
              className="flex-row items-center gap-2"
            >
              <View
                className={`w-5 h-5 rounded items-center justify-center ${closeForm.restoreMachineStatus ? "bg-primary" : dark ? "border border-white/30" : "border border-border bg-surface"}`}
              >
                {closeForm.restoreMachineStatus ? <Text className="text-white text-xs">✓</Text> : null}
              </View>
              <Text className={`text-sm font-inter ${darkText}`}>
                Restore the machine status to RUNNING
              </Text>
            </Pressable>
          )}
        </View>
      </BottomSheet>
      {/* ── Item 10 — technician status + edit sheets ────────────────────── */}
      <BottomSheet
        visible={sheet === "status"}
        onClose={() => setSheet(null)}
        title={statusChoice === "COMPLETED" ? "Complete intervention" : "Start the intervention"}
        maxWidth={480}
        footer={
          <View className="flex-row gap-2 justify-end">
            <Button title="Cancel" variant="ghost" size="sm" onPress={() => setSheet(null)} />
            <Button
              title={statusChoice === "COMPLETED" ? "Complete…" : "Start (in progress)"}
              variant="primary"
              size="sm"
              loading={sheetBusy}
              onPress={() => {
                if (statusChoice === "COMPLETED") {
                  setCloseForm((f) => ({ ...f, closureNotes: f.closureNotes }));
                  setSheet("close");
                } else {
                  submitStatus();
                }
              }}
            />
          </View>
        }
      >
        {sheetError && <Text className="text-sm text-danger font-inter mb-3">{sheetError}</Text>}
        <Text className={`text-sm font-inter ${darkMuted}`}>
          {statusChoice === "COMPLETED"
            ? "Marking the work as done. If there is no diagnosis or action recorded yet, add one first — the server requires it."
            : "You received this intervention: mark it as In progress to signal the work has started. It starts as \"To do\" (PENDING)."}
        </Text>
      </BottomSheet>

      <BottomSheet
        visible={sheet === "details"}
        onClose={() => setSheet(null)}
        title="Edit intervention details"
        maxWidth={520}
        footer={sheetFooter("Save changes", submitDetails, {
          disabled: !detailsForm.title.trim(),
          loading: sheetBusy,
        })}
      >
        {sheetError && <Text className="text-sm text-danger font-inter mb-3">{sheetError}</Text>}
        <View className="gap-3">
          <Input
            label="Title *"
            placeholder="e.g. High vibration on CNC-024"
            value={detailsForm.title}
            onChangeText={(v) => setDetailsForm((f) => ({ ...f, title: v }))}
          />
          <Input
            label="Description"
            placeholder="What needs to be done…"
            value={detailsForm.description}
            onChangeText={(v) => setDetailsForm((f) => ({ ...f, description: v }))}
            multiline
          />
          <Select
            label="Priority"
            value={detailsForm.priority}
            onValueChange={(v) => setDetailsForm((f) => ({ ...f, priority: v }))}
            options={[
              { value: "LOW", label: getTicketPriority("LOW").label },
              { value: "MEDIUM", label: getTicketPriority("MEDIUM").label },
              { value: "HIGH", label: getTicketPriority("HIGH").label },
            ]}
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === "editDiagnosis"}
        onClose={() => setSheet(null)}
        title="Edit diagnosis"
        maxWidth={520}
        footer={sheetFooter("Save", submitEditEntry, {
          disabled: !diagForm.probableCause.trim(),
          loading: sheetBusy,
        })}
      >
        {sheetError && <Text className="text-sm text-danger font-inter mb-3">{sheetError}</Text>}
        <View className="gap-3">
          <Input
            label="Probable cause *"
            placeholder="e.g. Bearing wear / couplings misaligned"
            value={diagForm.probableCause}
            onChangeText={(v) => setDiagForm((f) => ({ ...f, probableCause: v }))}
          />
          <Input
            label="Details"
            placeholder="Technical details..."
            value={diagForm.details}
            onChangeText={(v) => setDiagForm((f) => ({ ...f, details: v }))}
            multiline
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === "editAction"}
        onClose={() => setSheet(null)}
        title="Edit action performed"
        maxWidth={520}
        footer={sheetFooter("Save", submitEditEntry, {
          disabled: !actionForm.description.trim(),
          loading: sheetBusy,
        })}
      >
        {sheetError && <Text className="text-sm text-danger font-inter mb-3">{sheetError}</Text>}
        <View className="gap-3">
          <Input
            label="Description *"
            placeholder="e.g. Replaced the drive coupling"
            value={actionForm.description}
            onChangeText={(v) => setActionForm((f) => ({ ...f, description: v }))}
            multiline
          />
          <Input
            label="Parts fixed or replaced"
            placeholder="e.g. SKF-608 bearing"
            value={actionForm.partsReplaced}
            onChangeText={(v) => setActionForm((f) => ({ ...f, partsReplaced: v }))}
          />
          <Input
            label="Duration (minutes)"
            placeholder="e.g. 45"
            value={actionForm.durationMinutes}
            onChangeText={(v) => setActionForm((f) => ({ ...f, durationMinutes: v }))}
            keyboardType="number-pad"
          />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === "editObservation"}
        onClose={() => setSheet(null)}
        title="Edit observation"
        maxWidth={520}
        footer={sheetFooter("Save", submitEditEntry, {
          disabled: !obsForm.content.trim(),
          loading: sheetBusy,
        })}
      >
        {sheetError && <Text className="text-sm text-danger font-inter mb-3">{sheetError}</Text>}
        <View className="gap-3">
          <Select
            label="Category"
            value={obsForm.category}
            onValueChange={(v) => setObsForm((f) => ({ ...f, category: v }))}
            options={OBSERVATION_CATEGORIES}
          />
          <Input
            label="Observation *"
            placeholder="What did you notice on the machine?"
            value={obsForm.content}
            onChangeText={(v) => setObsForm((f) => ({ ...f, content: v }))}
            multiline
          />
        </View>
      </BottomSheet>
    </AppShell>
  );
}
