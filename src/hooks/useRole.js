// src/hooks/useRole.js
// UI-only role gating (RB10). Never rely on this for security.
//
// Page access map (per product rule):
// - Dashboard, Machines, Maintenance → ADMIN + RESPONSABLE_INDUSTRIEL only
//   (writes inside Machines stay ADMIN-only).
// - Users → ADMIN only.
// - Map, Alerts, Profile, Settings → every authenticated role.

import { useAppSelector } from "./useAppSelector";
import { ROLES } from "../constants/roles";

const SUPERVISORS = [ROLES.ADMIN, ROLES.RESPONSABLE_INDUSTRIEL];

export const ACCESS = Object.freeze({
  dashboard: SUPERVISORS,
  machines: SUPERVISORS,
  maintenance: SUPERVISORS,
  users: [ROLES.ADMIN],
});

export function homeRouteFor(role) {
  return SUPERVISORS.includes(role) ? "/(app)/dashboard" : "/(app)/map";
}

export function useRole() {
  const user = useAppSelector((state) => state.auth.user);
  const role = user?.role || null;

  const isAdmin = role === ROLES.ADMIN;
  const isOperator = role === ROLES.OPERATOR;
  const isTechnician = role === ROLES.TECHNICIAN;
  const isResponsable = role === ROLES.RESPONSABLE_INDUSTRIEL;

  /**
   * Check if the current user's role is in the allowed list.
   * @param  {...string} allowedRoles  e.g. can(ROLES.ADMIN, ROLES.TECHNICIAN)
   * @returns {boolean}
   */
  function can(...allowedRoles) {
    if (!role) return false;
    return allowedRoles.includes(role);
  }

  /**
   * Check page access by key: dashboard | machines | maintenance | users.
   * Everything else is open to any authenticated role.
   */
  function canAccess(key) {
    const allowed = ACCESS[key];
    if (!allowed) return true;
    return can(...allowed);
  }

  return {
    role,
    isAdmin,
    isOperator,
    isTechnician,
    isResponsable,
    can,
    canAccess,
    homeRoute: homeRouteFor(role),
  };
}
