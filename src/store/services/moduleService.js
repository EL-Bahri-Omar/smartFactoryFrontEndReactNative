// src/store/services/moduleService.js
//
// CONFIRMED against FunctionalModuleController (/api/modules):
//   GET    /api/modules           -> ModuleResponseDto[]
//        { id, code, name, description, active, systemModule,
//          privileges: [{ action, code, name, description }] }
//   POST   /api/modules           -> 201 module   (ROLE_ADMIN / ROLE_CREATE)
//        body: { code (required, ex "REPORTS"), name (required), description? }
//   DELETE /api/modules/:id       -> 204          (custom modules only)

import api from "../../lib/axios";
import { ENDPOINTS, buildUrl } from "../../constants/api";

/** GET /api/modules -> array of modules (each with its privileges). */
export async function getAll() {
  const response = await api.get(ENDPOINTS.MODULES);
  const data = response.data;
  return Array.isArray(data) ? data : data?.content || [];
}

/** POST /api/modules { code, name, description? } -> created module (201). */
export async function create(body) {
  const response = await api.post(ENDPOINTS.MODULES, {
    code: String(body.code || "").trim().toUpperCase(),
    name: String(body.name || "").trim(),
    description: body.description ? String(body.description).trim() : undefined,
  });
  return response.data;
}

/** DELETE /api/modules/:id -> 204 (backend blocks modules still used by roles). */
export async function remove(idOrCode) {
  const url = buildUrl(ENDPOINTS.MODULE_BY_ID, { id: idOrCode });
  const response = await api.delete(url);
  return response.data;
}
