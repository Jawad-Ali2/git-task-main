import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '@/lib/axios';

// ============ Types ============

export type TeamRole = 'pm' | 'tl' | 'developer';

export interface TeamMember {
  id: number;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface AssignableMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: TeamRole;
}

export interface TeamTask {
  id: string;
  description: string;
  type: string; // TODO | FIXME | HACK | NOTE | BUG
  status: string; // open | in-progress | done
  priority: string; // low | medium | high
  filePath: string;
  lineNumber: number;
  ai_summary?: string;
  debt_score?: number;
  assignedToId?: string;
  assignedById?: string;
  assignedAt?: string;
  dueDate?: string;
  assignedTo?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  assignedBy?: {
    id: string;
    name: string;
  };
  repository: {
    id: string;
    name: string;
    url: string;
  };
}

export interface TeamRepository {
  id: number;
  repositoryId: string;
  addedAt: string;
  addedById: string;
  repository: {
    id: string;
    name: string;
    url: string;
    private: boolean;
  };
  addedBy?: {
    id: string;
    name: string;
  };
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  inviteCode: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  members: TeamMember[];
  repositories: TeamRepository[];
  role?: TeamRole; // User's role in the team
  memberCount?: number;
}

export interface TeamPreview {
  id: string;
  name: string;
  memberCount: number;
}

// ============ Analytics Types ============

export interface MemberWorkload {
  userId: string;
  userName: string;
  avatarUrl?: string;
  role: TeamRole;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
}

export interface TeamAnalytics {
  overview: {
    totalTasks: number;
    assignedTasks: number;
    unassignedTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  byStatus: {
    open: number;
    'in-progress': number;
    done: number;
  };
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  byType: Record<string, number>;
  memberWorkloads: MemberWorkload[];
  recentlyAssigned: TeamTask[];
  upcomingDeadlines: TeamTask[];
  highPriorityUnassigned: TeamTask[];
}

// ============ Activity Feed Types ============

export enum ActivityType {
  TASK_CREATED = 'task_created',
  TASK_ASSIGNED = 'task_assigned',
  TASK_UNASSIGNED = 'task_unassigned',
  TASK_COMPLETED = 'task_completed',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_PRIORITY_CHANGED = 'task_priority_changed',
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
  MEMBER_REMOVED = 'member_removed',
  MEMBER_ROLE_CHANGED = 'member_role_changed',
  REPO_SHARED = 'repo_shared',
  REPO_UNSHARED = 'repo_unshared',
  REPO_SCANNED = 'repo_scanned',
  TEAM_CREATED = 'team_created',
  TEAM_UPDATED = 'team_updated',
}

export interface ActivityMetadata {
  taskId?: string;
  taskDescription?: string;
  taskType?: string;
  repositoryId?: string;
  repositoryName?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatarUrl?: string;
  oldStatus?: string;
  newStatus?: string;
  oldPriority?: string;
  newPriority?: string;
  oldRole?: string;
  newRole?: string;
  memberName?: string;
  memberAvatarUrl?: string;
  tasksFound?: number;
}

export interface Activity {
  id: string;
  teamId: string;
  userId?: string;
  type: ActivityType;
  metadata?: ActivityMetadata;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface ActivityFeed {
  activities: Activity[];
  total: number;
  hasMore: boolean;
}

// ============ Member Progress Types ============

export interface MemberProgress {
  member: {
    userId: string;
    name: string;
    email: string;
    avatarUrl?: string;
    role: TeamRole;
    joinedAt: string;
  };
  stats: {
    totalAssigned: number;
    completed: number;
    inProgress: number;
    pending: number;
    overdue: number;
    completionRate: number;
  };
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  byType: Record<string, number>;
  recentTasks: TeamTask[];
  activitySummary: {
    tasksCompletedThisWeek: number;
    tasksAssignedThisWeek: number;
  };
}

export interface TeamsState {
  teams: Team[];
  currentTeam: Team | null;
  teamPreview: TeamPreview | null;
  teamTasks: TeamTask[];
  assignableMembers: AssignableMember[];
  myAssignedTasks: TeamTask[];
  teamAnalytics: TeamAnalytics | null;
  activityFeed: ActivityFeed | null;
  memberProgress: MemberProgress | null;
  loading: boolean;
  error: string | null;
  createLoading: boolean;
  joinLoading: boolean;
  tasksLoading: boolean;
  assignLoading: boolean;
  analyticsLoading: boolean;
  activityLoading: boolean;
  memberProgressLoading: boolean;
}

const initialState: TeamsState = {
  teams: [],
  currentTeam: null,
  teamPreview: null,
  teamTasks: [],
  assignableMembers: [],
  myAssignedTasks: [],
  teamAnalytics: null,
  activityFeed: null,
  memberProgress: null,
  loading: false,
  error: null,
  createLoading: false,
  joinLoading: false,
  tasksLoading: false,
  assignLoading: false,
  analyticsLoading: false,
  activityLoading: false,
  memberProgressLoading: false,
};

// ============ Async Thunks ============

export const fetchTeams = createAsyncThunk(
  'teams/fetchTeams',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/teams');
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch teams');
    }
  }
);

export const fetchTeamById = createAsyncThunk(
  'teams/fetchTeamById',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/teams/${teamId}`);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch team');
    }
  }
);

export const createTeam = createAsyncThunk(
  'teams/createTeam',
  async (data: { name: string; description?: string }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/teams', data);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create team');
    }
  }
);

export const updateTeam = createAsyncThunk(
  'teams/updateTeam',
  async (
    { teamId, data }: { teamId: string; data: { name?: string; description?: string } },
    { rejectWithValue }
  ) => {
    try {
      const response = await axiosInstance.patch(`/teams/${teamId}`, data);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update team');
    }
  }
);

export const deleteTeam = createAsyncThunk(
  'teams/deleteTeam',
  async (teamId: string, { rejectWithValue }) => {
    try {
      await axiosInstance.delete(`/teams/${teamId}`);
      return teamId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete team');
    }
  }
);

export const fetchTeamPreview = createAsyncThunk(
  'teams/fetchTeamPreview',
  async (inviteCode: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/teams/invite/${inviteCode}`);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Invalid invite code');
    }
  }
);

export const joinTeam = createAsyncThunk(
  'teams/joinTeam',
  async (
    { inviteCode, role }: { inviteCode: string; role?: 'developer' | 'pm' },
    { rejectWithValue }
  ) => {
    try {
      const response = await axiosInstance.post(`/teams/join/${inviteCode}`, { role });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to join team');
    }
  }
);

export const leaveTeam = createAsyncThunk(
  'teams/leaveTeam',
  async (teamId: string, { rejectWithValue }) => {
    try {
      await axiosInstance.delete(`/teams/${teamId}/leave`);
      return teamId;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to leave team');
    }
  }
);

export const regenerateInviteCode = createAsyncThunk(
  'teams/regenerateInviteCode',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(`/teams/${teamId}/regenerate-invite`);
      return { teamId, inviteCode: response.data.inviteCode };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to regenerate invite code');
    }
  }
);

export const updateMemberRole = createAsyncThunk(
  'teams/updateMemberRole',
  async (
    { teamId, userId, role }: { teamId: string; userId: string; role: TeamRole },
    { rejectWithValue }
  ) => {
    try {
      const response = await axiosInstance.patch(`/teams/${teamId}/members/${userId}/role`, {
        role,
      });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update member role');
    }
  }
);

export const removeMember = createAsyncThunk(
  'teams/removeMember',
  async ({ teamId, userId }: { teamId: string; userId: string }, { rejectWithValue }) => {
    try {
      await axiosInstance.delete(`/teams/${teamId}/members/${userId}`);
      return { teamId, userId };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to remove member');
    }
  }
);

export const shareRepository = createAsyncThunk(
  'teams/shareRepository',
  async ({ teamId, repoId }: { teamId: string; repoId: string }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(`/teams/${teamId}/repositories/${repoId}`);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to share repository');
    }
  }
);

export const unshareRepository = createAsyncThunk(
  'teams/unshareRepository',
  async ({ teamId, repoId }: { teamId: string; repoId: string }, { rejectWithValue }) => {
    try {
      await axiosInstance.delete(`/teams/${teamId}/repositories/${repoId}`);
      return { teamId, repoId };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to unshare repository');
    }
  }
);

// ============ Task Assignment Thunks ============

export const fetchTeamTasks = createAsyncThunk(
  'teams/fetchTeamTasks',
  async (
    {
      teamId,
      filters,
    }: {
      teamId: string;
      filters?: {
        status?: string;
        priority?: string;
        type?: string;
        assignedTo?: string;
        repositoryId?: string;
      };
    },
    { rejectWithValue }
  ) => {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
      if (filters?.repositoryId) params.append('repositoryId', filters.repositoryId);

      const response = await axiosInstance.get(
        `/teams/${teamId}/tasks${params.toString() ? `?${params.toString()}` : ''}`
      );
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch team tasks');
    }
  }
);

export const fetchAssignableMembers = createAsyncThunk(
  'teams/fetchAssignableMembers',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/teams/${teamId}/members/assignable`);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch assignable members');
    }
  }
);

export const assignTask = createAsyncThunk(
  'teams/assignTask',
  async (
    {
      teamId,
      taskId,
      userId,
      dueDate,
    }: { teamId: string; taskId: string; userId: string; dueDate?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await axiosInstance.post(`/teams/${teamId}/tasks/${taskId}/assign`, {
        userId,
        dueDate,
      });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to assign task');
    }
  }
);

export const unassignTask = createAsyncThunk(
  'teams/unassignTask',
  async ({ teamId, taskId }: { teamId: string; taskId: string }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.delete(`/teams/${teamId}/tasks/${taskId}/assign`);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to unassign task');
    }
  }
);

export const fetchMyAssignedTasks = createAsyncThunk(
  'teams/fetchMyAssignedTasks',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/teams/my/assigned-tasks');
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch assigned tasks');
    }
  }
);

export const fetchTeamAnalytics = createAsyncThunk(
  'teams/fetchTeamAnalytics',
  async (teamId: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/teams/${teamId}/analytics`);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch team analytics');
    }
  }
);

export const fetchTeamActivity = createAsyncThunk(
  'teams/fetchTeamActivity',
  async (
    { teamId, page = 1, limit = 20 }: { teamId: string; page?: number; limit?: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await axiosInstance.get(
        `/teams/${teamId}/activity?page=${page}&limit=${limit}`
      );
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch team activity');
    }
  }
);

export const fetchMemberProgress = createAsyncThunk(
  'teams/fetchMemberProgress',
  async (
    { teamId, memberId }: { teamId: string; memberId: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await axiosInstance.get(`/teams/${teamId}/members/${memberId}/progress`);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch member progress');
    }
  }
);

// ============ Slice ============

const teamsSlice = createSlice({
  name: 'teams',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    clearCurrentTeam(state) {
      state.currentTeam = null;
    },
    clearTeamPreview(state) {
      state.teamPreview = null;
    },
    clearTeamAnalytics(state) {
      state.teamAnalytics = null;
    },
    clearActivityFeed(state) {
      state.activityFeed = null;
    },
    clearMemberProgress(state) {
      state.memberProgress = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch teams
      .addCase(fetchTeams.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeams.fulfilled, (state, action: PayloadAction<Team[]>) => {
        state.loading = false;
        state.teams = action.payload;
      })
      .addCase(fetchTeams.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Fetch team by ID
      .addCase(fetchTeamById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTeamById.fulfilled, (state, action: PayloadAction<Team>) => {
        state.loading = false;
        state.currentTeam = action.payload;
      })
      .addCase(fetchTeamById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Create team
      .addCase(createTeam.pending, (state) => {
        state.createLoading = true;
        state.error = null;
      })
      .addCase(createTeam.fulfilled, (state, action: PayloadAction<Team>) => {
        state.createLoading = false;
        state.teams.push(action.payload);
        state.currentTeam = action.payload;
      })
      .addCase(createTeam.rejected, (state, action) => {
        state.createLoading = false;
        state.error = action.payload as string;
      })

      // Update team
      .addCase(updateTeam.fulfilled, (state, action: PayloadAction<Team>) => {
        const index = state.teams.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.teams[index] = { ...state.teams[index], ...action.payload };
        }
        if (state.currentTeam?.id === action.payload.id) {
          state.currentTeam = { ...state.currentTeam, ...action.payload };
        }
      })

      // Delete team
      .addCase(deleteTeam.fulfilled, (state, action: PayloadAction<string>) => {
        state.teams = state.teams.filter((t) => t.id !== action.payload);
        if (state.currentTeam?.id === action.payload) {
          state.currentTeam = null;
        }
      })

      // Fetch team preview
      .addCase(fetchTeamPreview.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.teamPreview = null;
      })
      .addCase(fetchTeamPreview.fulfilled, (state, action: PayloadAction<TeamPreview>) => {
        state.loading = false;
        state.teamPreview = action.payload;
      })
      .addCase(fetchTeamPreview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Join team
      .addCase(joinTeam.pending, (state) => {
        state.joinLoading = true;
        state.error = null;
      })
      .addCase(joinTeam.fulfilled, (state) => {
        state.joinLoading = false;
        state.teamPreview = null;
      })
      .addCase(joinTeam.rejected, (state, action) => {
        state.joinLoading = false;
        state.error = action.payload as string;
      })

      // Leave team
      .addCase(leaveTeam.fulfilled, (state, action: PayloadAction<string>) => {
        state.teams = state.teams.filter((t) => t.id !== action.payload);
        if (state.currentTeam?.id === action.payload) {
          state.currentTeam = null;
        }
      })

      // Regenerate invite code
      .addCase(
        regenerateInviteCode.fulfilled,
        (state, action: PayloadAction<{ teamId: string; inviteCode: string }>) => {
          const team = state.teams.find((t) => t.id === action.payload.teamId);
          if (team) {
            team.inviteCode = action.payload.inviteCode;
          }
          if (state.currentTeam?.id === action.payload.teamId) {
            state.currentTeam.inviteCode = action.payload.inviteCode;
          }
        }
      )

      // Update member role
      .addCase(updateMemberRole.fulfilled, (state, action: PayloadAction<TeamMember>) => {
        if (state.currentTeam) {
          const memberIndex = state.currentTeam.members.findIndex(
            (m) => m.userId === action.payload.userId
          );
          if (memberIndex !== -1) {
            state.currentTeam.members[memberIndex] = action.payload;
          }
        }
      })

      // Remove member
      .addCase(
        removeMember.fulfilled,
        (state, action: PayloadAction<{ teamId: string; userId: string }>) => {
          if (state.currentTeam?.id === action.payload.teamId) {
            state.currentTeam.members = state.currentTeam.members.filter(
              (m) => m.userId !== action.payload.userId
            );
          }
        }
      )

      // Share repository
      .addCase(shareRepository.fulfilled, (state, action: PayloadAction<TeamRepository>) => {
        if (state.currentTeam) {
          state.currentTeam.repositories.push(action.payload);
        }
      })

      // Unshare repository
      .addCase(
        unshareRepository.fulfilled,
        (state, action: PayloadAction<{ teamId: string; repoId: string }>) => {
          if (state.currentTeam?.id === action.payload.teamId) {
            state.currentTeam.repositories = state.currentTeam.repositories.filter(
              (r) => r.repositoryId !== action.payload.repoId
            );
          }
        }
      )

      // ============ Task Assignment Cases ============

      // Fetch team tasks
      .addCase(fetchTeamTasks.pending, (state) => {
        state.tasksLoading = true;
        state.error = null;
      })
      .addCase(fetchTeamTasks.fulfilled, (state, action: PayloadAction<TeamTask[]>) => {
        state.tasksLoading = false;
        state.teamTasks = action.payload;
      })
      .addCase(fetchTeamTasks.rejected, (state, action) => {
        state.tasksLoading = false;
        state.error = action.payload as string;
      })

      // Fetch assignable members
      .addCase(fetchAssignableMembers.fulfilled, (state, action: PayloadAction<AssignableMember[]>) => {
        state.assignableMembers = action.payload;
      })

      // Assign task
      .addCase(assignTask.pending, (state) => {
        state.assignLoading = true;
      })
      .addCase(assignTask.fulfilled, (state, action: PayloadAction<TeamTask>) => {
        state.assignLoading = false;
        // Update the task in teamTasks array
        const index = state.teamTasks.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.teamTasks[index] = action.payload;
        }
      })
      .addCase(assignTask.rejected, (state, action) => {
        state.assignLoading = false;
        state.error = action.payload as string;
      })

      // Unassign task
      .addCase(unassignTask.pending, (state) => {
        state.assignLoading = true;
      })
      .addCase(unassignTask.fulfilled, (state, action: PayloadAction<TeamTask>) => {
        state.assignLoading = false;
        // Update the task in teamTasks array
        const index = state.teamTasks.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.teamTasks[index] = action.payload;
        }
      })
      .addCase(unassignTask.rejected, (state, action) => {
        state.assignLoading = false;
        state.error = action.payload as string;
      })

      // Fetch my assigned tasks
      .addCase(fetchMyAssignedTasks.pending, (state) => {
        state.tasksLoading = true;
        state.error = null;
      })
      .addCase(fetchMyAssignedTasks.fulfilled, (state, action: PayloadAction<TeamTask[]>) => {
        state.tasksLoading = false;
        state.myAssignedTasks = action.payload;
      })
      .addCase(fetchMyAssignedTasks.rejected, (state, action) => {
        state.tasksLoading = false;
        state.error = action.payload as string;
      })

      // Fetch team analytics
      .addCase(fetchTeamAnalytics.pending, (state) => {
        state.analyticsLoading = true;
        state.error = null;
      })
      .addCase(fetchTeamAnalytics.fulfilled, (state, action: PayloadAction<TeamAnalytics>) => {
        state.analyticsLoading = false;
        state.teamAnalytics = action.payload;
      })
      .addCase(fetchTeamAnalytics.rejected, (state, action) => {
        state.analyticsLoading = false;
        state.error = action.payload as string;
      })

      // Fetch team activity
      .addCase(fetchTeamActivity.pending, (state) => {
        state.activityLoading = true;
        state.error = null;
      })
      .addCase(fetchTeamActivity.fulfilled, (state, action: PayloadAction<ActivityFeed>) => {
        state.activityLoading = false;
        state.activityFeed = action.payload;
      })
      .addCase(fetchTeamActivity.rejected, (state, action) => {
        state.activityLoading = false;
        state.error = action.payload as string;
      })

      // Fetch member progress
      .addCase(fetchMemberProgress.pending, (state) => {
        state.memberProgressLoading = true;
        state.error = null;
      })
      .addCase(fetchMemberProgress.fulfilled, (state, action: PayloadAction<MemberProgress>) => {
        state.memberProgressLoading = false;
        state.memberProgress = action.payload;
      })
      .addCase(fetchMemberProgress.rejected, (state, action) => {
        state.memberProgressLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearCurrentTeam, clearTeamPreview, clearTeamAnalytics, clearActivityFeed, clearMemberProgress } = teamsSlice.actions;

// ============ Selectors ============

export const selectTeams = (state: { teams: TeamsState }) => state.teams.teams;
export const selectCurrentTeam = (state: { teams: TeamsState }) => state.teams.currentTeam;
export const selectTeamPreview = (state: { teams: TeamsState }) => state.teams.teamPreview;
export const selectTeamTasks = (state: { teams: TeamsState }) => state.teams.teamTasks;
export const selectAssignableMembers = (state: { teams: TeamsState }) => state.teams.assignableMembers;
export const selectMyAssignedTasks = (state: { teams: TeamsState }) => state.teams.myAssignedTasks;
export const selectTeamAnalytics = (state: { teams: TeamsState }) => state.teams.teamAnalytics;
export const selectActivityFeed = (state: { teams: TeamsState }) => state.teams.activityFeed;
export const selectMemberProgress = (state: { teams: TeamsState }) => state.teams.memberProgress;
export const selectTeamsLoading = (state: { teams: TeamsState }) => state.teams.loading;
export const selectTeamsError = (state: { teams: TeamsState }) => state.teams.error;
export const selectCreateLoading = (state: { teams: TeamsState }) => state.teams.createLoading;
export const selectJoinLoading = (state: { teams: TeamsState }) => state.teams.joinLoading;
export const selectTasksLoading = (state: { teams: TeamsState }) => state.teams.tasksLoading;
export const selectAssignLoading = (state: { teams: TeamsState }) => state.teams.assignLoading;
export const selectAnalyticsLoading = (state: { teams: TeamsState }) => state.teams.analyticsLoading;
export const selectActivityLoading = (state: { teams: TeamsState }) => state.teams.activityLoading;
export const selectMemberProgressLoading = (state: { teams: TeamsState }) => state.teams.memberProgressLoading;

export default teamsSlice.reducer;
