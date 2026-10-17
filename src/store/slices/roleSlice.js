// src/store/slices/roleSlice.js
//
// Dynamic roles + privilege matrix (RoleController).

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as roleService from "../services/roleService";

export const fetchRoles = createAsyncThunk("role/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await roleService.getAll();
  } catch (error) {
    return rejectWithValue(error);
  }
});

export const fetchRolePrivilegesCatalog = createAsyncThunk("role/fetchCatalog", async (_, { rejectWithValue }) => {
  try {
    return await roleService.getPrivilegesCatalog();
  } catch (error) {
    return rejectWithValue(error);
  }
});

export const createRole = createAsyncThunk("role/create", async (body, { rejectWithValue }) => {
  try {
    return await roleService.create(body);
  } catch (error) {
    return rejectWithValue(error);
  }
});

export const updateRole = createAsyncThunk("role/update", async ({ name, body }, { rejectWithValue }) => {
  try {
    return await roleService.update(name, body);
  } catch (error) {
    return rejectWithValue(error);
  }
});

export const deleteRole = createAsyncThunk("role/delete", async (name, { rejectWithValue }) => {
  try {
    await roleService.remove(name);
    return name;
  } catch (error) {
    return rejectWithValue(error);
  }
});

const roleSlice = createSlice({
  name: "role",
  initialState: {
    list: [],
    status: "idle",
    error: null,
    catalog: [],
    catalogStatus: "idle",
    catalogError: null,
    saveStatus: "idle",
    saveError: null,
  },
  reducers: {
    clearRoleSave(state) {
      state.saveStatus = "idle";
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.list = action.payload || [];
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to load roles" };
        state.list = [];
      });

    builder
      .addCase(fetchRolePrivilegesCatalog.pending, (state) => {
        state.catalogStatus = "loading";
        state.catalogError = null;
      })
      .addCase(fetchRolePrivilegesCatalog.fulfilled, (state, action) => {
        state.catalogStatus = "succeeded";
        state.catalog = action.payload || [];
      })
      .addCase(fetchRolePrivilegesCatalog.rejected, (state, action) => {
        state.catalogStatus = "error";
        state.catalogError = action.payload || { message: "Failed to load privileges" };
      });

    builder
      .addCase(createRole.pending, (state) => {
        state.saveStatus = "saving";
        state.saveError = null;
      })
      .addCase(createRole.fulfilled, (state, action) => {
        state.saveStatus = "saved";
        if (action.payload?.name) {
          const idx = state.list.findIndex((r) => r.name === action.payload.name);
          if (idx !== -1) state.list[idx] = action.payload;
          else state.list.push(action.payload);
        }
      })
      .addCase(createRole.rejected, (state, action) => {
        state.saveStatus = "error";
        state.saveError = action.payload || { message: "Failed to create role" };
      });

    builder
      .addCase(updateRole.pending, (state) => {
        state.saveStatus = "saving";
        state.saveError = null;
      })
      .addCase(updateRole.fulfilled, (state, action) => {
        state.saveStatus = "saved";
        const idx = state.list.findIndex((r) => r.name === action.payload?.name);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateRole.rejected, (state, action) => {
        state.saveStatus = "error";
        state.saveError = action.payload || { message: "Failed to update role" };
      });

    builder.addCase(deleteRole.fulfilled, (state, action) => {
      state.list = state.list.filter((r) => r.name !== action.payload && r.id !== action.payload);
    });
  },
});

export const { clearRoleSave } = roleSlice.actions;
export default roleSlice.reducer;
