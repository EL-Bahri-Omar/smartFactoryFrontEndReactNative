// src/components/AddMachineModal.jsx
// Create / edit machine modal. Wired to createMachine / updateMachine thunks.
// CONFIRMED Sprint 1: POST needs { name, code, type } (code unique).
// PUT needs the full object (name, code, type, status required).
// zoneId comes from the real zone list, status defaults IDLE on create.

import { useEffect, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView } from "react-native";
import Input from "./Input";
import Select from "./Select";
import Button from "./Button";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { createMachine, updateMachine, fetchMachines, fetchMachineCounts } from "../store/slices/machineSlice";
import { fetchZones } from "../store/slices/zoneSlice";
import { MACHINE_STATUS } from "../constants/roles";

const STATUS_OPTIONS = [
  { value: MACHINE_STATUS.RUNNING, label: "Running" },
  { value: MACHINE_STATUS.IDLE, label: "Idle" },
  { value: MACHINE_STATUS.MAINTENANCE, label: "Maintenance" },
  { value: MACHINE_STATUS.FAILURE, label: "Failure" },
  { value: MACHINE_STATUS.OFFLINE, label: "Offline" },
];

export default function AddMachineModal({ visible, machine, onClose }) {
  const dispatch = useAppDispatch();
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
      dispatch(fetchZones());
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
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        className="flex-1 bg-black/40 justify-center items-center px-4"
        onPress={onClose}
      >
        <Pressable
          className="bg-surface rounded-card w-full border border-border"
          style={{ maxWidth: 480 }}
          onPress={() => {}} // prevent bubbling
        >
          <ScrollView>
            <View className="p-6">
              <Text className="text-lg font-bold text-text font-inter mb-1">
                {isEdit ? "Edit Machine" : "Add Machine"}
              </Text>
              <Text className="text-sm text-text-muted font-inter mb-5">
                {isEdit ? "Update the machine details." : "Register a new machine to the monitoring system."}
              </Text>

              {error && (
                <View className="bg-danger/10 rounded-btn px-3 py-2 mb-4" style={{ borderWidth: 1, borderColor: "rgba(220,38,38,0.25)" }}>
                  <Text className="text-sm text-danger font-inter">{error}</Text>
                </View>
              )}

              <View className="gap-4">
                <Input
                  label="Machine Name"
                  placeholder="e.g. CNC Milling Machine"
                  value={name}
                  onChangeText={setName}
                />
                <Input
                  label="Machine Code (unique)"
                  placeholder="e.g. CNC-024"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                />
                <Select
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
                  label="Zone"
                  value={zoneId}
                  onValueChange={setZoneId}
                  placeholder="Select zone..."
                  options={(zones || []).map((z) => ({ value: z.id, label: z.name }))}
                />
                {isEdit && (
                  <Select
                    label="Status"
                    value={status}
                    onValueChange={setStatus}
                    options={STATUS_OPTIONS}
                  />
                )}
                {isEdit && (
                  <Input
                    label="Description (optional)"
                    placeholder="Short description..."
                    value={description}
                    onChangeText={setDescription}
                  />
                )}
              </View>

              <View className="flex-row gap-3 mt-6 justify-end">
                <Button title="Cancel" variant="ghost" onPress={onClose} />
                <Button
                  title={isEdit ? "Save Changes" : "Create Machine"}
                  variant="primary"
                  onPress={handleSave}
                  loading={saving}
                  disabled={!name.trim() || !code.trim() || !type}
                />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
