import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import scanNotificationReducer from './scanNotificationSlice';
import dashboardReducer from './dashboardSlice';
import tasksReducer from './tasksSlice';
import repositoriesReducer from './repositoriesSlice';
import integrationsReducer from './integrationsSlice';
import teamsReducer from './teamsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    scanNotification: scanNotificationReducer,
    dashboard: dashboardReducer,
    tasks: tasksReducer,
    repositories: repositoriesReducer,
    integrations: integrationsReducer,
    teams: teamsReducer,
  },
});

// TypeScript types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
