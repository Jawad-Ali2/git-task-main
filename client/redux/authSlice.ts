import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '@/lib/axios';

export interface User {
  userId: string;
  githubId: string;
  email: string;
  avatarUrl?: string;
  name?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error?: string | null;
  initialized: boolean; // Track if initial auth check is done
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  initialized: false,
};

// Singleton promise to prevent race conditions
let profileFetchPromise: Promise<any> | null = null;

// Thunks
export const fetchProfile = createAsyncThunk(
  'auth/fetchProfile', 
  async (_, { rejectWithValue }) => {
    // Return existing promise if already fetching
    if (profileFetchPromise) {
      try {
        return await profileFetchPromise;
      } catch (error) {
        profileFetchPromise = null;
        throw error;
      }
    }

    // Create new fetch promise
    profileFetchPromise = (async () => {
      try {
        const res = await axiosInstance.get('/auth/profile');
        return res.data.user;
      } catch (err: any) {
        // Don't treat 401 as an error - user is just not authenticated
        if (err.response?.status === 401) {
          throw { silent: true };
        }
        throw err.response?.data || err.message;
      } finally {
        profileFetchPromise = null;
      }
    })();

    try {
      return await profileFetchPromise;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const refreshTokens = createAsyncThunk(
  'auth/refreshTokens', 
  async (_, { rejectWithValue }) => {
    try {
      await axiosInstance.post('/auth/refresh');
      const res = await axiosInstance.get('/auth/profile');
      return res.data.user;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const logoutThunk = createAsyncThunk(
  'auth/logout', 
  async (_, { rejectWithValue }) => {
    try {
      await axiosInstance.post('/auth/logout');
      return true;
    } catch (err: any) {
      return true;
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
    clearAuth(state) {
      state.user = null;
      state.error = null;
      state.loading = false;
      state.initialized = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchProfile
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
        state.initialized = true;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.user = null;
        
        // Don't set error for silent rejections (401s)
        if (!(action.payload as any)?.silent) {
          state.error = (action.payload as any)?.message || 'Failed to fetch profile';
        }
      })

      // refreshTokens
      .addCase(refreshTokens.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshTokens.fulfilled, (state, action: PayloadAction<User>) => {
        state.loading = false;
        state.user = action.payload;
        state.initialized = true;
      })
      .addCase(refreshTokens.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.initialized = true;
      })

      // logout
      .addCase(logoutThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.initialized = false;
      })
      .addCase(logoutThunk.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.initialized = false;
      });
  },
});

export const { setUser, clearError, clearAuth } = authSlice.actions;

export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;

export default authSlice.reducer;
