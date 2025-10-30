'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchDashboardStats, selectDashboardStats, selectDashboardLoading } from '@/redux/dashboardSlice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, Clock, AlertCircle, ListTodo, FolderGit2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const stats = useAppSelector(selectDashboardStats);
  const loading = useAppSelector(selectDashboardLoading);

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">No data available</p>
        <Link href="/dashboard/repositories/add">
          <Button>
            <FolderGit2 className="h-4 w-4 mr-2" />
            Add Repositories
          </Button>
        </Link>
      </div>
    );
  }

  const completionRate = stats.total > 0 
    ? ((stats.byStatus.completed / stats.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your tasks and repositories
          </p>
        </div>
        <Link href="/tasks">
          <Button>
            <ListTodo className="h-4 w-4 mr-2" />
            View All Tasks
          </Button>
        </Link>
      </div>

      {/* Stats Cards - Status */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Across all repositories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byStatus.pending}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? ((stats.byStatus.pending / stats.total) * 100).toFixed(0) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byStatus['in-progress']}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? ((stats.byStatus['in-progress'] / stats.total) * 100).toFixed(0) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byStatus.completed}</div>
            <p className="text-xs text-muted-foreground">
              {completionRate}% completion rate
            </p>
          </CardContent>
        </Card>
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

