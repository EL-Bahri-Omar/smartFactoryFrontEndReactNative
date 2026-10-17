// src/store/services/roleService.js
//
// CONFIRMED against smartFactoryBackEndSpringBoot RoleController.
// Dynamic roles in the `roles` collection (system roles seeded from the enum).
// Guards use ROLE_ADMIN (admins) or the fine ROLE_* authorities.

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/roles -> RoleResponseDto[] (ROLE_ADMIN or ROLE_READ) */
export async function getAll() {
  const response = await api.get(ENDPOINTS.ROLES);
  return Array.isArray(response.data) ? response.data : [];
}

/** GET /api/roles/privileges -> [{ code, name, description, category }] */
export async function getPrivilegesCatalog() {
  const response = await api.get(ENDPOINTS.ROLE_PRIVILEGES_CATALOG);
  return Array.isArray(response.data) ? response.data : [];
}

/** GET /api/roles/:name (id or name) -> RoleResponseDto */
export async function getByName(name) {
  const url = buildUrl(ENDPOINTS.ROLE_BY_NAME, { name });
  const response = await api.get(url);
  return response.data;
}

/** POST /api/roles { name, description?, privileges? } -> 201 (ROLE_ADMIN or ROLE_CREATE) */
export async function create(body) {
  const response = await api.post(ENDPOINTS.ROLES, body);
  return response.data;
}

/** PUT /api/roles/:name { description?, privileges? } (ROLE_ADMIN or ROLE_UPDATE) */
export async function update(name, body) {
  const url = buildUrl(ENDPOINTS.ROLE_BY_NAME, { name });
  const response = await api.put(url, body);
  return response.data;
}

/** DELETE /api/roles/:name -> 204. Blocked for system roles and roles in use. */
export async function remove(name) {
  const url = buildUrl(ENDPOINTS.ROLE_BY_NAME, { name });
  const response = await api.delete(url);
  return response.data;
}

/** GET /api/roles/:name/privileges -> string[] */
export async function getPrivileges(name) {
  const url = buildUrl(ENDPOINTS.ROLE_PRIVILEGES, { name });
  const response = await api.get(url);
  return Array.isArray(response.data) ? response.data : [];
}
