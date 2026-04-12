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

export interface JiraConfig {
  cloudId?: string;
  cloudName?: string;
  siteUrl?: string;
  projectId?: string;
  projectKey?: string;
  projectName?: string;
  issueTypeId?: string;
  issueTypeName?: string;
  todoStatusId?: string;
  todoStatusName?: string;
  inProgressStatusId?: string;
  inProgressStatusName?: string;
  doneStatusId?: string;
  doneStatusName?: string;
  syncEnabled?: boolean;
  autoCreateIssues?: boolean;
  autoTransitionIssues?: boolean;
  webhookId?: string;
}

export type IntegrationConfig = TrelloConfig | JiraConfig;

export interface Integration {
  id: string;
  provider: 'trello' | 'jira' | 'asana';
  config: IntegrationConfig;
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

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  subtask: boolean;
  iconUrl?: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    id: number;
    key: string;
    name: string;
  };
}

interface IntegrationsState {
  integrations: Integration[];
  userConnections: Integration[];  // User-level OAuth connections (no repositoryId)
  trelloBoards: TrelloBoard[];
  trelloLists: TrelloList[];
  jiraProjects: JiraProject[];
  jiraIssueTypes: JiraIssueType[];
  jiraStatuses: JiraStatus[];
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
  userConnections: [],
  trelloBoards: [],
  trelloLists: [],
  jiraProjects: [],
  jiraIssueTypes: [],
  jiraStatuses: [],
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
  async (params?: { provider?: string; repositoryId?: string }) => {
    const response = await axiosInstance.get('/integrations', {
      params,
    });
    return response.data;
  }
);

// Fetch user-level OAuth connections (no repositoryId)
export const fetchUserConnections = createAsyncThunk(
  'integrations/fetchUserConnections',
  async () => {
    const response = await axiosInstance.get('/integrations/connections');
    return response.data;
  }
);

// Link a repository to a provider (copies OAuth tokens to create repo-specific integration)
export const linkRepositoryToProvider = createAsyncThunk(
  'integrations/linkRepositoryToProvider',
  async ({ provider, repositoryId }: { provider: string; repositoryId: string }) => {
    const response = await axiosInstance.post(`/integrations/link/${provider}/${repositoryId}`);
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

// Jira Async Thunks
export const getJiraAuthUrl = createAsyncThunk(
  'integrations/getJiraAuthUrl',
  async () => {
    const response = await axiosInstance.get('/integrations/jira/authorize');
    return response.data.authUrl;
  }
);

export const completeJiraAuth = createAsyncThunk(
  'integrations/completeJiraAuth',
  async (code: string) => {
    const response = await axiosInstance.post('/integrations/jira/callback', {
      code,
    });
    return response.data;
  }
);

export const fetchJiraProjects = createAsyncThunk(
  'integrations/fetchJiraProjects',
  async () => {
    const response = await axiosInstance.get('/integrations/jira/projects');
    return response.data;
  }
);

export const fetchJiraStatuses = createAsyncThunk(
  'integrations/fetchJiraStatuses',
  async (projectId: string) => {
    const response = await axiosInstance.get(
      `/integrations/jira/projects/${projectId}/statuses`
    );
    return response.data;
  }
);

export const configureJira = createAsyncThunk(
  'integrations/configureJira',
  async ({ id, config }: { id: string; config: JiraConfig }) => {
    // Use the Jira-specific configure endpoint which handles webhook creation
    const response = await axiosInstance.post(
      `/integrations/jira/${id}/configure`,
      config
    );
    return response.data;
  }
);

export const syncTaskToJira = createAsyncThunk(
  'integrations/syncTaskToJira',
  async (taskId: string) => {
    const response = await axiosInstance.post(
      `/integrations/jira/sync/task/${taskId}`
    );
    return response.data;
  }
);

export const syncRepositoryToJira = createAsyncThunk(
  'integrations/syncRepositoryToJira',
  async (params: { repositoryId?: string; force?: boolean }) => {
    const response = await axiosInstance.post(
      '/integrations/jira/sync/repository',
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

    // Fetch user connections (OAuth-only, no repositoryId)
    builder
      .addCase(fetchUserConnections.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserConnections.fulfilled, (state, action) => {
        state.loading = false;
        state.userConnections = action.payload;
      })
      .addCase(fetchUserConnections.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch connections';
      });

    // Link repository to provider
    builder
      .addCase(linkRepositoryToProvider.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(linkRepositoryToProvider.fulfilled, (state, action) => {
        state.loading = false;
        state.integrations.push(action.payload);
      })
      .addCase(linkRepositoryToProvider.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to link repository';
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
        state.userConnections.push(action.payload);
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
        state.userConnections = state.userConnections.filter(
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

    // Get Jira auth URL
    builder
      .addCase(getJiraAuthUrl.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getJiraAuthUrl.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(getJiraAuthUrl.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to get Jira auth URL';
      });

    // Complete Jira auth
    builder
      .addCase(completeJiraAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(completeJiraAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.userConnections.push(action.payload);
      })
      .addCase(completeJiraAuth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to complete Jira auth';
      });

    // Fetch Jira projects
    builder
      .addCase(fetchJiraProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchJiraProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.jiraProjects = action.payload;
      })
      .addCase(fetchJiraProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch Jira projects';
      });

    // Fetch Jira statuses
    builder
      .addCase(fetchJiraStatuses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchJiraStatuses.fulfilled, (state, action) => {
        state.loading = false;
        state.jiraStatuses = action.payload.statuses || action.payload;
        state.jiraIssueTypes = action.payload.issueTypes || [];
      })
      .addCase(fetchJiraStatuses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch Jira statuses';
      });

    // Configure Jira
    builder
      .addCase(configureJira.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(configureJira.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.integrations.findIndex(
          (i) => i.id === action.payload.id
        );
        if (index !== -1) {
          state.integrations[index] = action.payload;
        }
      })
      .addCase(configureJira.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to configure Jira';
      });

    // Sync task to Jira
    builder
      .addCase(syncTaskToJira.pending, (state) => {
        state.error = null;
      })
      .addCase(syncTaskToJira.fulfilled, (state) => {
        // Task updated, could refresh tasks if needed
      })
      .addCase(syncTaskToJira.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to sync task to Jira';
      });

    // Sync repository to Jira
    builder
      .addCase(syncRepositoryToJira.pending, (state) => {
        state.syncStatus.syncing = true;
        state.syncStatus.synced = 0;
        state.syncStatus.failed = 0;
        state.syncStatus.errors = [];
        state.error = null;
      })
      .addCase(syncRepositoryToJira.fulfilled, (state, action) => {
        state.syncStatus.syncing = false;
        state.syncStatus.synced = action.payload.synced;
        state.syncStatus.failed = action.payload.failed;
        state.syncStatus.errors = action.payload.errors || [];
      })
      .addCase(syncRepositoryToJira.rejected, (state, action) => {
        state.syncStatus.syncing = false;
        state.error = action.error.message || 'Failed to sync repository to Jira';
      });
  },
});

export const { clearError, clearSyncStatus } = integrationsSlice.actions;
export default integrationsSlice.reducer;
