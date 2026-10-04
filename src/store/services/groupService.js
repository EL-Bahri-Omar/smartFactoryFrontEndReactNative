// src/store/services/groupService.js
//
// CONFIRMED against smartFactoryBackEndSpringBoot GroupController (US10).
// - GET    /api/groups?search=&page=&size=&sort= -> paginated (any authenticated role)
// - GET    /api/groups/:id -> { id, name, operators[], supervisorId, supervisorName, operatorCount, ... }
// - POST   /api/groups (ADMIN) { name, operators?, supervisorId? } -> 201
// - PUT    /api/groups/:id (ADMIN) -> group
// - DELETE /api/groups/:id (ADMIN) -> 204 (users untouched)
// - POST   /api/groups/:g/operators/:u (ADMIN) — user must be OPERATOR
// - DELETE /api/groups/:g/operators/:u (ADMIN) — clears supervisor if it was them
// - PUT    /api/groups/:g/supervisor (ADMIN) { supervisorId } — OPERATOR or RESPONSABLE_INDUSTRIEL
// - GET    /api/groups/:g/operators -> [users] (any role)
// - GET    /api/groups/:g/supervisor -> user | 204 (any role)

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/groups?search=&page=&size= (any role, paginated) */
export async function getAll(params = {}) {
  const response = await api.get(ENDPOINTS.GROUPS, { params });
  return response.data;
}

/** GET /api/groups/:id */
export async function getById(id) {
  const url = buildUrl(ENDPOINTS.GROUP_BY_ID, { id });
  const response = await api.get(url);
  return response.data;
}

/** POST /api/groups (ADMIN) */
export async function create(body) {
  const response = await api.post(ENDPOINTS.GROUPS, body);
  return response.data;
}

/** PUT /api/groups/:id (ADMIN) — full object */
export async function update(id, body) {
  const url = buildUrl(ENDPOINTS.GROUP_BY_ID, { id });
  const response = await api.put(url, body);
  return response.data;
}

/** DELETE /api/groups/:id (ADMIN) -> 204 */
export async function remove(id) {
  const url = buildUrl(ENDPOINTS.GROUP_BY_ID, { id });
  const response = await api.delete(url);
  return response.data;
}

/** POST /api/groups/:groupId/operators/:userId (ADMIN) */
export async function addOperator(groupId, userId) {
  const url = buildUrl(ENDPOINTS.GROUP_OPERATOR, { groupId, userId });
  const response = await api.post(url);
  return response.data;
}

/** DELETE /api/groups/:groupId/operators/:userId (ADMIN) */
export async function removeOperator(groupId, userId) {
  const url = buildUrl(ENDPOINTS.GROUP_OPERATOR, { groupId, userId });
  const response = await api.delete(url);
  return response.data;
}

/** PUT /api/groups/:groupId/supervisor (ADMIN) */
export async function assignSupervisor(groupId, supervisorId) {
  const url = buildUrl(ENDPOINTS.GROUP_SUPERVISOR, { groupId });
  const response = await api.put(url, { supervisorId });
  return response.data;
}

/** GET /api/groups/:groupId/operators (any role) */
export async function getOperators(groupId) {
  const url = buildUrl(ENDPOINTS.GROUP_OPERATORS, { groupId });
  const response = await api.get(url);
  return response.data;
}

/** GET /api/groups/:groupId/supervisor (any role, 204 when none) */
export async function getSupervisor(groupId) {
  const url = buildUrl(ENDPOINTS.GROUP_SUPERVISOR, { groupId });
  const response = await api.get(url);
  return response.data || null;
}
