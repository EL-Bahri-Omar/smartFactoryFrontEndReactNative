// src/components/InterventionModal.jsx
//
// Sprint 6 — "Create Intervention" modal (US42, CONFIRMED backend).
// Opened from the Maintenance screen and from the Alerts screen (with the
// alert pre-filled: alert → intervention link).
//
// POST /api/maintenance body (InterventionCreateRequest):
//   machineId (id OR code — server-resolved), title (required),
//   description?, type: CORRECTIVE|PREVENTIVE|IMPROVEMENT (required),
//   preventiveSubtype: SYSTEMATIC|CONDITIONAL (required iff PREVENTIVE),
//   priority: LOW|MEDIUM|HIGH (default MEDIUM), alertId?, anomalyId?,
//   technicianIds?: [id]  (team chosen at creation; each technician notified), scheduledAt?
//
// SCHEDULED DATE RULE: the "Scheduled for" picker only renders for
// PREVENTIVE and IMPROVEMENT interventions — a corrective fix is reactive,
// so there is nothing to schedule (per review feedback).
//
// The technician picker is a MULTI-SELECT list (checkbox rows) so the
// responsable can build the whole team when creating the intervention
// (US43: an intervention can have several technicians). It only appears when
// a technician list is available (USER_READ); with no technician accounts it
// shows an honest note — the assignment can be done later from the
// intervention detail screen (server resolves ids by Mongo id or email).
//
// Web details: the sheet is widened (maxWidth 760) and the scheduled date
// uses SEPARATE date + time native inputs with explicit light
// color-scheme — a full datetime-local input opens Chrome's oversized
// dark calendar popup that swallows the form (fixed in review).

import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Input from "./Input";
import Select from "./Select";
import Button from "./Button";
import BottomSheet from "./BottomSheet";
import DateTimeInput from "./DateTimeInput";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { createIntervention } from "../store/slices/interventionSlice";
import { fetchMachines } from "../store/slices/machineSlice";
import { fetchTechnicians } from "../store/slices/userSlice";
import { TICKET_PRIORITY } from "../constants/roles";
import { getTicketPriority, INTERVENTION_TYPE_LABELS, PREVENTIVE_SUBTYPE_LABELS } from "../lib/status";
import { useDark } from "../hooks/useDark";
import { useDialog } from "./dialog/DialogContext";

const PRIORITY_OPTIONS = Object.values(TICKET_PRIORITY).map((p) => ({
  value: p,
  label: getTicketPriority(p).label,
}));

const TYPE_OPTIONS = [
  { value: "CORRECTIVE", label: INTERVENTION_TYPE_LABELS.CORRECTIVE },
  { value: "PREVENTIVE", label: INTERVENTION_TYPE_LABELS.PREVENTIVE },
  { value: "IMPROVEMENT", label: INTERVENTION_TYPE_LABELS.IMPROVEMENT },
];

const SUBTYPE_OPTIONS = [
  { value: "SYSTEMATIC", label: PREVENTIVE_SUBTYPE_LABELS.SYSTEMATIC },
  { value: "CONDITIONAL", label: PREVENTIVE_SUBTYPE_LABELS.CONDITIONAL },
];

/** Only planned work gets a schedule — corrective is reactive. */
function typeAllowsSchedule(t) {
  return t === "PREVENTIVE" || t === "IMPROVEMENT";
}

export default function InterventionModal({ visible, onClose, prefill = null }) {
  const dispatch = useAppDispatch();
  const dialog = useDialog();
  const dark = useDark();
  const { list: machines } = useAppSelector((s) => s.machine);
  const { list: users, technicians, techniciansStatus } = useAppSelector((s) => s.user);

  const [machineId, setMachineId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("CORRECTIVE");
  const [preventiveSubtype, setPreventiveSubtype] = useState(null);
  const [priority, setPriority] = useState("MEDIUM");
  const [technicianIds, setTechnicianIds] = useState([]); // team: [mongoId]
  const [scheduledAt, setScheduledAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const machineOptions = (machines || []).map((m) => ({
    value: m.id || m.code,
    label: `${m.code || m.machineCode || m.id} — ${m.name || m.type || "Machine"}`,
  }));

  // Technician candidates: GET /api/users/technicians (any authenticated
  // role — the responsable has no USER_READ). Fallback to the full users
  // list when that endpoint is not available yet (backend not restarted).
  // Value MUST be the Mongo id (backend also accepts the email).
  const techSource =
    techniciansStatus === "error" || (technicians || []).length === 0
      ? (users || []).filter((u) => u.role === "TECHNICIAN")
      : technicians;
  const technicianOptions = techSource.map((u) => ({
    value: u.id || u.email,
    label: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
    sub: u.email || "",
  }));

  /** Add/remove one technician from the team (multi-select). */
  function toggleTechnician(id) {
    setTechnicianIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  useEffect(() => {
    if (!visible) return;
    if (!prefill?.machineId) dispatch(fetchMachines({ size: 100 }));
    // Silent best-effort fetch to fill the technician picker (deduped by
    // the slice status — no refetch when the list is already warm).
    if (techniciansStatus === "idle") dispatch(fetchTechnicians());
    setMachineId(prefill?.machineId || prefill?.machineCode || "");
    setTitle(prefill?.title || (prefill?.alertMessage ? `Fix: ${prefill.alertMessage}` : ""));
    setDescription(prefill?.description || "");
    setType(prefill?.type || "CORRECTIVE");
    setPreventiveSubtype(prefill?.type === "PREVENTIVE" ? prefill?.preventiveSubtype || null : null);
    setPriority(prefill?.priority || "MEDIUM");
    setTechnicianIds([]);
    setScheduledAt(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, prefill]);

  async function handleSubmit() {
    if (!machineId || !title.trim()) return;
    if (type === "PREVENTIVE" && !preventiveSubtype) return;
    setSaving(true);
    setError(null);
    try {
      await dispatch(
        createIntervention({
          machineId,
          alertId: prefill?.alertId || undefined,
          anomalyId: prefill?.anomalyId || undefined,
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          preventiveSubtype: type === "PREVENTIVE" ? preventiveSubtype || undefined : undefined,
          priority,
          technicianIds: technicianIds.length > 0 ? technicianIds : undefined,
          scheduledAt:
            typeAllowsSchedule(type) && scheduledAt
              ? new Date(scheduledAt).toISOString()
              : undefined,
        })
      ).unwrap();
      dialog.alert("Intervention created", "The maintenance intervention has been submitted.", "success");
      onClose();
    } catch (e) {
      setError(e?.message || "Failed to create the intervention.");
    } finally {
      setSaving(false);
    }
  }

  const chipBase = dark ? "bg-white/5 border border-white/15" : "bg-bg border border-border";
  const muted = dark ? "text-white/60" : "text-text-muted";

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxWidth={760}
      title="Create Intervention"
      subtitle={
        prefill?.alertId
          ? "Linked to the selected alert — the details are pre-filled."
          : "Describe the work and pick the technicians for the job."
      }
      footer={
        <View className="flex-row gap-2 justify-end">
          <Button title="Cancel" variant="ghost" size="sm" onPress={onClose} />
          <Button
            title="Create Intervention"
            variant="primary"
            size="sm"
            onPress={handleSubmit}
            loading={saving}
            disabled={
              !machineId ||
              !title.trim() ||
              (type === "PREVENTIVE" && !preventiveSubtype)
            }
          />
        </View>
      }
    >
      <View>
        {error && (
          <View
            className="bg-danger/10 rounded-btn px-3 py-2 mb-3"
            style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}
          >
            <Text className="text-sm text-danger font-inter">{error}</Text>
          </View>
        )}

        <View className="gap-3">
          {/* ── Row 1: machine + title (side by side on wide sheets) ── */}
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1" style={{ minWidth: 240 }}>
              <Select
                label="Machine"
                value={machineId}
                onValueChange={setMachineId}
                placeholder="Select machine..."
                options={machineOptions}
                disabled={!!prefill?.machineId}
              />
            </View>
            <View className="flex-1" style={{ minWidth: 240 }}>
              <Input
                label="Title"
                placeholder="e.g. High vibration on CNC-024"
                value={title}
                onChangeText={setTitle}
              />
            </View>
          </View>

          <Input
            label="Description"
            placeholder="Describe the issue..."
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {/* Type — required by the backend (US42) */}
          <View>
            <Text className={`text-xs font-semibold font-inter mb-1.5 ${muted}`}>Type *</Text>
            <View className="flex-row flex-wrap gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const active = type === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      setType(opt.value);
                      if (opt.value !== "PREVENTIVE") setPreventiveSubtype(null);
                      // Corrective has no schedule — drop a stale date.
                      if (!typeAllowsSchedule(opt.value)) setScheduledAt(null);
                    }}
                    className={`px-3 py-1.5 rounded-chip ${active ? "bg-primary" : chipBase}`}
                  >
                    <Text
                      className={`text-xs font-semibold font-inter ${active ? "text-white" : dark ? "text-white/70" : "text-text-muted"}`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Subtype (PREVENTIVE only) + priority share one row so the whole
              form — buttons included — fits without scrolling. */}
          <View className="flex-row flex-wrap gap-3">
            {type === "PREVENTIVE" && (
              <View style={{ minWidth: 170, flex: 1 }}>
                <Select
                  label="Preventive subtype *"
                  value={preventiveSubtype}
                  onValueChange={setPreventiveSubtype}
                  options={SUBTYPE_OPTIONS}
                  placeholder="Select subtype..."
                />
              </View>
            )}
            <View style={{ minWidth: 160, flex: 1 }}>
              <Select label="Priority" value={priority} onValueChange={setPriority} options={PRIORITY_OPTIONS} />
            </View>
          </View>

          {/* ── Team of technicians (multi-select list) ── */}
          {technicianOptions.length > 0 && (
            <View>
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className={`text-xs font-semibold font-inter ${muted}`}>
                  Technicians {technicianIds.length > 0 ? `(${technicianIds.length} selected)` : "(optional)"}
                </Text>
                {technicianIds.length > 0 && (
                  <Pressable onPress={() => setTechnicianIds([])} hitSlop={8}>
                    <Text className="text-[11px] font-inter font-semibold text-primary">Clear</Text>
                  </Pressable>
                )}
              </View>
              <ScrollView
                style={{ maxHeight: 168 }}
                className={`rounded-btn border ${dark ? "bg-white/5 border-white/15" : "bg-bg border-border"}`}
                showsVerticalScrollIndicator={false}
              >
                {technicianOptions.map((tech) => {
                  const active = technicianIds.includes(tech.value);
                  return (
                    <Pressable
                      key={tech.value}
                      onPress={() => toggleTechnician(tech.value)}
                      className={`flex-row items-center px-3 py-2.5 border-b ${dark ? "border-white/5" : "border-border/50"}`}
                      style={({ pressed }) => [
                        { backgroundColor: active ? "rgba(37,99,235,0.08)" : "transparent" },
                        pressed ? { opacity: 0.8 } : null,
                      ]}
                    >
                      {/* Checkbox */}
                      <View
                        className="w-5 h-5 rounded-btn items-center justify-center mr-3"
                        style={{
                          borderWidth: 1.5,
                          borderColor: active ? "#2563EB" : dark ? "rgba(255,255,255,0.35)" : "#CBD5E1",
                          backgroundColor: active ? "#2563EB" : "transparent",
                        }}
                      >
                        {active && <Text className="text-[11px] font-bold text-white">✓</Text>}
                      </View>
                      <View className="flex-1">
                        <Text className={`text-sm font-inter ${active ? "font-semibold" : "font-medium"} ${dark ? "text-white" : "text-text"}`}>
                          {tech.label}
                        </Text>
                        {tech.sub ? (
                          <Text className={`text-[11px] font-inter ${muted}`} numberOfLines={1}>
                            {tech.sub}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text className={`text-[11px] font-inter mt-1 ${muted}`}>
                Each selected technician receives the assignment notification.
              </Text>
            </View>
          )}

          {(techniciansStatus === "succeeded" || techniciansStatus === "error") &&
            technicianOptions.length === 0 && (
            <Text className={`text-xs font-inter ${muted}`}>
              No technician accounts yet — you can assign a team later from the
              intervention detail screen.
            </Text>
          )}

          {/* Scheduled at — PREVENTIVE + IMPROVEMENT only (planned work) */}
          {typeAllowsSchedule(type) && (
            <View>
              <Text className={`text-xs font-semibold font-inter mb-1.5 ${muted}`}>
                Scheduled for (optional)
              </Text>
              <DateTimeInput
                value={scheduledAt}
                onChange={setScheduledAt}
                placeholder="Select date & time"
              />
            </View>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}
