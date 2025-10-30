import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '@/lib/axios';

export interface Task {
  id: string;
  type: string;
  description: string;
  filePath: string;
  lineNumber: number;
  priority: string;
  status: string;
  repository: {
    id: string;
    name: string;
  };
}

export interface TasksState {
  tasks: Task[];
  loading: boolean;
  error?: string | null;
  updating: Record<string, boolean>;
}

const initialState: TasksState = {
  tasks: [],
  loading: false,
  error: null,
  updating: {},
};

// Thunks
export const fetchTasks = createAsyncThunk(
  'tasks/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/tasks');
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const updateTaskStatus = createAsyncThunk(
  'tasks/updateStatus',
  async ({ taskId, status }: { taskId: string; status: 'pending' | 'in-progress' | 'completed' }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(`/tasks/${taskId}/status`, { status });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

export const updateTaskPriority = createAsyncThunk(
  'tasks/updatePriority',
  async ({ taskId, priority }: { taskId: string; priority: 'low' | 'medium' | 'high' }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(`/tasks/${taskId}/priority`, { priority });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchTasks
      .addCase(fetchTasks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action: PayloadAction<Task[]>) => {
        state.loading = false;
        state.tasks = action.payload;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as any)?.message || 'Failed to fetch tasks';
      })

      // updateTaskStatus
      .addCase(updateTaskStatus.pending, (state, action) => {
        state.updating[action.meta.arg.taskId] = true;
      })
      .addCase(updateTaskStatus.fulfilled, (state, action: PayloadAction<Task>) => {
        const index = state.tasks.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
        delete state.updating[action.payload.id];
      })
      .addCase(updateTaskStatus.rejected, (state, action) => {
        delete state.updating[action.meta.arg.taskId];
        state.error = (action.payload as any)?.message || 'Failed to update task status';
      })

      // updateTaskPriority
      .addCase(updateTaskPriority.pending, (state, action) => {
        state.updating[action.meta.arg.taskId] = true;
      })
      .addCase(updateTaskPriority.fulfilled, (state, action: PayloadAction<Task>) => {
        const index = state.tasks.findIndex(t => t.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
        delete state.updating[action.payload.id];
      })
      .addCase(updateTaskPriority.rejected, (state, action) => {
        delete state.updating[action.meta.arg.taskId];
        state.error = (action.payload as any)?.message || 'Failed to update task priority';
      });
  },
});

export const { clearError } = tasksSlice.actions;

export const selectTasks = (state: { tasks: TasksState }) => state.tasks.tasks;
export const selectTasksLoading = (state: { tasks: TasksState }) => state.tasks.loading;
export const selectTaskUpdating = (taskId: string) => (state: { tasks: TasksState }) => state.tasks.updating[taskId] || false;

export default tasksSlice.reducer;
