// src/lib/validators.js
// Shared auth validators. Single source of truth for the password rule so
// Signup and Reset Password enforce exactly the same policy.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate an email address. Returns an error string or null.
 * @param {string} email
 */
export function emailError(email) {
  const trimmed = (email || "").trim();
  if (!trimmed) return "Email is required.";
  if (!EMAIL_RE.test(trimmed)) return "Enter a valid email address.";
  return null;
}

/**
 * Password rule: at least 8 chars, one letter, one digit.
 * Returns an error string or null.
 * @param {string} password
 */
export function passwordError(password) {
  if (!password) return "Password is required.";
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must be 8+ chars with at least one letter and one digit.";
  }
  return null;
}
