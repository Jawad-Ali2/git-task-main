'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchTeamActivity,
  selectActivityFeed,
  selectActivityLoading,
  ActivityType,
  Activity,
} from '@/redux/teamsSlice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity as ActivityIcon,
  UserPlus,
  UserMinus,
  GitBranch,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Users,
  FolderGit2,
  RefreshCcw,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedProps {
  teamId: string;
  compact?: boolean;
  maxItems?: number;
}

const activityConfig: Record<
  ActivityType,
  { icon: React.ElementType; color: string; label: string }
> = {
  [ActivityType.TASK_CREATED]: { icon: AlertCircle, color: 'text-blue-500', label: 'created a task' },
  [ActivityType.TASK_ASSIGNED]: { icon: UserPlus, color: 'text-green-500', label: 'assigned a task' },
  [ActivityType.TASK_UNASSIGNED]: { icon: UserMinus, color: 'text-orange-500', label: 'unassigned a task' },
  [ActivityType.TASK_COMPLETED]: { icon: CheckCircle2, color: 'text-green-500', label: 'completed a task' },
  [ActivityType.TASK_STATUS_CHANGED]: { icon: ArrowRight, color: 'text-blue-500', label: 'changed task status' },
  [ActivityType.TASK_PRIORITY_CHANGED]: { icon: AlertCircle, color: 'text-yellow-500', label: 'changed task priority' },
  [ActivityType.MEMBER_JOINED]: { icon: UserPlus, color: 'text-green-500', label: 'joined the team' },
  [ActivityType.MEMBER_LEFT]: { icon: UserMinus, color: 'text-red-500', label: 'left the team' },
  [ActivityType.MEMBER_REMOVED]: { icon: UserMinus, color: 'text-red-500', label: 'was removed from the team' },
  [ActivityType.MEMBER_ROLE_CHANGED]: { icon: Users, color: 'text-purple-500', label: 'role was changed' },
  [ActivityType.REPO_SHARED]: { icon: FolderGit2, color: 'text-blue-500', label: 'shared a repository' },
  [ActivityType.REPO_UNSHARED]: { icon: FolderGit2, color: 'text-orange-500', label: 'unshared a repository' },
  [ActivityType.REPO_SCANNED]: { icon: RefreshCcw, color: 'text-cyan-500', label: 'scanned a repository' },
  [ActivityType.TEAM_CREATED]: { icon: Users, color: 'text-green-500', label: 'created the team' },
  [ActivityType.TEAM_UPDATED]: { icon: Users, color: 'text-blue-500', label: 'updated team settings' },
};

function getActivityDescription(activity: Activity): string {
  const { type, metadata, user } = activity;
  const userName = user?.name || 'Someone';

  switch (type) {
    case ActivityType.TASK_ASSIGNED:
      return `${userName} assigned "${metadata?.taskDescription?.slice(0, 50) || 'a task'}${(metadata?.taskDescription?.length || 0) > 50 ? '...' : ''}" to ${metadata?.assigneeName || 'a member'}`;
    
    case ActivityType.TASK_UNASSIGNED:
      return `${userName} unassigned "${metadata?.taskDescription?.slice(0, 50) || 'a task'}${(metadata?.taskDescription?.length || 0) > 50 ? '...' : ''}"`;
    
    case ActivityType.TASK_COMPLETED:
      return `${userName} completed "${metadata?.taskDescription?.slice(0, 50) || 'a task'}${(metadata?.taskDescription?.length || 0) > 50 ? '...' : ''}"`;
    
    case ActivityType.TASK_STATUS_CHANGED:
      return `${userName} changed status from ${metadata?.oldStatus} to ${metadata?.newStatus}`;
    
    case ActivityType.TASK_PRIORITY_CHANGED:
      return `${userName} changed priority from ${metadata?.oldPriority} to ${metadata?.newPriority}`;
    
    case ActivityType.MEMBER_JOINED:
      return `${metadata?.memberName || userName} joined the team as ${metadata?.newRole || 'developer'}`;
    
    case ActivityType.MEMBER_LEFT:
      return `${metadata?.memberName || userName} left the team`;
    
    case ActivityType.MEMBER_REMOVED:
      return `${userName} removed ${metadata?.memberName || 'a member'} from the team`;
    
    case ActivityType.MEMBER_ROLE_CHANGED:
      return `${userName} changed ${metadata?.memberName || 'a member'}'s role from ${metadata?.oldRole} to ${metadata?.newRole}`;
    
    case ActivityType.REPO_SHARED:
      return `${userName} shared repository "${metadata?.repositoryName || 'a repository'}"`;
    
    case ActivityType.REPO_UNSHARED:
      return `${userName} unshared repository "${metadata?.repositoryName || 'a repository'}"`;
    
    case ActivityType.REPO_SCANNED:
      return `${userName} scanned "${metadata?.repositoryName}" and found ${metadata?.tasksFound || 0} tasks`;
    
    case ActivityType.TEAM_CREATED:
      return `${userName} created the team`;
    
    case ActivityType.TEAM_UPDATED:
      return `${userName} updated team settings`;
    
    default:
      return `${userName} performed an action`;
  }
}

function ActivityItem({ activity }: { activity: Activity }) {
  const config = activityConfig[activity.type] || {
    icon: ActivityIcon,
    color: 'text-gray-500',
    label: 'performed an action',
  };
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={activity.user?.avatarUrl} />
        <AvatarFallback className="text-xs">
          {(activity.user?.name || 'U').slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm text-foreground leading-snug">
          {getActivityDescription(activity)}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-3 w-3 ${config.color}`} />
          <span>{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
          {activity.metadata?.repositoryName && (
            <>
              <span>•</span>
              <span className="truncate">{activity.metadata.repositoryName}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-3 py-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

export function ActivityFeed({ teamId, compact = false, maxItems = 10 }: ActivityFeedProps) {
  const dispatch = useAppDispatch();
  const activityFeed = useAppSelector(selectActivityFeed);
  const loading = useAppSelector(selectActivityLoading);

  useEffect(() => {
    dispatch(fetchTeamActivity({ teamId, limit: maxItems }));
  }, [dispatch, teamId, maxItems]);

  const handleRefresh = () => {
    dispatch(fetchTeamActivity({ teamId, limit: maxItems }));
  };

  if (loading && !activityFeed) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ActivityIcon className="h-4 w-4" />
            Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {[...Array(3)].map((_, i) => (
              <ActivitySkeleton key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activities = activityFeed?.activities || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon className="h-4 w-4" />
              Activity Feed
            </CardTitle>
            {!compact && (
              <CardDescription>
                Recent activity in your team
              </CardDescription>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ActivityIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No activity yet</p>
            <p className="text-xs mt-1">Activity will appear here as your team works</p>
          </div>
        ) : (
          <div className="divide-y">
            {activities.slice(0, maxItems).map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
        {activityFeed?.hasMore && !compact && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm">
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActivityFeed;
