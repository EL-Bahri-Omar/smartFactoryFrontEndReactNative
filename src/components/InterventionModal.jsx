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
//   technicianId?, scheduledAt?
//
// SCHEDULED DATE RULE: the "Scheduled for" picker only renders for
// PREVENTIVE and IMPROVEMENT interventions — a corrective fix is reactive,
// so there is nothing to schedule (per review feedback).
//
// The technician picker only appears when a technician list is available
// (USER_READ); with no technician accounts it shows an honest note — the
// assignment can be done later from the intervention detail screen
// (server resolves technicianId by Mongo id or email).
//
// Web details: the sheet is widened (maxWidth 760) and the scheduled date
// uses SEPARATE date + time native inputs with explicit light
// color-scheme — a full datetime-local input opens Chrome's oversized
// dark calendar popup that swallows the form (fixed in review).

import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Input from "./Input";
import Select from "./Select";
import Button from "./Button";
import BottomSheet from "./BottomSheet";
import DateTimeInput from "./DateTimeInput";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { createIntervention } from "../store/slices/interventionSlice";
import { fetchMachines } from "../store/slices/machineSlice";
import { fetchUsers } from "../store/slices/userSlice";
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
  const { list: users, listStatus: usersStatus } = useAppSelector((s) => s.user);

  const [machineId, setMachineId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("CORRECTIVE");
  const [preventiveSubtype, setPreventiveSubtype] = useState(null);
  const [priority, setPriority] = useState("MEDIUM");
  const [technicianId, setTechnicianId] = useState(null);
  const [scheduledAt, setScheduledAt] = useState(null);
  const [techListFailed, setTechListFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const machineOptions = (machines || []).map((m) => ({
    value: m.id || m.code,
    label: `${m.code || m.machineCode || m.id} — ${m.name || m.type || "Machine"}`,
  }));

  // Technician candidates: role TECHNICIAN only (backend validates the id /
  // email it resolves). Users have NO username field — the value MUST be
  // the Mongo id (email fallback in the detail screen).
  const technicianOptions = (users || [])
    .filter((u) => u.role === "TECHNICIAN")
    .map((u) => ({
      value: u.id,
      label: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
    }));

  useEffect(() => {
    if (!visible) return;
    if (!prefill?.machineId) dispatch(fetchMachines({ size: 100 }));
    // Silent best-effort fetch to fill the technician picker. A 403 just
    // hides the list (the user cannot assign anyway per the role rules).
    if (usersStatus !== "succeeded") {
      dispatch(fetchUsers({ size: 100 }))
        .unwrap()
        .then(() => setTechListFailed(false))
        .catch(() => setTechListFailed(true));
    }
    setMachineId(prefill?.machineId || prefill?.machineCode || "");
    setTitle(prefill?.title || (prefill?.alertMessage ? `Fix: ${prefill.alertMessage}` : ""));
    setDescription(prefill?.description || "");
    setType(prefill?.type || "CORRECTIVE");
    setPreventiveSubtype(prefill?.type === "PREVENTIVE" ? prefill?.preventiveSubtype || null : null);
    setPriority(prefill?.priority || "MEDIUM");
    setTechnicianId(null);
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
          technicianId: technicianId || undefined,
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
          : "Describe the work and, if you want, assign a technician."
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

          {/* Subtype (PREVENTIVE only) + priority + technician share one row
              so the whole form — buttons included — fits without scrolling. */}
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
            {!techListFailed && technicianOptions.length > 0 && (
              <View style={{ minWidth: 200, flex: 1 }}>
                <Select
                  label="Technician (optional)"
                  value={technicianId}
                  onValueChange={setTechnicianId}
                  placeholder="Assign now (optional)"
                  options={technicianOptions}
                />
              </View>
            )}
          </View>

          {!techListFailed && usersStatus === "succeeded" && technicianOptions.length === 0 && (
            <Text className={`text-xs font-inter ${muted}`}>
              No technician accounts yet — you can assign one later from the
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
