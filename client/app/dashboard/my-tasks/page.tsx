'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchMyAssignedTasks,
  selectMyAssignedTasks,
  selectTasksLoading,
  TeamTask,
} from '@/redux/teamsSlice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Loader2,
  Search,
  FileCode,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';

export default function MyTasksPage() {
  const dispatch = useAppDispatch();
  const tasks = useAppSelector(selectMyAssignedTasks);
  const loading = useAppSelector(selectTasksLoading);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    dispatch(fetchMyAssignedTasks());
  }, [dispatch]);

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.filePath.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.repository.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Group tasks by due date
  const overdueTasks = filteredTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
  );
  const todayTasks = filteredTasks.filter((t) => {
    if (!t.dueDate) return false;
    const dueDate = new Date(t.dueDate);
    const today = new Date();
    return (
      dueDate.toDateString() === today.toDateString() && t.status !== 'done'
    );
  });
  const upcomingTasks = filteredTasks.filter((t) => {
    if (!t.dueDate) return false;
    const dueDate = new Date(t.dueDate);
    const today = new Date();
    return dueDate > today && t.status !== 'done';
  });
  const noDueDateTasks = filteredTasks.filter(
    (t) => !t.dueDate && t.status !== 'done'
  );
  const completedTasks = filteredTasks.filter((t) => t.status === 'done');

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'BUG':
        return 'bg-red-500';
      case 'FIXME':
        return 'bg-orange-500';
      case 'HACK':
        return 'bg-purple-500';
      case 'TODO':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const TaskCard = ({ task }: { task: TeamTask }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(task.status)}
              <Badge className={getTypeColor(task.type)}>{task.type}</Badge>
              <Badge variant="outline" className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
            </div>

            <p className="font-medium mb-1 line-clamp-2">{task.description}</p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <Link 
                href={`/dashboard/repositories`}
                className="hover:text-primary flex items-center gap-1"
              >
                {task.repository.name}
              </Link>
              <span className="flex items-center gap-1">
                <FileCode className="h-3 w-3" />
                {task.filePath}:{task.lineNumber}
              </span>
              {task.dueDate && (
                <span className={`flex items-center gap-1 ${
                  new Date(task.dueDate) < new Date() ? 'text-red-500' : ''
                }`}>
                  <Calendar className="h-3 w-3" />
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>

            {task.assignedBy && (
              <p className="text-xs text-muted-foreground mt-2">
                Assigned by {task.assignedBy.name} on{' '}
                {task.assignedAt && new Date(task.assignedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(task.repository.url, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const TaskSection = ({
    title,
    tasks,
    icon,
    emptyMessage,
    className,
  }: {
    title: string;
    tasks: TeamTask[];
    icon: React.ReactNode;
    emptyMessage: string;
    className?: string;
  }) => (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      {tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">My Tasks</h2>
        <p className="text-muted-foreground">
          Tasks assigned to you across all teams
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{overdueTasks.length}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{todayTasks.length}</p>
                <p className="text-sm text-muted-foreground">Due Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {tasks.filter((t) => t.status !== 'done').length}
                </p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{completedTasks.length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tasks assigned</h3>
            <p className="text-muted-foreground text-center max-w-md">
              You don't have any tasks assigned to you yet. Join a team and get tasks assigned to start working!
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/teams">View Teams</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {overdueTasks.length > 0 && (
            <TaskSection
              title="Overdue"
              tasks={overdueTasks}
              icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
              emptyMessage="No overdue tasks"
              className="border-l-4 border-red-500 pl-4"
            />
          )}

          {todayTasks.length > 0 && (
            <TaskSection
              title="Due Today"
              tasks={todayTasks}
              icon={<Clock className="h-5 w-5 text-yellow-500" />}
              emptyMessage="No tasks due today"
              className="border-l-4 border-yellow-500 pl-4"
            />
          )}

          {upcomingTasks.length > 0 && (
            <TaskSection
              title="Upcoming"
              tasks={upcomingTasks}
              icon={<Calendar className="h-5 w-5 text-blue-500" />}
              emptyMessage="No upcoming tasks"
            />
          )}

          {noDueDateTasks.length > 0 && (
            <TaskSection
              title="No Due Date"
              tasks={noDueDateTasks}
              icon={<ClipboardList className="h-5 w-5 text-gray-500" />}
              emptyMessage="No tasks without due date"
            />
          )}

          {statusFilter === 'all' && completedTasks.length > 0 && (
            <TaskSection
              title="Completed"
              tasks={completedTasks}
              icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
              emptyMessage="No completed tasks"
              className="opacity-75"
            />
          )}
        </div>
      )}
    </div>
  );
}
