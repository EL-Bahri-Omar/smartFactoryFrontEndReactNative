// src/store/slices/interventionSlice.js
//
// Sprint 6 — Maintenance interventions (CONFIRMED backend MaintenanceController).
// State:
// { list, current, currentStatus, currentError, status, error,
//   filters: { status, priority, search }, pagination,
//   recommendations: [], recommendationsStatus, recommendationsError }
//
// Server filters: machineId / technicianId / type / subtype / status / from /
// to. Priority and free-text search are NOT server params — they filter
// client-side in the screen (search runs over code/title/machine).

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as interventionService from "../services/interventionService";

export const fetchInterventions = createAsyncThunk(
  "intervention/fetchAll",
  async (params, { rejectWithValue }) => {
    try {
      return await interventionService.getAll(params);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchInterventionById = createAsyncThunk(
  "intervention/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      return await interventionService.getById(id);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const createIntervention = createAsyncThunk(
  "intervention/create",
  async (body, { rejectWithValue }) => {
    try {
      return await interventionService.create(body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** PUT /api/maintenance/:id/assign { technicianIds } (US43, team support). */
export const assignIntervention = createAsyncThunk(
  "intervention/assign",
  async ({ id, technicianId, technicianIds }, { rejectWithValue }) => {
    try {
      const team = Array.isArray(technicianIds) ? technicianIds : technicianId ? [technicianId] : [];
      return await interventionService.assign(id, team);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * PUT /api/maintenance/:id/status { status } — explicit technician-driven
 * status change (US-recycled: "In progress when he receives it, Completed
 * when he completes it"; default is PENDING).
 *
 * BACKEND TODO — the endpoint does not exist yet; a 404 surfaces as an
 * honest "not available yet" message in the UI instead of a silent failure.
 */
export const updateInterventionStatus = createAsyncThunk(
  "intervention/updateStatus",
  async ({ id, status }, { rejectWithValue }) => {
    try {
      return await interventionService.updateStatus(id, status);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** POST /api/maintenance/:id/diagnoses (US45). */
export const addInterventionDiagnosis = createAsyncThunk(
  "intervention/addDiagnosis",
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      return await interventionService.addDiagnosis(id, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// ── Technician edit flows (item 10) ────────────────────────────────────────
// These back "the technician can modify its description and observation and
// action performed and pieces fixed or replaced". The target endpoints are
// BACKEND TODOs; a 404/405 surfaces as an honest message in the sheet.

/** PUT /api/maintenance/:id — edit title/description/priority/schedule. */
export const updateInterventionDetails = createAsyncThunk(
  "intervention/updateDetails",
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      return await interventionService.updateDetails(id, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** PUT /api/maintenance/:id/diagnoses/:diagnosisId — edit a diagnosis. */
export const updateInterventionDiagnosis = createAsyncThunk(
  "intervention/updateDiagnosis",
  async ({ id, entryId, ...body }, { rejectWithValue }) => {
    try {
      return await interventionService.updateDiagnosis(id, entryId, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** PUT /api/maintenance/:id/actions/:actionId — edit action + parts. */
export const updateInterventionAction = createAsyncThunk(
  "intervention/updateAction",
  async ({ id, entryId, ...body }, { rejectWithValue }) => {
    try {
      return await interventionService.updateAction(id, entryId, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** PUT /api/maintenance/:id/observations/:observationId — edit an observation. */
export const updateInterventionObservation = createAsyncThunk(
  "intervention/updateObservation",
  async ({ id, entryId, ...body }, { rejectWithValue }) => {
    try {
      return await interventionService.updateObservation(id, entryId, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** POST /api/maintenance/:id/actions (US46). */
export const addInterventionAction = createAsyncThunk(
  "intervention/addAction",
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      return await interventionService.addAction(id, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** POST /api/maintenance/:id/observations (US47). */
export const addInterventionObservation = createAsyncThunk(
  "intervention/addObservation",
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      return await interventionService.addObservation(id, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** PUT /api/maintenance/:id/close (US48) — terminal status change. */
export const closeIntervention = createAsyncThunk(
  "intervention/close",
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      return await interventionService.close(id, body);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** GET /api/maintenance/recommendations/:machineId (US50). */
export const fetchRecommendations = createAsyncThunk(
  "intervention/fetchRecommendations",
  async (machineId, { rejectWithValue }) => {
    try {
      return await interventionService.getRecommendations(machineId);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/** POST /api/maintenance/recommendations/:machineId/apply?index= (US50). */
export const applyRecommendation = createAsyncThunk(
  "intervention/applyRecommendation",
  async ({ machineId, index, technicianId }, { rejectWithValue }) => {
    try {
      return await interventionService.applyRecommendation(machineId, index, technicianId);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const interventionSlice = createSlice({
  name: "intervention",
  initialState: {
    list: [],
    current: null,
    currentStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'error'
    currentError: null,
    status: "idle",
    error: null,
    mutating: "idle", // assign/close/diagnosis/action/observation ops
    editError: null, // last technician-edit failure (item 10)
    filters: {
      status: null, // PENDING | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED
      priority: null, // LOW | MEDIUM | HIGH
      search: "",
    },
    pagination: { page: 0, size: 20, totalElements: 0, totalPages: 1 },
    recommendations: [],
    recommendationsStatus: "idle",
    recommendationsError: null,
  },
  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearMutatingError(state) {
      state.mutating = "idle";
      state.mutatingError = null;
    },
    clearRecommendations(state) {
      state.recommendations = [];
      state.recommendationsStatus = "idle";
      state.recommendationsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInterventions.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchInterventions.fulfilled, (state, action) => {
        state.status = "succeeded";
        const payload = action.payload || {};
        state.list = payload.list || [];
        state.pagination = {
          page: payload.page ?? action.meta.arg?.page ?? 0,
          size: payload.size ?? action.meta.arg?.size ?? state.pagination.size,
          totalElements: payload.totalElements ?? state.list.length,
          totalPages: payload.totalPages ?? 1,
        };
      })
      .addCase(fetchInterventions.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || { message: "Failed to fetch interventions" };
      });

    builder
      .addCase(fetchInterventionById.pending, (state) => {
        state.currentStatus = "loading";
        state.currentError = null;
      })
      .addCase(fetchInterventionById.fulfilled, (state, action) => {
        state.currentStatus = "succeeded";
        state.current = action.payload;
      })
      .addCase(fetchInterventionById.rejected, (state, action) => {
        state.currentStatus = "error";
        state.currentError = action.payload || { message: "Failed to load intervention" };
      });

    const upsert = (state, intervention) => {
      if (!intervention || !intervention.id) return;
      const idx = state.list.findIndex((t) => t.id === intervention.id);
      if (idx !== -1) state.list[idx] = intervention;
      else state.list.unshift(intervention);
      if (state.current?.id === intervention.id) state.current = intervention;
    };

    builder
      .addCase(createIntervention.fulfilled, (state, action) => {
        if (action.payload) state.list.unshift(action.payload);
      })
      .addCase(assignIntervention.pending, (state, action) => {
        state.mutating = "loading";
        // Optimistic assignment so the technician chip reacts instantly.
        const { id, technicianId, technicianIds } = action.meta.arg || {};
        const team = Array.isArray(technicianIds) && technicianIds.length
          ? technicianIds
          : technicianId
            ? [technicianId]
            : [];
        const row = state.list.find((t) => t.id === id);
        const target = row || (state.current?.id === id ? state.current : null);
        if (target && team.length) {
          target.technicianId = team[0];
          target.technicianIds = team;
          if (target.status === "PENDING") target.status = "ASSIGNED";
        }
      })
      .addCase(assignIntervention.rejected, (state, action) => {
        state.mutating = "error";
        state.mutatingError = action.payload?.message || "Assignment failed";
      })
      .addCase(assignIntervention.fulfilled, (state, action) => {
        state.mutating = "succeeded";
        upsert(state, action.payload);
      })
      .addCase(updateInterventionStatus.pending, (state, action) => {
        state.mutating = "loading";
        // Optimistic so the status chip reacts instantly on slow links.
        const { id, status } = action.meta.arg || {};
        const row = state.list.find((t) => t.id === id);
        const target = row || (state.current?.id === id ? state.current : null);
        if (target && status) target.status = status;
      })
      .addCase(updateInterventionStatus.rejected, (state, action) => {
        state.mutating = "error";
        state.mutatingError = action.payload?.message || "Status change failed";
      })
      .addCase(updateInterventionStatus.fulfilled, (state, action) => {
        state.mutating = "succeeded";
        upsert(state, action.payload);
      });

    // Technician edit flows (item 10) — pending keeps a "Saving…" flag,
    // fulfilled upserts the server's version of the intervention; a rejected
    // call (endpoint missing / forbidden) surfaces editError in the sheet.
    [
      updateInterventionDetails,
      updateInterventionDiagnosis,
      updateInterventionAction,
      updateInterventionObservation,
    ].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.mutating = "loading";
          state.editError = null;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.mutating = "error";
          state.editError = action.payload || { message: "Edit failed" };
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.mutating = "succeeded";
          state.editError = null;
          upsert(state, action.payload);
        });
    });

    builder
      .addCase(addInterventionDiagnosis.pending, (state) => {
        state.mutating = "loading";
      })
      .addCase(addInterventionDiagnosis.rejected, (state, action) => {
        state.mutating = "error";
        state.mutatingError = action.payload?.message || "Diagnosis failed";
      })
      .addCase(addInterventionDiagnosis.fulfilled, (state, action) => {
        state.mutating = "succeeded";
        upsert(state, action.payload);
      })
      .addCase(addInterventionAction.pending, (state) => {
        state.mutating = "loading";
      })
      .addCase(addInterventionAction.rejected, (state) => {
        state.mutating = "error";
      })
      .addCase(addInterventionAction.fulfilled, (state, action) => {
        state.mutating = "succeeded";
        upsert(state, action.payload);
      })
      .addCase(addInterventionObservation.pending, (state) => {
        state.mutating = "loading";
      })
      .addCase(addInterventionObservation.rejected, (state) => {
        state.mutating = "error";
      })
      .addCase(addInterventionObservation.fulfilled, (state, action) => {
        state.mutating = "succeeded";
        upsert(state, action.payload);
      })
      .addCase(closeIntervention.pending, (state, action) => {
        state.mutating = "loading";
        const { id } = action.meta.arg || {};
        const target =
          state.list.find((t) => t.id === id) ||
          (state.current?.id === id ? state.current : null);
        if (target) target.status = "COMPLETED"; // optimistic
      })
      .addCase(closeIntervention.rejected, (state, action) => {
        state.mutating = "error";
        const { id } = action.meta.arg || {};
        const target =
          state.list.find((t) => t.id === id) ||
          (state.current?.id === id ? state.current : null);
        if (target && target.status === "COMPLETED") {
          target.status = target.technicianId ? "IN_PROGRESS" : "PENDING";
        }
      })
      .addCase(closeIntervention.fulfilled, (state, action) => {
        state.mutating = "succeeded";
        upsert(state, action.payload);
      });

    builder
      .addCase(fetchRecommendations.pending, (state) => {
        state.recommendationsStatus = "loading";
        state.recommendationsError = null;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.recommendationsStatus = "succeeded";
        state.recommendations = action.payload || [];
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.recommendationsStatus = "error";
        state.recommendationsError =
          action.payload || { message: "Failed to fetch recommendations" };
      })
      .addCase(applyRecommendation.pending, (state) => {
        state.mutating = "loading";
      })
      .addCase(applyRecommendation.rejected, (state) => {
        state.mutating = "error";
      })
      .addCase(applyRecommendation.fulfilled, (state, action) => {
        state.mutating = "succeeded";
        if (action.payload) {
          const idx = state.list.findIndex((t) => t.id === action.payload.id);
          if (idx === -1) state.list.unshift(action.payload);
        }
      });
  },
});

export const { setFilters, clearMutatingError, clearRecommendations } = interventionSlice.actions;
export default interventionSlice.reducer;
