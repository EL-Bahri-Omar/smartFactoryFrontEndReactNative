// src/store/slices/authSlice.js
//
// CONFIRMED Sprint 1 against the backend AuthController.
// Login returns { token, user } (single JWT, no refresh token).
// The token is persisted via storage and sent as Authorization: Bearer.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as authService from "../services/authService";
import * as storage from "../../lib/storage";

// ── Thunks ──────────────────────────────────────────────────────────────

export const loginThunk = createAsyncThunk(
  "auth/login",
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await authService.login(credentials);
      // Backend returns { token, user } — single access token, no refresh.
      await storage.setTokens({ accessToken: data.token });
      if (data.user) await storage.setUser(data.user);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const registerThunk = createAsyncThunk(
  "auth/register",
  async (payload, { rejectWithValue }) => {
    try {
      const data = await authService.register(payload);
      // No token stored here — the user is not authenticated until email is verified.
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const verifyAccountThunk = createAsyncThunk(
  "auth/verifyAccount",
  async ({ email, code, otp }, { rejectWithValue }) => {
    try {
      // Backend field is `otp` (accept `code` from older callers).
      const data = await authService.verifyEmail({ email, otp: otp ?? code });
      // No token stored — the user still has to log in after verification.
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const resendVerificationThunk = createAsyncThunk(
  "auth/resendVerification",
  async (payload, { rejectWithValue }) => {
    try {
      const data = await authService.resendVerification(payload);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const forgotPasswordThunk = createAsyncThunk(
  "auth/forgotPassword",
  async (payload, { rejectWithValue }) => {
    try {
      const data = await authService.forgotPassword(payload);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const verifyResetCodeThunk = createAsyncThunk(
  "auth/verifyResetCode",
  async ({ email, code, otp }, { rejectWithValue }) => {
    try {
      // Backend field is `otp` (accept `code` from older callers).
      const data = await authService.verifyResetOtp({ email, otp: otp ?? code });
      // The resetToken authorizes the reset-password call. Kept in Redux
      // only (never persisted) — lost on reload, which forces a fresh code.
      // The email must travel with it: reset-password requires { email, resetToken, newPassword }.
      return { ...data, email };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const resetPasswordThunk = createAsyncThunk(
  "auth/resetPassword",
  async ({ email, resetToken, newPassword, password }, { rejectWithValue }) => {
    try {
      // Backend fields are `newPassword` + `email` (accept `password` from older callers).
      const data = await authService.resetPassword({
        email,
        resetToken,
        newPassword: newPassword ?? password,
      });
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const meThunk = createAsyncThunk(
  "auth/me",
  async (_, { rejectWithValue }) => {
    try {
      const data = await authService.me();
      await storage.setUser(data);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const logoutThunk = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch {
      // Even if the server call fails, we still clear locally
    }
    await storage.clearTokens();
    await storage.clearUser();
  }
);

// ── Slice ───────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    accessToken: null,
    status: "idle", // 'idle' | 'loading' | 'authenticated' | 'error'
    error: null,
    verifyStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    verifyError: null,
    resendStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    resendError: null,
    forgotStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    forgotError: null,
    // Security: the reset token must never be persisted. It lives in Redux
    // memory only. If the user reloads the page, it is lost and they return
    // to /(auth)/forgot-password. Screens must handle a missing resetToken
    // by redirecting there (see reset-password.jsx guard).
    resetToken: null, // short-lived, Redux only — never persisted
    resetEmail: null, // email the resetToken was issued for
    verifyCodeStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    verifyCodeError: null,
    resetPasswordStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    resetPasswordError: null,
  },
  reducers: {
    // Sync the signed-in user (e.g. right after a profile update) so every
    // consumer — Sidebar, TopBar, guards — re-renders without a page refresh.
    setUser(state, action) {
      state.user = action.payload;
      storage.setUser(action.payload);
    },
    forceLogout(state) {
      state.user = null;
      state.accessToken = null;
      state.status = "idle";
      state.error = null;
      state.resetToken = null;
      state.resetEmail = null;
      // Side effect: clear storage (fire and forget)
      storage.clearTokens();
      storage.clearUser();
    },
    clearResetToken(state) {
      state.resetToken = null;
      state.resetEmail = null;
      state.resetPasswordStatus = "idle";
      state.resetPasswordError = null;
      state.verifyCodeStatus = "idle";
      state.verifyCodeError = null;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.status = "authenticated";
        state.accessToken = action.payload.token;
        state.user = action.payload.user || null;
        state.error = null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Login failed" };
      });

    // Register (no authentication yet — do not set user/token)
    builder
      .addCase(registerThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(registerThunk.fulfilled, (state) => {
        state.status = "idle";
        state.error = null;
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Registration failed" };
      });

    // Me
    builder
      .addCase(meThunk.pending, (state) => {
        if (state.status !== "authenticated") state.status = "loading";
      })
      .addCase(meThunk.fulfilled, (state, action) => {
        state.status = "authenticated";
        state.user = action.payload;
        state.error = null;
      })
      .addCase(meThunk.rejected, (state, action) => {
        state.user = null;
        state.accessToken = null;
        state.status = "idle";
        state.error = action.payload || null;
      });

    // Logout
    builder.addCase(logoutThunk.fulfilled, (state) => {
      state.user = null;
      state.accessToken = null;
      state.status = "idle";
      state.error = null;
      state.resetToken = null;
      state.resetEmail = null;
    });

    // Verify account (no authentication — do not set user/token)
    builder
      .addCase(verifyAccountThunk.pending, (state) => {
        state.verifyStatus = "loading";
        state.verifyError = null;
      })
      .addCase(verifyAccountThunk.fulfilled, (state) => {
        state.verifyStatus = "succeeded";
        state.verifyError = null;
      })
      .addCase(verifyAccountThunk.rejected, (state, action) => {
        state.verifyStatus = "error";
        state.verifyError = action.payload || { message: "Verification failed" };
      });

    // Resend verification code
    builder
      .addCase(resendVerificationThunk.pending, (state) => {
        state.resendStatus = "loading";
        state.resendError = null;
      })
      .addCase(resendVerificationThunk.fulfilled, (state) => {
        state.resendStatus = "succeeded";
        state.resendError = null;
      })
      .addCase(resendVerificationThunk.rejected, (state, action) => {
        state.resendStatus = "error";
        state.resendError = action.payload || { message: "Resend failed" };
      });

    // Forgot password (never reveals whether the email exists — see screen)
    builder
      .addCase(forgotPasswordThunk.pending, (state) => {
        state.forgotStatus = "loading";
        state.forgotError = null;
      })
      .addCase(forgotPasswordThunk.fulfilled, (state) => {
        state.forgotStatus = "succeeded";
        state.forgotError = null;
      })
      .addCase(forgotPasswordThunk.rejected, (state, action) => {
        state.forgotStatus = "error";
        state.forgotError = action.payload || { message: "Request failed" };
      });

    // Verify reset code (stores the short-lived resetToken + email)
    builder
      .addCase(verifyResetCodeThunk.pending, (state) => {
        state.verifyCodeStatus = "loading";
        state.verifyCodeError = null;
      })
      .addCase(verifyResetCodeThunk.fulfilled, (state, action) => {
        state.verifyCodeStatus = "succeeded";
        state.verifyCodeError = null;
        state.resetToken = action.payload.resetToken || null;
        state.resetEmail = action.payload.email || null;
      })
      .addCase(verifyResetCodeThunk.rejected, (state, action) => {
        state.verifyCodeStatus = "error";
        state.verifyCodeError = action.payload || { message: "Invalid code" };
      });

    // Reset password (clears the resetToken on success — single use)
    builder
      .addCase(resetPasswordThunk.pending, (state) => {
        state.resetPasswordStatus = "loading";
        state.resetPasswordError = null;
      })
      .addCase(resetPasswordThunk.fulfilled, (state) => {
        state.resetPasswordStatus = "succeeded";
        state.resetPasswordError = null;
        state.resetToken = null;
        state.resetEmail = null;
      })
      .addCase(resetPasswordThunk.rejected, (state, action) => {
        state.resetPasswordStatus = "error";
        state.resetPasswordError = action.payload || { message: "Reset failed" };
      });
  },
});

export const { forceLogout, clearResetToken, setUser } = authSlice.actions;
export default authSlice.reducer;
