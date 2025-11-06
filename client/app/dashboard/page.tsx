'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchDashboardStats, selectDashboardStats, selectDashboardLoading } from '@/redux/dashboardSlice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, AlertCircle, ListTodo, FolderGit2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TasksByRepositoryChart } from '@/components/tasks-by-repository-chart';
import { RecentActivityCard } from '@/components/recent-activity-card';
import { StatsCard } from '@/components/stats-card';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const stats = useAppSelector(selectDashboardStats);
  const loading = useAppSelector(selectDashboardLoading);

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  if (loading && !stats) {
    return <EmptyState loading={true} loadingText="Loading dashboard..." title="" />;
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

  const completionRate = stats.total > 0 
    ? ((stats.byStatus.completed / stats.total) * 100).toFixed(1)
    : '0';

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
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Tasks"
          value={stats.total}
          description="Across all repositories"
          icon={ListTodo}
        />
        <StatsCard
          title="Pending"
          value={stats.byStatus.pending}
          description={`${stats.total > 0 ? ((stats.byStatus.pending / stats.total) * 100).toFixed(0) : 0}% of total`}
          icon={Clock}
          iconColor="text-yellow-500"
        />
        <StatsCard
          title="In Progress"
          value={stats.byStatus['in-progress']}
          description={`${stats.total > 0 ? ((stats.byStatus['in-progress'] / stats.total) * 100).toFixed(0) : 0}% of total`}
          icon={TrendingUp}
          iconColor="text-blue-500"
        />
        <StatsCard
          title="Completed"
          value={stats.byStatus.completed}
          description={`${completionRate}% completion rate`}
          icon={CheckCircle2}
          iconColor="text-green-500"
        />
      </div>

      {/* Priority & Type Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Priority</CardTitle>
            <CardDescription>Distribution of task priorities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="destructive">High</Badge>
                <span className="text-sm text-muted-foreground">Critical tasks</span>
              </div>
              <span className="text-2xl font-bold">{stats.byPriority.high}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">Medium</Badge>
                <span className="text-sm text-muted-foreground">Standard tasks</span>
              </div>
              <span className="text-2xl font-bold">{stats.byPriority.medium}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Low</Badge>
                <span className="text-sm text-muted-foreground">Minor tasks</span>
              </div>
              <span className="text-2xl font-bold">{stats.byPriority.low}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks by Type</CardTitle>
            <CardDescription>Different types of code comments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(stats.byType).map(([type, count]) => {
              const colors: Record<string, string> = {
                TODO: 'bg-blue-500/10 text-blue-500',
                FIXME: 'bg-red-500/10 text-red-500',
                HACK: 'bg-yellow-500/10 text-yellow-500',
                NOTE: 'bg-green-500/10 text-green-500',
                BUG: 'bg-red-600/10 text-red-600',
              };
              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={colors[type] || 'bg-gray-500/10 text-gray-500'}>{type}</Badge>
                    <span className="text-sm text-muted-foreground capitalize">{type.toLowerCase()} comments</span>
                  </div>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Tasks by Repository Chart */}
      <TasksByRepositoryChart />

      {/* Recent Activity */}
      <RecentActivityCard />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your tasks and repositories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/tasks?status=pending">
              <Button variant="outline">
                <Clock className="h-4 w-4 mr-2" />
                View Pending Tasks
              </Button>
            </Link>
            <Link href="/tasks?priority=high">
              <Button variant="outline">
                <AlertCircle className="h-4 w-4 mr-2" />
                High Priority Tasks
              </Button>
            </Link>
            <Link href="/dashboard/repositories">
              <Button variant="outline">
                <FolderGit2 className="h-4 w-4 mr-2" />
                Manage Repositories
              </Button>
            </Link>
            <Link href="/dashboard/repositories/add">
              <Button variant="outline">
                Add New Repository
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

