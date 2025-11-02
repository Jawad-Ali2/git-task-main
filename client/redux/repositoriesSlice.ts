import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '@/lib/axios';

export interface Repository {
  id: string;
  githubId: string;
  name: string;
  url: string;
  private: boolean;
  ai_summary: string | null;
  debt_score: number | null;
}

export interface RepositoriesState {
  repositories: Repository[];
  loading: boolean;
  error?: string | null;
}

const initialState: RepositoriesState = {
  repositories: [],
  loading: false,
  error: null,
};

// Thunks
export const fetchRepositories = createAsyncThunk(
  'repositories/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/repositories');
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

const repositoriesSlice = createSlice({
  name: 'repositories',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    clearRepositories(state) {
      state.repositories = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchRepositories
      .addCase(fetchRepositories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRepositories.fulfilled, (state, action: PayloadAction<Repository[]>) => {
        state.loading = false;
        state.repositories = action.payload;
      })
      .addCase(fetchRepositories.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as any)?.message || 'Failed to fetch repositories';
      });
  },
});

export const { clearError, clearRepositories } = repositoriesSlice.actions;

export const selectRepositories = (state: { repositories: RepositoriesState }) => state.repositories.repositories;
export const selectRepositoriesLoading = (state: { repositories: RepositoriesState }) => state.repositories.loading;
export const selectRepositoriesError = (state: { repositories: RepositoriesState }) => state.repositories.error;

export default repositoriesSlice.reducer;
