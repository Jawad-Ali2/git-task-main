import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import axiosInstance from '@/lib/axios';

export interface PendingScanRepo {
  id: string;
  githubId: string;
  name: string;
  fullName?: string;
  needsScan: boolean;
}

export interface ScanNotification {
  id: string; // Unique notification ID
  repositories: PendingScanRepo[];
  timestamp: number;
  dismissed: boolean;
}

export interface ScanNotificationState {
  notifications: ScanNotification[];
  scanning: Record<string, boolean>; // Track which repos are currently scanning
  loading: boolean;
  error?: string | null;
}

const initialState: ScanNotificationState = {
  notifications: [],
  scanning: {},
  loading: false,
  error: null,
};

// Thunks
export const triggerScan = createAsyncThunk(
  'scanNotification/triggerScan',
  async ({ repoId }: { repoId: string }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(`/tasks/scan/${repoId}`);
      return { repoId, data: response.data };
    } catch (err: any) {
      return rejectWithValue({
        repoId,
        message: err.response?.data?.message || 'Failed to trigger scan'
      });
    }
  }
);

export const triggerMultipleScans = createAsyncThunk(
  'scanNotification/triggerMultipleScans',
  async ({ repoIds }: { repoIds: string[] }, { dispatch }) => {
    const results = await Promise.allSettled(
      repoIds.map(repoId => dispatch(triggerScan({ repoId })))
    );
    return results;
  }
);

export const checkScanStatus = createAsyncThunk(
  'scanNotification/checkScanStatus',
  async ({ repoId }: { repoId: string }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/tasks/scan/${repoId}/status`);
      return { repoId, status: response.data };
    } catch (err: any) {
      return rejectWithValue({
        repoId,
        message: err.response?.data?.message || 'Failed to check scan status'
      });
    }
  }
);

const scanNotificationSlice = createSlice({
  name: 'scanNotification',
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<Omit<ScanNotification, 'id' | 'timestamp' | 'dismissed'>>) {
      const notification: ScanNotification = {
        id: `notification-${Date.now()}`,
        timestamp: Date.now(),
        dismissed: false,
        ...action.payload,
      };
      state.notifications.push(notification);
    },
    
    dismissNotification(state, action: PayloadAction<string>) {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.dismissed = true;
      }
    },
    
    removeNotification(state, action: PayloadAction<string>) {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    
    clearAllNotifications(state) {
      state.notifications = [];
      state.scanning = {};
    },
    
    setScanningStatus(state, action: PayloadAction<{ repoId: string; isScanning: boolean }>) {
      const { repoId, isScanning } = action.payload;
      if (isScanning) {
        state.scanning[repoId] = true;
      } else {
        delete state.scanning[repoId];
      }
    },
    
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // triggerScan
      .addCase(triggerScan.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.scanning[action.meta.arg.repoId] = true;
      })
      .addCase(triggerScan.fulfilled, (state, action) => {
        state.loading = false;
        // Keep scanning state - it will be cleared when scan completes
      })
      .addCase(triggerScan.rejected, (state, action) => {
        state.loading = false;
        const payload = action.payload as { repoId: string; message: string };
        if (payload?.repoId) {
          delete state.scanning[payload.repoId];
        }
        state.error = payload?.message || 'Failed to trigger scan';
      })

      // checkScanStatus
      .addCase(checkScanStatus.fulfilled, (state, action) => {
        const { repoId, status } = action.payload;
        // If scan is complete or failed, remove from scanning state
        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
          delete state.scanning[repoId];
        }
      })
      .addCase(checkScanStatus.rejected, (state, action) => {
        const payload = action.payload as { repoId: string; message: string };
        if (payload?.repoId) {
          delete state.scanning[payload.repoId];
        }
      });
  },
});

export const {
  addNotification,
  dismissNotification,
  removeNotification,
  clearAllNotifications,
  setScanningStatus,
  clearError,
} = scanNotificationSlice.actions;

// Memoized selectors to prevent unnecessary re-renders
const selectScanNotificationState = (state: { scanNotification: ScanNotificationState }) => 
  state.scanNotification;

export const selectActiveNotifications = createSelector(
  [selectScanNotificationState],
  (scanNotification) => scanNotification.notifications.filter(n => !n.dismissed)
);

export const selectIsScanningRepo = (repoId: string) => 
  createSelector(
    [selectScanNotificationState],
    (scanNotification) => scanNotification.scanning[repoId] || false
  );

export const selectAnyScanInProgress = createSelector(
  [selectScanNotificationState],
  (scanNotification) => Object.keys(scanNotification.scanning).length > 0
);

export default scanNotificationSlice.reducer;
