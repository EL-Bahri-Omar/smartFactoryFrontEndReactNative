// src/hooks/useAuth.js
// Reads from the auth slice and exposes login/logout helpers.

import { useCallback } from "react";
import { useAppSelector } from "./useAppSelector";
import { useAppDispatch } from "./useAppDispatch";
import { loginThunk, logoutThunk } from "../store/slices/authSlice";
import { ROLES } from "../constants/roles";

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, accessToken, status, error } = useAppSelector((state) => state.auth);

  const isAuthenticated = status === "authenticated" && !!user;
  const role = user?.role || null;

  const login = useCallback(
    (credentials) => dispatch(loginThunk(credentials)),
    [dispatch]
  );

  const logout = useCallback(
    () => dispatch(logoutThunk()),
    [dispatch]
  );

  return {
    user,
    isAuthenticated,
    role,
    status,
    error,
    login,
    logout,
  };
}
