'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchMemberProgress,
  fetchTeamById,
  selectMemberProgress,
  selectMemberProgressLoading,
  selectCurrentTeam,
  selectTeamsError,
  clearMemberProgress,
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
  User,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Target,
  TrendingUp,
  Calendar,
  Crown,
  Shield,
  Code,
  Mail,
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
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const TYPE_COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#84cc16'];

const roleConfig: Record<TeamRole, { label: string; icon: React.ElementType; color: string }> = {
  pm: { label: 'Project Manager', icon: Crown, color: 'text-yellow-500 bg-yellow-500/10' },
  tl: { label: 'Team Lead', icon: Shield, color: 'text-blue-500 bg-blue-500/10' },
  developer: { label: 'Developer', icon: Code, color: 'text-green-500 bg-green-500/10' },
};

export default function MemberProgressPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const memberId = params.memberId as string;
  const router = useRouter();
  const dispatch = useAppDispatch();

  const progress = useAppSelector(selectMemberProgress);
  const loading = useAppSelector(selectMemberProgressLoading);
  const team = useAppSelector(selectCurrentTeam);
  const error = useAppSelector(selectTeamsError);
  const currentUser = useAppSelector(selectCurrentUser);

  useEffect(() => {
    if (teamId && memberId) {
      dispatch(fetchTeamById(teamId));
      dispatch(fetchMemberProgress({ teamId, memberId }));
    }
    return () => {
      dispatch(clearMemberProgress());
    };
  }, [dispatch, teamId, memberId]);

  if (loading && !progress) {
    return <DashboardSectionSkeleton cards={2} rows={6} />;
  }

  if (error || !progress) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/teams/${teamId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader title="Member Not Found" />
        </div>
        <EmptyState
          icon={User}
          title="Member not found"
          description={error || "The team member you're looking for doesn't exist."}
          action={{
            label: 'Back to Team',
            onClick: () => router.push(`/dashboard/teams/${teamId}`),
          }}
        />
      </div>
    );
  }

  const { member, stats, byPriority, byType, recentTasks, activitySummary } = progress;
  const RoleIcon = roleConfig[member.role]?.icon || Code;
  const roleStyle = roleConfig[member.role] || roleConfig.developer;

  // Prepare chart data
  const priorityData = [
    { name: 'High', value: byPriority.high, fill: PRIORITY_COLORS.high },
    { name: 'Medium', value: byPriority.medium, fill: PRIORITY_COLORS.medium },
    { name: 'Low', value: byPriority.low, fill: PRIORITY_COLORS.low },
  ].filter(d => d.value > 0);

  const typeData = Object.entries(byType).map(([name, value], index) => ({
    name: name.toUpperCase(),
    value,
    fill: TYPE_COLORS[index % TYPE_COLORS.length],
  }));

  const statusData = [
    { name: 'Completed', value: stats.completed, fill: '#22c55e' },
    { name: 'In Progress', value: stats.inProgress, fill: '#3b82f6' },
    { name: 'Pending', value: stats.pending, fill: '#f59e0b' },
  ];

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
          title="Member Progress"
          description={`Performance overview for ${member.name}`}
        />
      </div>

      {/* Member Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={member.avatarUrl} />
              <AvatarFallback className="text-2xl">
                {member.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">{member.name}</h2>
                <Badge variant="outline" className={`flex items-center gap-1 ${roleStyle.color}`}>
                  <RoleIcon className="h-3 w-3" />
                  {roleStyle.label}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {member.email}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssigned}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <Progress value={stats.completionRate} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Weekly Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">This Week's Activity</CardTitle>
          <CardDescription>Summary of work done in the past 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{activitySummary.tasksCompletedThisWeek}</p>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <Target className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-blue-600">{activitySummary.tasksAssignedThisWeek}</p>
                <p className="text-sm text-muted-foreground">New Tasks Assigned</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by Status</CardTitle>
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
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {priorityData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No tasks assigned
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tasks by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {typeData.length > 0 ? (
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
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No tasks assigned
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Tasks</CardTitle>
          <CardDescription>Latest tasks assigned to this member</CardDescription>
        </CardHeader>
        <CardContent>
          {recentTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No tasks assigned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {task.type}
                      </Badge>
                      <Badge
                        variant={
                          task.status === 'done'
                            ? 'default'
                            : task.status === 'in-progress'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-xs"
                      >
                        {task.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          task.priority === 'high'
                            ? 'border-red-500 text-red-500'
                            : task.priority === 'medium'
                            ? 'border-yellow-500 text-yellow-500'
                            : 'border-green-500 text-green-500'
                        }`}
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{task.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {task.repository?.name}
                      {task.assignedAt && (
                        <> • Assigned {formatDistanceToNow(new Date(task.assignedAt), { addSuffix: true })}</>
                      )}
                    </p>
                  </div>
                  {task.dueDate && (
                    <div className="text-right ml-4">
                      <p className="text-xs text-muted-foreground">Due</p>
                      <p className={`text-sm font-medium ${
                        new Date(task.dueDate) < new Date() && task.status !== 'done'
                          ? 'text-red-500'
                          : ''
                      }`}>
                        {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
