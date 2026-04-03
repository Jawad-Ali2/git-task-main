'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchTeamAnalytics,
  fetchTeamById,
  selectTeamAnalytics,
  selectAnalyticsLoading,
  selectCurrentTeam,
  selectTeamsError,
  clearTeamAnalytics,
  TeamRole,
} from '@/redux/teamsSlice';
import { selectCurrentUser } from '@/redux/authSlice';
import { EmptyState, PageHeader } from '@/components/common';
import { DashboardSectionSkeleton } from '@/components/common/page-loading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  BarChart3,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Target,
  TrendingUp,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const STATUS_COLORS = {
  open: '#f59e0b',
  'in-progress': '#3b82f6',
  done: '#22c55e',
};

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const TYPE_COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#84cc16'];

export default function TeamAnalyticsPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const router = useRouter();
  const dispatch = useAppDispatch();

  const analytics = useAppSelector(selectTeamAnalytics);
  const loading = useAppSelector(selectAnalyticsLoading);
  const team = useAppSelector(selectCurrentTeam);
  const error = useAppSelector(selectTeamsError);
  const user = useAppSelector(selectCurrentUser);

  useEffect(() => {
    if (teamId) {
      dispatch(fetchTeamById(teamId));
      dispatch(fetchTeamAnalytics(teamId));
    }
    return () => {
      dispatch(clearTeamAnalytics());
    };
  }, [dispatch, teamId]);

  const currentMember = team?.members?.find((m) => m.userId === user?.userId);
  const currentRole = currentMember?.role || 'developer';
  const canViewAnalytics = ['pm', 'tl'].includes(currentRole);

  if (loading && !analytics) {
    return <DashboardSectionSkeleton cards={3} rows={6} />;
  }

  if (!canViewAnalytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/teams/${teamId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader title="Access Denied" />
        </div>
        <EmptyState
          icon={AlertCircle}
          title="Access Denied"
          description="Only Project Managers and Team Leads can view team analytics."
          action={{
            label: 'Back to Team',
            onClick: () => router.push(`/dashboard/teams/${teamId}`),
          }}
        />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/teams/${teamId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader title="Analytics Error" />
        </div>
        <EmptyState
          icon={BarChart3}
          title="Failed to load analytics"
          description={error || 'An error occurred while loading analytics.'}
          action={{
            label: 'Try Again',
            onClick: () => dispatch(fetchTeamAnalytics(teamId)),
          }}
        />
      </div>
    );
  }

  const { 
    overview = {
      totalTasks: 0,
      assignedTasks: 0,
      unassignedTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      completionRate: 0,
    }, 
    byStatus = { open: 0, 'in-progress': 0, done: 0 }, 
    byPriority = { high: 0, medium: 0, low: 0 }, 
    byType = {}, 
    memberWorkloads = [], 
    recentlyAssigned = [], 
    upcomingDeadlines = [], 
    highPriorityUnassigned = [] 
  } = analytics;

  // Prepare chart data
  const statusData = [
    { name: 'Open', value: byStatus.open, fill: STATUS_COLORS.open },
    { name: 'In Progress', value: byStatus['in-progress'], fill: STATUS_COLORS['in-progress'] },
    { name: 'Done', value: byStatus.done, fill: STATUS_COLORS.done },
  ];

  const priorityData = [
    { name: 'High', value: byPriority.high, fill: PRIORITY_COLORS.high },
    { name: 'Medium', value: byPriority.medium, fill: PRIORITY_COLORS.medium },
    { name: 'Low', value: byPriority.low, fill: PRIORITY_COLORS.low },
  ];

  const typeData = Object.entries(byType).map(([name, value], index) => ({
    name: name.toUpperCase(),
    value,
    fill: TYPE_COLORS[index % TYPE_COLORS.length],
  }));

  const workloadData = memberWorkloads.map((member) => ({
    name: (member.userName || 'Unknown').split(' ')[0],
    completed: member.completed || 0,
    inProgress: member.inProgress || 0,
    pending: member.pending || 0,
    overdue: member.overdue || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/teams/${teamId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={`${team?.name || 'Team'} Analytics`}
          description="Overview of team performance and task distribution"
        >
          <Badge variant="outline" className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            PM Dashboard
          </Badge>
        </PageHeader>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {overview.assignedTasks} assigned, {overview.unassignedTasks} unassigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.completedTasks}</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={overview.completionRate || 0} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{(overview.completionRate || 0).toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.inProgressTasks || 0}</div>
            <p className="text-xs text-muted-foreground">
              {overview.pendingTasks || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{overview.overdueTasks}</div>
            <p className="text-xs text-muted-foreground">
              Tasks past due date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by Status</CardTitle>
            <CardDescription>Current status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                    labelLine={false}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by Priority</CardTitle>
            <CardDescription>Priority breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                    labelLine={false}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by Type</CardTitle>
            <CardDescription>TODO, FIXME, BUG, etc.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={60} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member Workloads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Member Workloads
          </CardTitle>
          <CardDescription>Task distribution across team members</CardDescription>
        </CardHeader>
        <CardContent>
          {memberWorkloads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No assigned tasks yet</p>
            </div>
          ) : (
            <>
              <div className="h-[250px] mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" name="Completed" fill="#22c55e" stackId="a" />
                    <Bar dataKey="inProgress" name="In Progress" fill="#3b82f6" stackId="a" />
                    <Bar dataKey="pending" name="Pending" fill="#f59e0b" stackId="a" />
                    <Bar dataKey="overdue" name="Overdue" fill="#ef4444" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {memberWorkloads.map((member) => (
                  <div key={member.userId} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback>{(member.userName || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{member.userName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-medium">{member.totalAssigned}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-green-500">{member.completed}</p>
                        <p className="text-xs text-muted-foreground">Done</p>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-blue-500">{member.inProgress}</p>
                        <p className="text-xs text-muted-foreground">Active</p>
                      </div>
                      {member.overdue > 0 && (
                        <div className="text-center">
                          <p className="font-medium text-red-500">{member.overdue}</p>
                          <p className="text-xs text-muted-foreground">Overdue</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bottom Row: Deadlines and Alerts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Upcoming Deadlines
            </CardTitle>
            <CardDescription>Tasks due in the next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines</p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.assignedTo?.name || 'Unassigned'} • {task.repository.name}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2 shrink-0">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* High Priority Unassigned */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-red-500" />
              High Priority Unassigned
            </CardTitle>
            <CardDescription>Critical tasks needing assignment</CardDescription>
          </CardHeader>
          <CardContent>
            {highPriorityUnassigned.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">All high priority tasks are assigned ✓</p>
            ) : (
              <div className="space-y-2">
                {highPriorityUnassigned.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-900">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.type.toUpperCase()} • {task.repository.name}
                      </p>
                    </div>
                    <Link href={`/dashboard/teams/${teamId}/tasks?priority=high`}>
                      <Button variant="outline" size="sm">
                        Assign
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
