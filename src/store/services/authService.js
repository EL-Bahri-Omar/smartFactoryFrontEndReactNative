// src/store/services/authService.js
//
// CONFIRMED Sprint 1 against smartFactoryBackEndSpringBoot AuthController.
// - POST /api/auth/login            { email, password } -> { token, user }
// - POST /api/auth/register         { firstName, lastName, email, password } -> 201 { message }
// - POST /api/auth/verify-email    { email, otp } -> { message }
// - POST /api/auth/resend-verification { email } -> { message }
// - POST /api/auth/forgot-password { email } -> { message } (always 200)
// - POST /api/auth/verify-reset-otp { email, otp } -> { message, resetToken }
// - POST /api/auth/reset-password  { email, resetToken, newPassword } -> { message }
// - GET  /api/auth/me -> user (requires Bearer token)
// - POST /api/auth/logout -> { message } (stateless, token stays valid until expiry)
// NOTE: no refresh endpoint. No tokens are returned except login's `token`.

import api from "../../lib/axios";
import { ENDPOINTS } from "../../constants/api";

/** POST /api/auth/login -> { token, user } */
export async function login(credentials) {
  const response = await api.post(ENDPOINTS.AUTH_LOGIN, credentials);
  return response.data;
}

/**
 * POST /api/auth/register -> 201 { message }
 * Role defaults to OPERATOR server-side; new users get status ACTIVE with
 * emailVerified=false until the OTP is verified. No token returned.
 */
export async function register(payload) {
  const response = await api.post(ENDPOINTS.AUTH_REGISTER, payload);
  return response.data;
}

/** POST /api/auth/verify-email { email, otp } -> { message } */
export async function verifyEmail(payload) {
  const response = await api.post(ENDPOINTS.AUTH_VERIFY_EMAIL, payload);
  return response.data;
}

/** POST /api/auth/resend-verification { email } -> { message } */
export async function resendVerification(payload) {
  const response = await api.post(ENDPOINTS.AUTH_RESEND_VERIFICATION, payload);
  return response.data;
}

/**
 * POST /api/auth/forgot-password { email } -> { message } (always 200).
 * The backend never reveals whether the email exists.
 */
export async function forgotPassword(payload) {
  const response = await api.post(ENDPOINTS.AUTH_FORGOT_PASSWORD, payload);
  return response.data;
}

/** POST /api/auth/verify-reset-otp { email, otp } -> { message, resetToken } */
export async function verifyResetOtp(payload) {
  const response = await api.post(ENDPOINTS.AUTH_VERIFY_RESET_OTP, payload);
  return response.data;
}

/** POST /api/auth/reset-password { email, resetToken, newPassword } -> { message } */
export async function resetPassword(payload) {
  const response = await api.post(ENDPOINTS.AUTH_RESET_PASSWORD, payload);
  return response.data;
}

/** GET /api/auth/me -> user */
export async function me() {
  const response = await api.get(ENDPOINTS.AUTH_ME);
  return response.data;
}

/** POST /api/auth/logout -> { message } (stateless; client clears storage) */
export async function logout() {
  const response = await api.post(ENDPOINTS.AUTH_LOGOUT);
  return response.data;
}
