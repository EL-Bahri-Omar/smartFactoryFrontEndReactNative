// src/components/AddMachineModal.jsx
// Create / edit machine modal. Wired to createMachine / updateMachine thunks.
// CONFIRMED Sprint 1: POST needs { name, code, type } (code unique).
// PUT needs the full object (name, code, type, status required).
// zoneId comes from the real zone list, status defaults IDLE on create.

import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Input from "./Input";
import Select from "./Select";
import Button from "./Button";
import BottomSheet from "./BottomSheet";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { createMachine, updateMachine, fetchMachines, fetchMachineCounts } from "../store/slices/machineSlice";
import { fetchZones } from "../store/slices/zoneSlice";
import { MACHINE_STATUS } from "../constants/roles";
import { getMachineStatus } from "../lib/status";

const STATUS_OPTIONS = [
  { value: MACHINE_STATUS.RUNNING, label: "Running", dot: getMachineStatus(MACHINE_STATUS.RUNNING).dotColor },
  { value: MACHINE_STATUS.IDLE, label: "Idle", dot: getMachineStatus(MACHINE_STATUS.IDLE).dotColor },
  { value: MACHINE_STATUS.MAINTENANCE, label: "Maintenance", dot: getMachineStatus(MACHINE_STATUS.MAINTENANCE).dotColor },
  { value: MACHINE_STATUS.FAILURE, label: "Failure", dot: getMachineStatus(MACHINE_STATUS.FAILURE).dotColor },
  { value: MACHINE_STATUS.OFFLINE, label: "Offline", dot: getMachineStatus(MACHINE_STATUS.OFFLINE).dotColor },
];

export default function AddMachineModal({ visible, machine, onClose }) {
  const dispatch = useAppDispatch();
  const isDesktop = useBreakpoint() === "desktop";
  const { list: zones } = useAppSelector((s) => s.zone);
  const isEdit = !!machine;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [status, setStatus] = useState(MACHINE_STATUS.IDLE);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible) {
      // Only fetch zones when the list isn't warm already (popup opens are
      // frequent — avoid a duplicate request per open).
      if ((zones || []).length === 0) dispatch(fetchZones());
      setName(machine?.name || "");
      setCode(machine?.code || "");
      setType(machine?.type || "");
      setZoneId(machine?.zoneId || "");
      setStatus(machine?.status || MACHINE_STATUS.IDLE);
      setDescription(machine?.description || "");
      setError(null);
    }
  }, [visible, machine, dispatch]);

  async function handleSave() {
    if (!name.trim() || !code.trim() || !type) return;
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await dispatch(updateMachine({
          id: machine.id,
          body: {
            name: name.trim(),
            code: code.trim(),
            type,
            zoneId: zoneId || null,
            status,
            description: description.trim() || null,
            caracteristiques: machine.caracteristiques || [],
          },
        })).unwrap();
      } else {
        await dispatch(createMachine({
          name: name.trim(),
          code: code.trim(),
          type,
          zoneId: zoneId || undefined,
          status: "IDLE",
        })).unwrap();
      }
      setName("");
      setCode("");
      setType("");
      setZoneId("");
      setStatus(MACHINE_STATUS.IDLE);
      setDescription("");
      dispatch(fetchMachines());
      dispatch(fetchMachineCounts());
      onClose();
    } catch (e) {
      // Backend codes: MACHINE_ALREADY_EXISTS (code taken), VALIDATION_ERROR, FORBIDDEN (non-ADMIN).
      setError(e?.message || "Failed to save machine.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxWidth={560}
      title={isEdit ? "Edit Machine" : "Add Machine"}
      subtitle={isEdit ? "Update the machine details." : "Register a new machine to the monitoring system."}
      footer={
        <View className="flex-row gap-2 justify-end">
          <Button title="Cancel" variant="ghost" size="sm" onPress={onClose} />
          <Button
            title={isEdit ? "Save Changes" : "Create Machine"}
            variant="primary"
            size="sm"
            onPress={handleSave}
            loading={saving}
            disabled={!name.trim() || !code.trim() || !type}
          />
        </View>
      }
    >
      <View>
        {error && (
          <View className="bg-danger/10 rounded-btn px-3 py-2 mb-3" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
            <Text className="text-sm text-danger font-inter">{error}</Text>
          </View>
        )}

        {/* Two columns on desktop: the whole form + its buttons fit without
            scrolling inside the dialog. */}
        <View className="gap-3">
          <View className={isDesktop ? "flex-row gap-3" : "gap-3"}>
            <Input
              className={isDesktop ? "flex-1" : ""}
              label="Machine Name"
              placeholder="e.g. CNC Milling Machine"
              value={name}
              onChangeText={setName}
            />
            <Input
              className={isDesktop ? "flex-1" : ""}
              label="Machine Code (unique)"
              placeholder="e.g. CNC-024"
              value={code}
              onChangeText={setCode}
            />
          </View>

          <View className={isDesktop ? "flex-row gap-3" : "gap-3"}>
            <Select
              className={isDesktop ? "flex-1" : ""}
              label="Type"
              value={type}
              onValueChange={setType}
              placeholder="Select type..."
              options={[
                { value: "CNC", label: "CNC" },
                { value: "Motor", label: "Motor" },
                { value: "Conveyor", label: "Conveyor" },
                { value: "Compressor", label: "Compressor" },
                { value: "Pump", label: "Pump" },
                { value: "Boiler", label: "Boiler" },
                { value: "Fan", label: "Fan" },
                { value: "Generator", label: "Generator" },
              ]}
            />
            <Select
              className={isDesktop ? "flex-1" : ""}
              label="Zone"
              value={zoneId}
              onValueChange={setZoneId}
              placeholder="Select zone..."
              options={(zones || []).map((z) => ({ value: z.id, label: z.name }))}
            />
          </View>

          {isEdit && (
            <View className={isDesktop ? "flex-row gap-3" : "gap-3"}>
              <Select
                className={isDesktop ? "flex-1" : ""}
                label="Status"
                value={status}
                onValueChange={setStatus}
                options={STATUS_OPTIONS}
              />
              <Input
                className={isDesktop ? "flex-1" : ""}
                label="Description (optional)"
                placeholder="Short description..."
                value={description}
                onChangeText={setDescription}
              />
            </View>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}
