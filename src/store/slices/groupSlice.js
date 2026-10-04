// src/store/slices/groupSlice.js

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as groupService from "../services/groupService";

// ── Thunks ──────────────────────────────────────────────────────────────

export const fetchGroups = createAsyncThunk(
  "group/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      return await groupService.getAll(params);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchGroupById = createAsyncThunk(
  "group/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      return await groupService.getById(id);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const createGroup = createAsyncThunk(
  "group/create",
  async (body, { rejectWithValue }) => {
    try {
      return await groupService.create(body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateGroup = createAsyncThunk(
  "group/update",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await groupService.update(id, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const deleteGroup = createAsyncThunk(
  "group/delete",
  async (id, { rejectWithValue }) => {
    try {
      await groupService.remove(id);
      return id;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const addGroupOperator = createAsyncThunk(
  "group/addOperator",
  async ({ groupId, userId }, { rejectWithValue }) => {
    try {
      return await groupService.addOperator(groupId, userId);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const removeGroupOperator = createAsyncThunk(
  "group/removeOperator",
  async ({ groupId, userId }, { rejectWithValue }) => {
    try {
      return await groupService.removeOperator(groupId, userId);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const assignGroupSupervisor = createAsyncThunk(
  "group/assignSupervisor",
  async ({ groupId, supervisorId }, { rejectWithValue }) => {
    try {
      return await groupService.assignSupervisor(groupId, supervisorId);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchGroupOperators = createAsyncThunk(
  "group/fetchOperators",
  async (groupId, { rejectWithValue }) => {
    try {
      const operators = await groupService.getOperators(groupId);
      return { groupId, operators };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchGroupSupervisor = createAsyncThunk(
  "group/fetchSupervisor",
  async (groupId, { rejectWithValue }) => {
    try {
      const supervisor = await groupService.getSupervisor(groupId);
      return { groupId, supervisor };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// ── Slice ───────────────────────────────────────────────────────────────

const groupSlice = createSlice({
  name: "group",
  initialState: {
    list: [],
    totalElements: 0,
    current: null,
    operators: [], // members of current group (detail screen)
    supervisor: null,
    status: "idle", // list status
    currentStatus: "idle",
    membersStatus: "idle",
    error: null,
    currentError: null,
    membersError: null,
    filters: { search: "" },
  },
  reducers: {
    setGroupFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearGroupCurrent(state) {
      state.current = null;
      state.operators = [];
      state.supervisor = null;
      state.currentStatus = "idle";
      state.membersStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchGroups.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchGroups.fulfilled, (state, action) => {
        state.status = "succeeded";
        const payload = action.payload;
        state.list = Array.isArray(payload) ? payload : payload?.content || [];
        state.totalElements = payload?.totalElements ?? state.list.length;
      })
      .addCase(fetchGroups.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to fetch groups" };
      });

    builder
      .addCase(fetchGroupById.pending, (state) => {
        state.currentStatus = "loading";
        state.currentError = null;
      })
      .addCase(fetchGroupById.fulfilled, (state, action) => {
        state.currentStatus = "succeeded";
        state.current = action.payload;
      })
      .addCase(fetchGroupById.rejected, (state, action) => {
        state.currentStatus = "error";
        state.currentError = action.payload || { message: "Failed to load group" };
      });

    // Any write that returns the group refreshes current + list entry.
    const applyGroup = (state, group) => {
      if (!group?.id) return;
      if (state.current?.id === group.id) state.current = group;
      const idx = state.list.findIndex((g) => g.id === group.id);
      if (idx !== -1) state.list[idx] = group;
      else state.list.unshift(group);
    };

    builder
      .addCase(createGroup.fulfilled, (state, action) => {
        if (action.payload?.id) {
          state.list.unshift(action.payload);
          state.totalElements += 1;
        }
      })
      .addCase(updateGroup.fulfilled, (state, action) => {
        applyGroup(state, action.payload);
      })
      .addCase(addGroupOperator.fulfilled, (state, action) => {
        applyGroup(state, action.payload);
      })
      .addCase(removeGroupOperator.fulfilled, (state, action) => {
        applyGroup(state, action.payload);
        const removedId = action.meta.arg?.userId;
        if (removedId) {
          state.operators = state.operators.filter((u) => u.id !== removedId);
          if (state.supervisor?.id === removedId) state.supervisor = null;
        }
      })
      .addCase(assignGroupSupervisor.fulfilled, (state, action) => {
        applyGroup(state, action.payload);
      })
      .addCase(deleteGroup.fulfilled, (state, action) => {
        state.list = state.list.filter((g) => g.id !== action.payload);
        state.totalElements = Math.max(0, state.totalElements - 1);
        if (state.current?.id === action.payload) {
          state.current = null;
          state.operators = [];
          state.supervisor = null;
        }
      });

    builder
      .addCase(fetchGroupOperators.pending, (state) => {
        state.membersStatus = "loading";
        state.membersError = null;
      })
      .addCase(fetchGroupOperators.fulfilled, (state, action) => {
        state.membersStatus = "succeeded";
        state.operators = Array.isArray(action.payload.operators) ? action.payload.operators : [];
      })
      .addCase(fetchGroupOperators.rejected, (state, action) => {
        state.membersStatus = "error";
        state.membersError = action.payload || { message: "Failed to load operators" };
      });

    builder
      .addCase(fetchGroupSupervisor.fulfilled, (state, action) => {
        state.supervisor = action.payload.supervisor || null;
      })
      .addCase(fetchGroupSupervisor.rejected, (state) => {
        state.supervisor = null;
      });
  },
});

export const { setGroupFilters, clearGroupCurrent } = groupSlice.actions;
export default groupSlice.reducer;
