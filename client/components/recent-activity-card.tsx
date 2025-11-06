'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, PlayCircle, GitBranch, FileText, Code, Clock, User } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'task_created' | 'task_updated' | 'task_completed' | 'repository_scanned' | 'status_changed';
  title: string;
  description: string;
  timestamp: Date;
  taskId?: string;
  repositoryId?: string;
  repositoryName?: string;
  taskType?: string;
  status?: string;
  priority?: string;
  icon?: React.ReactNode;
}

export function RecentActivityCard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivity();
  }, []);

  const fetchRecentActivity = async () => {
    setLoading(true);
    try {
      // Fetch recent tasks to generate activity
      const response = await axiosInstance.get('/tasks');
      const tasks = response.data || [];

      // Generate dummy activity from tasks (sorted by most recent)
      const recentTasks = tasks.slice(0, 10);
      
      const activityItems: ActivityItem[] = recentTasks.map((task: any, index: number) => {
        // Generate varied activity types for demo
        const activityTypes = ['task_created', 'task_updated', 'status_changed', 'task_completed'];
        const randomType = activityTypes[index % activityTypes.length] as ActivityItem['type'];
        
        // Create timestamp going back in time
        const hoursAgo = index * 2 + Math.floor(Math.random() * 3);
        const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

        let title = '';
        let description = '';
        
        switch (randomType) {
          case 'task_created':
            title = 'New task discovered';
            description = `${task.type} in ${task.repository.name}`;
            break;
          case 'task_updated':
            title = 'Task priority updated';
            description = `${task.description.substring(0, 50)}${task.description.length > 50 ? '...' : ''}`;
            break;
          case 'status_changed':
            title = `Task marked as ${task.status.replace('_', ' ')}`;
            description = `in ${task.repository.name}`;
            break;
          case 'task_completed':
            title = 'Task completed';
            description = `${task.type}: ${task.description.substring(0, 40)}${task.description.length > 40 ? '...' : ''}`;
            break;
          case 'repository_scanned':
            title = 'Repository scanned';
            description = `${task.repository.name} - Found new tasks`;
            break;
        }

        return {
          id: `${task.id}-${randomType}`,
          type: randomType,
          title,
          description,
          timestamp,
          taskId: task.id,
          repositoryId: task.repository.id,
          repositoryName: task.repository.name,
          taskType: task.type,
          status: task.status,
          priority: task.priority,
        };
      });

      // Sort by timestamp (most recent first)
      activityItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setActivities(activityItems);
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'task_created':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'task_updated':
        return <Code className="h-4 w-4 text-yellow-500" />;
      case 'task_completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'repository_scanned':
        return <GitBranch className="h-4 w-4 text-purple-500" />;
      case 'status_changed':
        return <PlayCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500';
      case 'in-progress':
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-500';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates and changes</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates and changes</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No recent activity</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates and changes across your repositories</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex gap-4 pb-4 border-b last:border-b-0 last:pb-0"
            >
              {/* Icon */}
              <div className="shrink-0 mt-1">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  {getActivityIcon(activity.type)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none mb-1">
                      {activity.title}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {activity.description}
                    </p>
                  </div>
                  
                  <div className="shrink-0">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {activity.repositoryName && (
                    <Link
                      href={`/dashboard/repositories/${activity.repositoryId}/tasks`}
                      className="text-xs text-primary hover:underline"
                    >
                      {activity.repositoryName}
                    </Link>
                  )}
                  
                  {activity.taskType && (
                    <Badge variant="outline" className="text-xs h-5">
                      {activity.taskType}
                    </Badge>
                  )}
                  
                  {activity.status && (
                    <Badge variant="outline" className={`text-xs h-5 ${getStatusColor(activity.status)}`}>
                      {activity.status.replace('_', ' ')}
                    </Badge>
                  )}
                  
                  {activity.priority && (
                    <Badge variant="outline" className="text-xs h-5">
                      {activity.priority} priority
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All Link */}
        <div className="mt-4 pt-4 border-t">
          <Link
            href="/dashboard/tasks"
            className="text-sm text-primary hover:underline flex items-center justify-center gap-2"
          >
            View all tasks
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
