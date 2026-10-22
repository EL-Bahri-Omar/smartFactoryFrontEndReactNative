// src/store/services/interventionService.js
//
// Sprint 6 — Maintenance interventions. ALL CONFIRMED against the real
// MaintenanceController (US42–US50):
//   POST /api/maintenance                                 Create (US42)
//   GET  /api/maintenance?machineId=&technicianId=&type=
//        &subtype=&status=&from=&to=&page=&size=&sort=    History (US49)
//   GET  /api/maintenance/:id                             Detail
//   PUT  /api/maintenance/:id/assign { technicianId }     Assign (US43)
//   GET  /api/maintenance/:id/anomaly                     Anomaly context (US44)
//   POST /api/maintenance/:id/diagnoses { probableCause, details? }   (US45)
//   POST /api/maintenance/:id/actions { description, partsReplaced?,
//        durationMinutes?, performedAt? }                 (US46)
//   POST /api/maintenance/:id/observations { content, category? }    (US47)
//   PUT  /api/maintenance/:id/close { closureNotes, restoreMachineStatus? } (US48)
//   GET  /api/maintenance/recommendations/:machineId      US50 list
//   POST /api/maintenance/recommendations/:machineId/apply?index=  US50
//
// Enums: type CORRECTIVE|PREVENTIVE|IMPROVEMENT, preventiveSubtype
// SYSTEMATIC|CONDITIONAL (required iff PREVENTIVE), priority
// LOW|MEDIUM|HIGH, status PENDING|ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED.
// Priority chips in this app: they map 1:1 with the backend.

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/maintenance — paginated envelope (Spring Page). */
export async function getAll({
  machineId,
  technicianId,
  type,
  subtype,
  status,
  priority,
  from,
  to,
  page = 0,
  size = 20,
  sort = "createdAt,desc",
} = {}) {
  const response = await api.get(ENDPOINTS.INTERVENTIONS, {
    params: {
      machineId: machineId || undefined,
      technicianId: technicianId || undefined,
      type: type || undefined,
      subtype: subtype || undefined,
      status: status || undefined,
      priority: priority || undefined, // NOTE: not a managed server param; kept for local filtering pass-through
      from: from || undefined,
      to: to || undefined,
      page,
      size,
      sort,
    },
  });
  const data = response.data || {};
  const list = normalizeInterventions(data);
  return {
    list,
    page: data.number ?? data.page ?? page,
    size: data.size ?? size,
    totalElements: data.totalElements ?? list.length,
    totalPages: data.totalPages ?? 1,
  };
}

/** GET /api/maintenance/:id (CONFIRMED). */
export async function getById(id) {
  const url = buildUrl(ENDPOINTS.INTERVENTION_BY_ID, { id });
  const response = await api.get(url);
  return normalizeIntervention(response.data);
}

/**
 * POST /api/maintenance (CONFIRMED US42). machineId accepts the Mongo id OR
 * the machine code (server resolves). type is REQUIRED; preventiveSubtype
 * required only when type === PREVENTIVE. technicianIds (list) optional —
 * when set the intervention is born ASSIGNED and every technician of the
 * team is notified. `technicianId` (single) is still accepted by the server.
 */
export async function create(body) {
  const team = Array.isArray(body.technicianIds)
    ? body.technicianIds.filter(Boolean)
    : body.technicianId
      ? [body.technicianId]
      : [];
  const response = await api.post(ENDPOINTS.INTERVENTIONS, {
    machineId: body.machineId,
    title: body.title,
    description: body.description || undefined,
    type: body.type || "CORRECTIVE",
    preventiveSubtype:
      body.type === "PREVENTIVE" && body.preventiveSubtype
        ? body.preventiveSubtype
        : undefined,
    priority: body.priority || undefined, // defaults to MEDIUM server-side
    alertId: body.alertId || undefined,
    anomalyId: body.anomalyId || undefined,
    technicianIds: team.length > 0 ? team : undefined,
    scheduledAt: body.scheduledAt || undefined,
  });
  return normalizeIntervention(response.data);
}

/**
 * PUT /api/maintenance/:id/assign (CONFIRMED US43) → updated intervention.
 * Accepts ONE technician id or a LIST (the whole team is replaced).
 */
export async function assign(id, technicianIds) {
  const team = Array.isArray(technicianIds)
    ? technicianIds.filter(Boolean)
    : technicianIds
      ? [technicianIds]
      : [];
  const url = buildUrl(ENDPOINTS.INTERVENTION_ASSIGN, { id });
  const response = await api.put(url, { technicianIds: team });
  return normalizeIntervention(response.data);
}

/**
 * PUT /api/maintenance/:id/status { status } — explicit technician-driven
 * status change (PENDING → ASSIGNED → IN_PROGRESS → COMPLETED).
 *
 * NOTE: not yet in the backend MaintenanceController (see docs/backend-todo).
 * The slice surfaces a clear "unsupported" message if it 404s so the UI never
 * silently fails.
 */
export async function updateStatus(id, status) {
  const url = buildUrl(ENDPOINTS.INTERVENTION_STATUS, { id });
  const response = await api.put(url, { status });
  return normalizeIntervention(response.data);
}

/**
 * PUT /api/maintenance/:id { title?, description?, priority?, scheduledAt? }
 * — edit the intervention core fields (technician edits the description,
 * manager edits title/priority). BACKEND TODO (not in the controller yet).
 */
export async function updateDetails(id, body = {}) {
  const url = buildUrl(ENDPOINTS.INTERVENTION_BY_ID, { id });
  const response = await api.put(url, {
    title: body.title ?? undefined,
    description: body.description ?? undefined,
    priority: body.priority ?? undefined,
    scheduledAt: body.scheduledAt ?? undefined,
  });
  return normalizeIntervention(response.data);
}

/**
 * PUT /api/maintenance/:id/diagnoses/:diagnosisId — edit a recorded
 * diagnosis. BACKEND TODO.
 */
export async function updateDiagnosis(id, diagnosisId, body = {}) {
  const url = `${buildUrl(ENDPOINTS.INTERVENTION_DIAGNOSES, { id })}/${diagnosisId}`;
  const response = await api.put(url, {
    probableCause: body.probableCause,
    details: body.details ?? undefined,
  });
  return normalizeIntervention(response.data);
}

/**
 * PUT /api/maintenance/:id/actions/:actionId — edit an action performed
 * (description, parts replaced, duration). BACKEND TODO.
 */
export async function updateAction(id, actionId, body = {}) {
  const url = `${buildUrl(ENDPOINTS.INTERVENTION_ACTIONS, { id })}/${actionId}`;
  const response = await api.put(url, {
    description: body.description,
    partsReplaced: body.partsReplaced ?? undefined,
    durationMinutes: typeof body.durationMinutes === "number" ? body.durationMinutes : undefined,
  });
  return normalizeIntervention(response.data);
}

/**
 * PUT /api/maintenance/:id/observations/:observationId — edit a technical
 * observation. BACKEND TODO.
 */
export async function updateObservation(id, observationId, body = {}) {
  const url = `${buildUrl(ENDPOINTS.INTERVENTION_OBSERVATIONS, { id })}/${observationId}`;
  const response = await api.put(url, {
    content: body.content,
    category: body.category || undefined,
  });
  return normalizeIntervention(response.data);
}

/** GET /api/maintenance/:id/anomaly (CONFIRMED US44) → context Map. */
export async function getAnomalyContext(id) {
  const url = buildUrl(ENDPOINTS.INTERVENTION_ANOMALY, { id });
  const response = await api.get(url);
  return response.data;
}

/** POST /api/maintenance/:id/diagnoses (CONFIRMED US45) → updated intervention. */
export async function addDiagnosis(id, { probableCause, details } = {}) {
  const url = buildUrl(ENDPOINTS.INTERVENTION_DIAGNOSES, { id });
  const response = await api.post(url, { probableCause, details: details || undefined });
  return normalizeIntervention(response.data);
}

/** POST /api/maintenance/:id/actions (CONFIRMED US46) → updated intervention. */
export async function addAction(id, { description, partsReplaced, durationMinutes, performedAt } = {}) {
  const url = buildUrl(ENDPOINTS.INTERVENTION_ACTIONS, { id });
  const response = await api.post(url, {
    description,
    partsReplaced: partsReplaced || undefined,
    durationMinutes: typeof durationMinutes === "number" ? durationMinutes : undefined,
    performedAt: performedAt || undefined,
  });
  return normalizeIntervention(response.data);
}

/** POST /api/maintenance/:id/observations (CONFIRMED US47) → updated intervention. */
export async function addObservation(id, { content, category } = {}) {
  const url = buildUrl(ENDPOINTS.INTERVENTION_OBSERVATIONS, { id });
  const response = await api.post(url, {
    content,
    category: category || "GENERAL",
  });
  return normalizeIntervention(response.data);
}

/**
 * PUT /api/maintenance/:id/close (CONFIRMED US48) — { closureNotes,
 * restoreMachineStatus? }. Closing is terminal: status → COMPLETED,
 * closedAt/closedBy stamped by the server.
 */
export async function close(id, { closureNotes, restoreMachineStatus } = {}) {
  const url = buildUrl(ENDPOINTS.INTERVENTION_CLOSE, { id });
  const response = await api.put(url, {
    closureNotes: closureNotes ?? "",
    restoreMachineStatus: Boolean(restoreMachineStatus),
  });
  return normalizeIntervention(response.data);
}

/** GET /api/maintenance/recommendations/:machineId (CONFIRMED US50) → list. */
export async function getRecommendations(machineId) {
  const url = buildUrl(ENDPOINTS.MAINTENANCE_RECOMMENDATIONS, { machineId });
  const response = await api.get(url);
  const data = response.data;
  return Array.isArray(data) ? data.map(normalizeRecommendation).filter(Boolean) : [];
}

/**
 * POST /api/maintenance/recommendations/:machineId/apply?index=&technicianId=
 * (CONFIRMED US50) → the created intervention.
 */
export async function applyRecommendation(machineId, index, technicianId) {
  const url = buildUrl(ENDPOINTS.MAINTENANCE_RECOMMENDATION_APPLY, { machineId });
  const response = await api.post(url, null, {
    params: {
      index,
      technicianId: technicianId || undefined,
    },
  });
  return normalizeIntervention(response.data);
}

export function normalizeInterventions(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(normalizeIntervention).filter(Boolean);
  if (Array.isArray(data.content)) return data.content.map(normalizeIntervention).filter(Boolean);
  if (Array.isArray(data.interventions)) return data.interventions.map(normalizeIntervention).filter(Boolean);
  const one = normalizeIntervention(data);
  return one ? [one] : [];
}

export function normalizeIntervention(row) {
  if (!row || typeof row !== "object") return null;
  const id = row.id ?? row.interventionId;
  if (!id && !row.title) return null;
  return {
    id,
    machineId: row.machineId ?? null,
    machineCode: row.machineCode ?? null,
    title: row.title || "Intervention",
    description: row.description ?? "",
    type: row.type || "CORRECTIVE",
    preventiveSubtype: row.preventiveSubtype ?? null,
    priority: row.priority || "MEDIUM",
    status: row.status || "PENDING",
    alertId: row.alertId ?? null,
    anomalyId: row.anomalyId ?? null,
    technicianId: row.technicianId ?? null,
    technicianName: row.technicianName ?? row.technicianUsername ?? null,
    // Full team (US43). Falls back to the single lead technician so old
    // backend payloads still render a team of one.
    technicianIds: Array.isArray(row.technicianIds) && row.technicianIds.length > 0
      ? row.technicianIds.filter(Boolean)
      : row.technicianId
        ? [row.technicianId]
        : [],
    technicianNames: Array.isArray(row.technicianNames) && row.technicianNames.length > 0
      ? row.technicianNames.filter(Boolean)
      : row.technicianName
        ? [row.technicianName]
        : [],
    assignedBy: row.assignedBy ?? null,
    assignedAt: row.assignedAt ?? null,
    diagnoses: Array.isArray(row.diagnoses)
      ? row.diagnoses.map((d) => ({
          id: d.id ?? null,
          probableCause: d.probableCause ?? "",
          details: d.details ?? "",
          technicianId: d.technicianId ?? null,
          technicianName: d.technicianName ?? null,
          recordedAt: d.recordedAt ?? null,
        }))
      : [],
    actions: Array.isArray(row.actions)
      ? row.actions.map((a) => ({
          id: a.id ?? null,
          description: a.description ?? "",
          technicianName: a.technicianName ?? null,
          partsReplaced: a.partsReplaced ?? "",
          durationMinutes: typeof a.durationMinutes === "number" ? a.durationMinutes : null,
          performedAt: a.performedAt ?? null,
        }))
      : [],
    observations: Array.isArray(row.observations)
      ? row.observations.map((o) => ({
          id: o.id ?? null,
          content: o.content ?? "",
          authorName: o.authorName ?? o.authorId ?? null,
          category: o.category || "GENERAL",
          recordedAt: o.recordedAt ?? null,
        }))
      : [],
    scheduledAt: row.scheduledAt ?? null,
    startedAt: row.startedAt ?? null,
    closedAt: row.closedAt ?? null,
    closedBy: row.closedBy ?? null,
    closureNotes: row.closureNotes ?? "",
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt ?? null,
  };
}

/** Normalize a MaintenanceRecommendationService.Recommendation row. */
export function normalizeRecommendation(row) {
  if (!row || typeof row !== "object") return null;
  return {
    machineId: row.machineId ?? null,
    machineCode: row.machineCode ?? null,
    recommendedType: row.recommendedType || "CORRECTIVE",
    recommendedSubtype: row.recommendedSubtype ?? null,
    priority: row.priority || "MEDIUM",
    title: row.title || "Maintenance recommendation",
    justification: row.justification ?? "",
    suggestedActions: row.suggestedActions ?? "",
    status: row.status || "RECOMMENDED", // RECOMMENDED | INSUFFICIENT_DATA | HEALTHY
    generatedAt: row.generatedAt ?? null,
    // Client-side index used for the apply call when the server does not send one.
    index: typeof row.index === "number" ? row.index : null,
  };
}
