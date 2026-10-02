// src/store/slices/userSlice.js
//
// CONFIRMED Sprint 1: user management lives under /api/users.**
// Self profile display reads GET /api/auth/me (every role).
// Self profile update sends PUT /api/users/:id with the user's own
// role/status echoed back (only ADMIN can change those server-side).
// Password change: PUT /api/users/change-password/:id?newPassword=&oldPassword=.

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as userService from "../services/userService";
import * as storage from "../../lib/storage";

// ── Thunks ──────────────────────────────────────────────────────────────

export const fetchProfile = createAsyncThunk(
  "user/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      return await userService.getProfile();
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Self profile update for any role. Role/status are echoed back because the
 * backend reuses UpdateUserRequest (validated but ignored — only names+email
 * are applied to non-admins). Falls back to legacy ADMIN PUT /:id on 404.
 */
export const updateProfile = createAsyncThunk(
  "user/updateProfile",
  async ({ firstName, lastName, email }, { getState, rejectWithValue }) => {
    try {
      const me = getState().auth.user;
      const data = await userService.updateOwnProfile({
        firstName,
        lastName,
        email,
        role: me?.role,
        status: me?.status || "ACTIVE",
      });
      if (data) await storage.setUser(data);
      return data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** Self password change (old password verified server-side). */
export const changePassword = createAsyncThunk(
  "user/changePassword",
  async ({ oldPassword, newPassword }, { rejectWithValue }) => {
    try {
      await userService.changeOwnPassword({ oldPassword, newPassword });
      return true;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** GET /api/users (ADMIN, paginated) */
export const fetchUsers = createAsyncThunk(
  "user/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await userService.getAll(params);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** POST /api/users (ADMIN) */
export const createUser = createAsyncThunk(
  "user/create",
  async (body, { rejectWithValue }) => {
    try {
      return await userService.create(body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** PUT /api/users/:id (ADMIN) */
export const updateUserById = createAsyncThunk(
  "user/updateById",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await userService.update(id, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** DELETE /api/users/:id (ADMIN) */
export const deleteUser = createAsyncThunk(
  "user/delete",
  async (id, { rejectWithValue }) => {
    try {
      await userService.remove(id);
      return id;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// ── Slice ───────────────────────────────────────────────────────────────

const userSlice = createSlice({
  name: "user",
  initialState: {
    profile: null,
    status: "idle",       // 'idle' | 'loading' | 'succeeded' | 'error'
    saveStatus: "idle",   // 'idle' | 'saving' | 'saved' | 'error'
    error: null,
    passwordStatus: "idle", // 'idle' | 'saving' | 'saved' | 'error'
    passwordError: null,
    list: [],             // ADMIN user list (current page content)
    totalElements: 0,
    listStatus: "idle",   // 'idle' | 'loading' | 'succeeded' | 'error'
    listError: null,
  },
  reducers: {
    clearSaveStatus(state) {
      state.saveStatus = "idle";
    },
    clearPasswordStatus(state) {
      state.passwordStatus = "idle";
      state.passwordError = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch profile
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload;
      });

    // Update profile (self-edit: own role/status echoed back)
    builder
      .addCase(updateProfile.pending, (state) => {
        state.saveStatus = "saving";
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.saveStatus = "saved";
        state.profile = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.saveStatus = "error";
        state.error = action.payload;
      });

    // Change password (old password verified server-side)
    builder
      .addCase(changePassword.pending, (state) => {
        state.passwordStatus = "saving";
        state.passwordError = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.passwordStatus = "saved";
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.passwordStatus = "error";
        state.passwordError = action.payload;
      });

    // Admin list
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.listStatus = "loading";
        state.listError = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.listStatus = "succeeded";
        const payload = action.payload;
        state.list = Array.isArray(payload) ? payload : payload?.content || [];
        state.totalElements = payload?.totalElements ?? state.list.length;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.listStatus = "error";
        state.listError = action.payload || { message: "Failed to fetch users" };
      });

    // Admin create
    builder.addCase(createUser.fulfilled, (state, action) => {
      if (action.payload?.id) state.list.unshift(action.payload);
    });

    // Admin update
    builder.addCase(updateUserById.fulfilled, (state, action) => {
      const idx = state.list.findIndex((u) => u.id === action.payload?.id);
      if (idx !== -1) state.list[idx] = action.payload;
    });

    // Admin delete
    builder.addCase(deleteUser.fulfilled, (state, action) => {
      state.list = state.list.filter((u) => u.id !== action.payload);
    });
  },
});

export const { clearSaveStatus, clearPasswordStatus } = userSlice.actions;
export default userSlice.reducer;
