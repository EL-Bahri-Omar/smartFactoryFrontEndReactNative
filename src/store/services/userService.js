// src/store/services/userService.js
//
// CONFIRMED against smartFactoryBackEndSpringBoot UserController.
// User routes are permission-guarded (USER_READ / USER_WRITE /
// USER_PERMISSIONS_MANAGE) — see docs/api-contract.md.
// - GET    /api/users?search=&role=&page=&size=&sort= -> { content, page, size, totalElements, totalPages }
// - GET    /api/users/:id -> user (includes effectivePermissions + custom lists)
// - POST   /api/users { firstName, lastName, email, password, role, status? } -> 201 user
// - PUT    /api/users/:id { firstName, lastName, email, role, status, password? } -> user
// - DELETE /api/users/:id -> 204
// - GET    /api/users/permissions/catalog (any authenticated role)
// - GET    /api/users/:id/permissions -> UserPermissionsDto
// - PUT    /api/users/:id/permissions { permissions: [...] } -> UserPermissionsDto

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/users?search=&page=&size= (ADMIN, paginated) */
export async function getAll(params = {}) {
  const response = await api.get(ENDPOINTS.USERS, { params });
  return response.data;
}

/**
 * GET /api/users/technicians (ANY authenticated role) ->
 * [{ id, firstName, lastName, email, role, status }]
 *
 * Lightweight picker for the intervention team — deliberately separate
 * from GET /api/users, which requires USER_READ: the Responsable
 * Industriel creates interventions and picks technicians but does not
 * hold user-management rights (a 403 there left the picker empty).
 */
export async function getTechnicians() {
  const response = await api.get(`${ENDPOINTS.USERS}/technicians`);
  const data = response.data;
  return Array.isArray(data) ? data : data?.content || [];
}

/** GET /api/users/:id (USER_READ) */
export async function getById(id) {
  const url = buildUrl(ENDPOINTS.USER_BY_ID, { id });
  const response = await api.get(url);
  return response.data;
}

/** POST /api/users (USER_WRITE) */
export async function create(body) {
  const response = await api.post(ENDPOINTS.USERS, body);
  return response.data;
}

/** PUT /api/users/:id (USER_WRITE). All fields except password are required. */
export async function update(id, body) {
  const url = buildUrl(ENDPOINTS.USER_BY_ID, { id });
  const response = await api.put(url, body);
  return response.data;
}

/** DELETE /api/users/:id (USER_WRITE) -> 204 */
export async function remove(id) {
  const url = buildUrl(ENDPOINTS.USER_BY_ID, { id });
  const response = await api.delete(url);
  return response.data;
}

/**
 * GET /api/users/permissions/catalog (any authenticated role)
 * -> { permissions: [{ code, description, category }], roles: { ROLE: { label, defaultPermissions } } }
 */
export async function getPermissionsCatalog() {
  const response = await api.get(ENDPOINTS.USER_PERMISSIONS_CATALOG);
  return response.data;
}

/**
 * GET /api/users/:id/permissions (USER_READ)
 * -> { userId, email, role, roleDefaultPermissions, customGrantedPermissions,
 *      customRevokedPermissions, effectivePermissions }
 */
export async function getUserPermissions(id) {
  const url = buildUrl(ENDPOINTS.USER_PERMISSIONS, { id });
  const response = await api.get(url);
  return response.data;
}

/**
 * PUT /api/users/:id/permissions (USER_PERMISSIONS_MANAGE)
 * Body: { permissions: [...] } full checklist (server recalculates
 * granted/revoked against the role). Returns the updated UserPermissionsDto.
 */
export async function updateUserPermissions(id, permissions) {
  const url = buildUrl(ENDPOINTS.USER_PERMISSIONS, { id });
  const response = await api.put(url, { permissions });
  return response.data;
}

/**
 * PUT /api/users/change-password/:id?newPassword=&oldPassword= -> 204.
 * Old password is verified server-side (wrong one -> 400 VALIDATION_ERROR).
 * NOTE: the Sprint 1 backend still requires role ADMIN on this route
 * (class-level guard) — non-admin calls 403 until the coworker relaxes it.
 */
export async function changePassword(id, { newPassword, oldPassword }) {
  const url = buildUrl(ENDPOINTS.USER_PASSWORD, { id });
  const response = await api.put(url, null, { params: { newPassword, oldPassword } });
  return response.data;
}

/** Own profile is read from the auth endpoint (works for every role). */
export async function getProfile() {
  const response = await api.get(ENDPOINTS.AUTH_ME);
  return response.data;
}

/**
 * Update own profile. The backend reuses UpdateUserRequest, so role/status
 * must be echoed back (validated but ignored server-side — only names+email
 * are applied). Falls back to legacy ADMIN PUT /:id only on 404.
 */
export async function updateOwnProfile({ firstName, lastName, email, role, status }) {
  try {
    const response = await api.put(ENDPOINTS.USER_ME, { firstName, lastName, email, role, status });
    return response.data;
  } catch (error) {
    if (error?.status !== 404) throw error;
    const legacy = await api.get(ENDPOINTS.AUTH_ME);
    const me = legacy.data;
    const url = buildUrl(ENDPOINTS.USER_BY_ID, { id: me.id });
    const retry = await api.put(url, {
      firstName,
      lastName,
      email,
      role: me.role,
      status: me.status || "ACTIVE",
    });
    return retry.data;
  }
}

/**
 * Change own password. Backend takes query params (like the legacy route).
 * Falls back to legacy ADMIN route only when the new endpoint is missing (404).
 */
export async function changeOwnPassword({ oldPassword, newPassword }) {
  try {
    const response = await api.put(ENDPOINTS.USER_ME_PASSWORD, null, { params: { oldPassword, newPassword } });
    return response.data;
  } catch (error) {
    if (error?.status !== 404) throw error;
    const legacy = await api.get(ENDPOINTS.AUTH_ME);
    const me = legacy.data;
    return changePassword(me.id, { oldPassword, newPassword });
  }
}
