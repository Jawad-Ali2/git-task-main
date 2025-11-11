import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '@/lib/axios';

export interface TrelloConfig {
  boardId?: string;
  boardName?: string;
  todoListId?: string;
  todoListName?: string;
  inProgressListId?: string;
  inProgressListName?: string;
  doneListId?: string;
  doneListName?: string;
  syncEnabled?: boolean;
  autoCreateCards?: boolean;
  autoMoveCards?: boolean;
  webhookId?: string;
}

export interface Integration {
  id: string;
  provider: string;
  config: TrelloConfig;
  status: 'active' | 'inactive' | 'error' | 'revoked';
  lastError?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
  desc: string;
}

export interface TrelloList {
  id: string;
  name: string;
  idBoard: string;
  pos: number;
}

interface IntegrationsState {
  integrations: Integration[];
  trelloBoards: TrelloBoard[];
  trelloLists: TrelloList[];
  loading: boolean;
  error: string | null;
  syncStatus: {
    syncing: boolean;
    synced: number;
    failed: number;
    errors: string[];
  };
}

const initialState: IntegrationsState = {
  integrations: [],
  trelloBoards: [],
  trelloLists: [],
  loading: false,
  error: null,
  syncStatus: {
    syncing: false,
    synced: 0,
    failed: 0,
    errors: [],
  },
};

// Async thunks
export const fetchIntegrations = createAsyncThunk(
  'integrations/fetchIntegrations',
  async (provider?: string) => {
    const response = await axiosInstance.get('/integrations', {
      params: provider ? { provider } : undefined,
    });
    return response.data;
  }
);

export const getTrelloAuthUrl = createAsyncThunk(
  'integrations/getTrelloAuthUrl',
  async () => {
    const response = await axiosInstance.get('/integrations/trello/authorize');
    return response.data.authUrl;
  }
);

export const completeTrelloAuth = createAsyncThunk(
  'integrations/completeTrelloAuth',
  async (token: string) => {
    const response = await axiosInstance.post('/integrations/trello/callback', {
      token,
    });
    return response.data;
  }
);

export const fetchTrelloBoards = createAsyncThunk(
  'integrations/fetchTrelloBoards',
  async () => {
    const response = await axiosInstance.get('/integrations/trello/boards');
    return response.data;
  }
);

export const fetchTrelloLists = createAsyncThunk(
  'integrations/fetchTrelloLists',
  async (boardId: string) => {
    const response = await axiosInstance.get(
      `/integrations/trello/boards/${boardId}/lists`
    );
    return response.data;
  }
);

export const configureTrello = createAsyncThunk(
  'integrations/configureTrello',
  async ({ id, config }: { id: string; config: TrelloConfig }) => {
    const response = await axiosInstance.post(
      `/integrations/${id}/configure`,
      config
    );
    return response.data;
  }
);

export const updateIntegration = createAsyncThunk(
  'integrations/updateIntegration',
  async ({ id, config }: { id: string; config: Partial<TrelloConfig> }) => {
    const response = await axiosInstance.put(`/integrations/${id}`, {
      config,
    });
    return response.data;
  }
);

export const deleteIntegration = createAsyncThunk(
  'integrations/deleteIntegration',
  async (id: string) => {
    await axiosInstance.delete(`/integrations/${id}`);
    return id;
  }
);

export const syncTaskToTrello = createAsyncThunk(
  'integrations/syncTaskToTrello',
  async (taskId: string) => {
    const response = await axiosInstance.post(
      `/integrations/sync/task/${taskId}`
    );
    return response.data;
  }
);

export const syncRepositoryToTrello = createAsyncThunk(
  'integrations/syncRepositoryToTrello',
  async (params: { repositoryId?: string; force?: boolean }) => {
    const response = await axiosInstance.post(
      '/integrations/sync/repository',
      params
    );
    return response.data;
  }
);

const integrationsSlice = createSlice({
  name: 'integrations',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSyncStatus: (state) => {
      state.syncStatus = {
        syncing: false,
        synced: 0,
        failed: 0,
        errors: [],
      };
    },
  },
  extraReducers: (builder) => {
    // Fetch integrations
    builder
      .addCase(fetchIntegrations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchIntegrations.fulfilled, (state, action) => {
        state.loading = false;
        state.integrations = action.payload;
      })
      .addCase(fetchIntegrations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch integrations';
      });

    // Get Trello auth URL
    builder
      .addCase(getTrelloAuthUrl.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTrelloAuthUrl.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(getTrelloAuthUrl.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to get auth URL';
      });

    // Complete Trello auth
    builder
      .addCase(completeTrelloAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(completeTrelloAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.integrations.push(action.payload);
      })
      .addCase(completeTrelloAuth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to complete auth';
      });

    // Fetch Trello boards
    builder
      .addCase(fetchTrelloBoards.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTrelloBoards.fulfilled, (state, action) => {
        state.loading = false;
        state.trelloBoards = action.payload;
      })
      .addCase(fetchTrelloBoards.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch boards';
      });

    // Fetch Trello lists
    builder
      .addCase(fetchTrelloLists.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTrelloLists.fulfilled, (state, action) => {
        state.loading = false;
        state.trelloLists = action.payload;
      })
      .addCase(fetchTrelloLists.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch lists';
      });

    // Configure Trello
    builder
      .addCase(configureTrello.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(configureTrello.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.integrations.findIndex(
          (i) => i.id === action.payload.id
        );
        if (index !== -1) {
          state.integrations[index] = action.payload;
        }
      })
      .addCase(configureTrello.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to configure Trello';
      });

    // Update integration
    builder
      .addCase(updateIntegration.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateIntegration.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.integrations.findIndex(
          (i) => i.id === action.payload.id
        );
        if (index !== -1) {
          state.integrations[index] = action.payload;
        }
      })
      .addCase(updateIntegration.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update integration';
      });

    // Delete integration
    builder
      .addCase(deleteIntegration.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteIntegration.fulfilled, (state, action) => {
        state.loading = false;
        state.integrations = state.integrations.filter(
          (i) => i.id !== action.payload
        );
      })
      .addCase(deleteIntegration.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to delete integration';
      });

    // Sync task to Trello
    builder
      .addCase(syncTaskToTrello.pending, (state) => {
        state.error = null;
      })
      .addCase(syncTaskToTrello.fulfilled, (state) => {
        // Task updated, could refresh tasks if needed
      })
      .addCase(syncTaskToTrello.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to sync task';
      });

    // Sync repository to Trello
    builder
      .addCase(syncRepositoryToTrello.pending, (state) => {
        state.syncStatus.syncing = true;
        state.syncStatus.synced = 0;
        state.syncStatus.failed = 0;
        state.syncStatus.errors = [];
        state.error = null;
      })
      .addCase(syncRepositoryToTrello.fulfilled, (state, action) => {
        state.syncStatus.syncing = false;
        state.syncStatus.synced = action.payload.synced;
        state.syncStatus.failed = action.payload.failed;
        state.syncStatus.errors = action.payload.errors || [];
      })
      .addCase(syncRepositoryToTrello.rejected, (state, action) => {
        state.syncStatus.syncing = false;
        state.error = action.error.message || 'Failed to sync repository';
      });
  },
});

export const { clearError, clearSyncStatus } = integrationsSlice.actions;
export default integrationsSlice.reducer;
