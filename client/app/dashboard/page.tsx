'use client';

import { useEffect, Suspense, lazy } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchDashboardStats, selectDashboardStats, selectDashboardLoading } from '@/redux/dashboardSlice';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { FolderGit2, Loader2, ListTodo } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DashboardStatsSection } from '@/components/dashboard/home/stats-section';
import { DashboardBreakdownSection } from '@/components/dashboard/home/breakdown-section';
import { DashboardQuickActions } from '@/components/dashboard/home/quick-actions';
import { EmptyState, PageHeader } from '@/components/common';
import { DashboardSectionSkeleton } from '@/components/common/page-loading';

// Lazy load heavy components that fetch their own data
const TasksByRepositoryChart = lazy(() => 
  import('@/components/dashboard/home').then(mod => ({ default: mod.TasksByRepositoryChart }))
);
const RecentActivityCard = lazy(() => 
  import('@/components/dashboard/home').then(mod => ({ default: mod.RecentActivityCard }))
);

// Loading component for lazy-loaded sections
function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
      </CardHeader>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const stats = useAppSelector(selectDashboardStats);
  const loading = useAppSelector(selectDashboardLoading);

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  if (loading && !stats) {
    return <DashboardSectionSkeleton cards={4} rows={5} />;
  }

  if (!stats) {
    return (
      <EmptyState
        icon={FolderGit2}
        title="No data available"
        description="Add repositories to start tracking tasks"
        action={{
          label: 'Add Repositories',
          onClick: () => {},
          icon: FolderGit2,
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Dashboard"
        description="Overview of your tasks and repositories"
      >
        <Link href="/dashboard/tasks">
          <Button>
            <ListTodo className="h-4 w-4 mr-2" />
            View All Tasks
          </Button>
        </Link>
      </PageHeader>

      {/* Stats Cards - Status */}
      <DashboardStatsSection stats={stats} />

      {/* Priority & Type Breakdown */}
      <DashboardBreakdownSection stats={stats} />

      {/* Tasks by Repository Chart - Lazy Loaded */}
      <Suspense fallback={<ChartSkeleton />}>
        <TasksByRepositoryChart />
      </Suspense>

      {/* Recent Activity - Lazy Loaded */}
      <Suspense fallback={<ChartSkeleton />}>
        <RecentActivityCard />
      </Suspense>

      {/* Quick Actions */}
      <DashboardQuickActions />
    </div>
  );
}

