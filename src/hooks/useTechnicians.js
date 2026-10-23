// src/hooks/useTechnicians.js
//
// Technician picker for intervention assignment (create + reassign).
//
// Source strategy (works with BOTH backend variants):
//   1. GET /api/users?role=TECHNICIAN&page=0&size=100 — the standard list
//      (needs USER_READ, which RESPONSABLE_INDUSTRIEL now has).
//   2. GET /api/users/technicians — lightweight endpoint for any
//      authenticated role; used only if (1) fails (403/404), e.g. for a
//      role without USER_READ or before the backend gains the endpoint.
//
// The successful payload is cached at module level, so every screen shares
// ONE fetch per app session (no refetch on each modal open / navigation).
// Failures are NOT cached — the next mount retries.

import { useEffect, useState } from "react";
import * as userService from "../store/services/userService";

let cache = null; // { options, status } | null
let inflight = null; // dedupe concurrent loads

function toOption(u) {
  return {
    value: u.id || u.email,
    label: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || u.id,
    sub: u.email || "",
  };
}

function load() {
  if (inflight) return inflight;
  inflight = (async () => {
    // 1) standard user list, role-filtered server-side
    try {
      const res = await userService.getAll({ role: "TECHNICIAN", page: 0, size: 100 });
      const rows = Array.isArray(res) ? res : res?.content || [];
      return { options: rows.map(toOption), status: "succeeded" };
    } catch {
      // 403 (no USER_READ) / 404 / offline — try the lightweight endpoint.
    }
    // 2) lightweight endpoint (any authenticated role)
    try {
      const rows = await userService.getTechnicians();
      return { options: (Array.isArray(rows) ? rows : []).map(toOption), status: "succeeded" };
    } catch {
      return { options: [], status: "error" };
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * @returns {{ options: {value,label,sub}[], status: "idle"|"loading"|"succeeded"|"error" }}
 */
export function useTechnicians() {
  const [state, setState] = useState(() => cache || { options: [], status: "idle" });

  useEffect(() => {
    let alive = true;
    if (cache) {
      setState(cache);
      return;
    }
    setState({ options: [], status: "loading" });
    load().then((result) => {
      if (result.status === "succeeded") cache = result;
      if (alive) setState(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
