// src/hooks/useRole.js
// UI-only gating (RB10). Never rely on this for security — the backend
// enforces every permission server-side (403 otherwise).
//
// Two gating dimensions:
// - Roles (legacy page rules): can(...roles), canAccess(pageKey).
// - Granular permissions (backend Permission catalog): hasPermission(...perms)
//   reads the signed-in user's `effectivePermissions` (login/me payloads carry
//   it; falls back to role defaults when absent).

import { useMemo } from "react";
import { useAppSelector } from "./useAppSelector";
import { ROLES } from "../constants/roles";
import { PERMISSIONS, hasPermission as checkPerms, hasAnyPermission as checkAnyPerms } from "../constants/permissions";

const SUPERVISORS = [ROLES.ADMIN, ROLES.RESPONSABLE_INDUSTRIEL];
// Maintenance (Sprint 6): technicians are the primary riders of this screen
// (prompt 11); ADMIN + RESPONSABLE manage, OPERATOR is read-only UI-side
// (server enforces the truth).
const MAINTENANCE_ROLES = [...SUPERVISORS, ROLES.TECHNICIAN];

export const ACCESS = Object.freeze({
  dashboard: SUPERVISORS,
  machines: SUPERVISORS,
  maintenance: MAINTENANCE_ROLES,
  users: [ROLES.ADMIN],
  groups: [ROLES.ADMIN],
});

// Page -> required permission(s). When present, canAccess checks effective
// permissions instead of roles. Pages without an entry keep role rules.
export const PERMISSION_ACCESS = Object.freeze({
  machines: [PERMISSIONS.MACHINE_READ],
  map: [PERMISSIONS.ZONE_READ],
  users: [PERMISSIONS.USER_READ],
  groups: [PERMISSIONS.GROUP_READ],
  myGroup: [PERMISSIONS.GROUP_READ],
});

export { PERMISSIONS };

export function homeRouteFor(role) {
  return SUPERVISORS.includes(role) ? "/(app)/dashboard" : "/(app)/map";
}

export function useRole() {
  const user = useAppSelector((state) => state.auth.user);

  // The API is memoised on `user`: screens use canAccess/hasPermission inside
  // useEffect dependency arrays. Re-creating these functions every render made
  // those effects re-fire forever (one fetch per render — the "Updating…"
  // spinner that never stops and the generally slow screens).
  return useMemo(() => {
    const role = user?.role || null;

    const isAdmin = role === ROLES.ADMIN;
    const isOperator = role === ROLES.OPERATOR;
    const isTechnician = role === ROLES.TECHNICIAN;
    const isResponsable = role === ROLES.RESPONSABLE_INDUSTRIEL;

    /**
     * Check if the current user's role is in the allowed list.
     * e.g. can(ROLES.ADMIN, ROLES.TECHNICIAN)
     */
    function can(...allowedRoles) {
      if (!role) return false;
      return allowedRoles.includes(role);
    }

    /** True when the user effectively holds EVERY listed permission. */
    function hasPermission(...perms) {
      return checkPerms(user, ...perms);
    }

    /** True when the user effectively holds AT LEAST ONE listed permission. */
    function hasAnyPermission(...perms) {
      return checkAnyPerms(user, ...perms);
    }

    /**
     * Check page access by key. Permission-mapped pages use effective
     * permissions; dashboard/maintenance keep the supervisor role rule.
     */
    function canAccess(key) {
      const perms = PERMISSION_ACCESS[key];
      if (perms) return hasPermission(...perms);
      const allowed = ACCESS[key];
      if (!allowed) return true;
      return can(...allowed);
    }

    return {
      role,
      user,
      isAdmin,
      isOperator,
      isTechnician,
      isResponsable,
      can,
      hasPermission,
      hasAnyPermission,
      canAccess,
      homeRoute: homeRouteFor(role),
    };
  }, [user]);
}
