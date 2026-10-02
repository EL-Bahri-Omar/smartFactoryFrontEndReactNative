// src/store/services/userService.js
//
// CONFIRMED Sprint 1 against smartFactoryBackEndSpringBoot UserController.
// All /api/users/** routes require role ADMIN.
// - GET    /api/users?search=&page=&size=&sort= -> { content, page, size, totalElements, totalPages }
// - GET    /api/users/:id -> user
// - POST   /api/users { firstName, lastName, email, password, role, status? } -> 201 user
// - PUT    /api/users/:id { firstName, lastName, email, role, status, password? } -> user
// - DELETE /api/users/:id -> 204
// NOTE: no self-service profile or change-password endpoint in Sprint 1.
// The own profile is read via GET /api/auth/me (authService.me).

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/users?search=&page=&size= (ADMIN, paginated) */
export async function getAll(params = {}) {
  const response = await api.get(ENDPOINTS.USERS, { params });
  return response.data;
}

/** GET /api/users/:id (ADMIN) */
export async function getById(id) {
  const url = buildUrl(ENDPOINTS.USER_BY_ID, { id });
  const response = await api.get(url);
  return response.data;
}

/** POST /api/users (ADMIN) */
export async function create(body) {
  const response = await api.post(ENDPOINTS.USERS, body);
  return response.data;
}

/** PUT /api/users/:id (ADMIN). All fields except password are required. */
export async function update(id, body) {
  const url = buildUrl(ENDPOINTS.USER_BY_ID, { id });
  const response = await api.put(url, body);
  return response.data;
}

/** DELETE /api/users/:id (ADMIN) -> 204 */
export async function remove(id) {
  const url = buildUrl(ENDPOINTS.USER_BY_ID, { id });
  const response = await api.delete(url);
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
