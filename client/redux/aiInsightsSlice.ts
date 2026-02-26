import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '@/lib/axios';

// ── Types mirroring the API response ──

export interface DebtTrendPoint {
  date: string;
  openTasks: number;
  closedTasks: number;
  avgDebtScore: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  avgDebtScore: number;
  percentage: number;
}

export interface HighRiskTask {
  id: string;
  description: string;
  type: string;
  filePath: string;
  lineNumber: number;
  debtScore: number;
  ageInDays: number;
  addedBy: string | null;
  repositoryName: string;
  riskReason: string;
}

export interface ProjectHealthSummary {
  score: number;
  label: string;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  avgDebtScore: number;
  topContributors: { username: string; tasksAdded: number; tasksResolved: number }[];
}

export interface SprintProgress {
  recentlyAdded: number;
  recentlyResolved: number;
  netChange: number;
  velocity: number;
}

export interface Recommendation {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affectedFiles: string[];
  taskIds: string[];
}

export interface AiInsights {
  generatedAt: string;
  debtTrend: DebtTrendPoint[];
  categories: CategoryBreakdown[];
  highRiskTasks: HighRiskTask[];
  projectHealth: ProjectHealthSummary;
  sprintProgress: SprintProgress;
  recommendations: Recommendation[];
  aiNarrativeSummary: string | null;
}

export interface AiInsightsState {
  cache: Record<string, AiInsights>; // key: repositoryId or '__all__'
  activeKey: string;
  loading: boolean;
  error: string | null;
}

const ALL_KEY = '__all__';

const initialState: AiInsightsState = {
  cache: {},
  activeKey: ALL_KEY,
  loading: false,
  error: null,
};

// ── Thunk ──

export const fetchAiInsights = createAsyncThunk(
  'aiInsights/fetch',
  async (
    { repositoryId, force = false }: { repositoryId?: string; force?: boolean },
    { getState, rejectWithValue },
  ) => {
    const key = repositoryId ?? ALL_KEY;
    const state = (getState() as { aiInsights: AiInsightsState }).aiInsights;

    // Return cached data unless forced
    if (!force && state.cache[key]) {
      return { key, data: state.cache[key], cached: true };
    }

    try {
      const params = repositoryId ? { repositoryId } : {};
      const response = await axiosInstance.get('/tasks/insights', { params });
      return { key, data: response.data as AiInsights, cached: false };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || err.message || 'Failed to fetch AI insights');
    }
  },
);

// ── Slice ──

const aiInsightsSlice = createSlice({
  name: 'aiInsights',
  initialState,
  reducers: {
    clearInsights(state) {
      state.cache = {};
      state.error = null;
    },
    setActiveKey(state, action: PayloadAction<string>) {
      state.activeKey = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAiInsights.pending, (state, action) => {
        const key = action.meta.arg.repositoryId ?? ALL_KEY;
        state.activeKey = key;
        // Only show loading if there's no cached data for this key
        if (!state.cache[key]) {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchAiInsights.fulfilled, (state, action) => {
        const { key, data } = action.payload;
        state.loading = false;
        state.cache[key] = data;
        state.activeKey = key;
      })
      .addCase(fetchAiInsights.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearInsights, setActiveKey } = aiInsightsSlice.actions;

export const selectAiInsights = (state: { aiInsights: AiInsightsState }) =>
  state.aiInsights.cache[state.aiInsights.activeKey] ?? null;
export const selectAiInsightsLoading = (state: { aiInsights: AiInsightsState }) => state.aiInsights.loading;
export const selectAiInsightsError = (state: { aiInsights: AiInsightsState }) => state.aiInsights.error;

export default aiInsightsSlice.reducer;
