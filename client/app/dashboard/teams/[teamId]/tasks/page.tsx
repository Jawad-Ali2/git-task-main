'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchTeamById,
  fetchTeamTasks,
  fetchMyAssignedTasks,
  fetchAssignableMembers,
  assignTask,
  unassignTask,
  selectCurrentTeam,
  selectTeamTasks,
  selectAssignableMembers,
  selectTasksLoading,
  selectAssignLoading,
  TeamTask,
  AssignableMember,
} from '@/redux/teamsSlice';
import { selectCurrentUser } from '@/redux/authSlice';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as AlertDialogContentPrimitive,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DashboardSectionSkeleton } from '@/components/common/page-loading';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Search,
  Filter,
  UserPlus,
  UserMinus,
  FileCode,
  ExternalLink,
  Calendar,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

export default function TeamTasksPage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const teamId = params.teamId as string;
  const team = useAppSelector(selectCurrentTeam);
  const tasks = useAppSelector(selectTeamTasks);
  const assignableMembers = useAppSelector(selectAssignableMembers);
  const loading = useAppSelector(selectTasksLoading);
  const assignLoading = useAppSelector(selectAssignLoading);
  const currentUser = useAppSelector(selectCurrentUser);

  // Get current user's role in the team
  const currentMember = team?.members?.find((m) => m.userId === currentUser?.userId);
  const canAssign = currentMember && ['pm', 'tl'].includes(currentMember.role);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [repoFilter, setRepoFilter] = useState<string>('all');

  // Unassign confirmation state
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [taskToUnassign, setTaskToUnassign] = useState<TeamTask | null>(null);

  // Assignment modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [statusUpdatingTaskId, setStatusUpdatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (teamId) {
      dispatch(fetchTeamById(teamId));
      dispatch(fetchAssignableMembers(teamId));
    }
  }, [dispatch, teamId]);

  useEffect(() => {
    if (teamId) {
      const filters: any = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (priorityFilter !== 'all') filters.priority = priorityFilter;
      if (typeFilter !== 'all') filters.type = typeFilter;
      if (assigneeFilter !== 'all') filters.assignedTo = assigneeFilter;
      if (repoFilter !== 'all') filters.repositoryId = repoFilter;

      dispatch(fetchTeamTasks({ teamId, filters }));
    }
  }, [dispatch, teamId, statusFilter, priorityFilter, typeFilter, assigneeFilter, repoFilter]);

  // Get unique repositories from tasks for filter dropdown
  const uniqueRepos = Array.from(
    new Map(tasks.map((t) => [t.repository.id, t.repository])).values()
  );

  // Filter tasks by search query (client-side)
  const filteredTasks = tasks.filter((task) =>
    task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.filePath.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.repository.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssignClick = (task: TeamTask) => {
    setSelectedTask(task);
    setSelectedMember('');
    setDueDate('');
    setAssignModalOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedTask || !selectedMember) return;

    await dispatch(
      assignTask({
        teamId,
        taskId: selectedTask.id,
        userId: selectedMember,
        dueDate: dueDate || undefined,
      })
    );

    setAssignModalOpen(false);
    setSelectedTask(null);
  };

  const handleUnassign = (task: TeamTask) => {
    setTaskToUnassign(task);
    setUnassignDialogOpen(true);
  };

  const confirmUnassign = async () => {
    if (!taskToUnassign) return;
    await dispatch(unassignTask({ teamId, taskId: taskToUnassign.id }));
    setTaskToUnassign(null);
  };

  const handleStatusUpdate = async (
    task: TeamTask,
    status: 'open' | 'in-progress' | 'done'
  ) => {
    if (task.status === status || statusUpdatingTaskId === task.id) return;

    const statusMap: Record<'open' | 'in-progress' | 'done', 'pending' | 'in-progress' | 'completed'> = {
      open: 'pending',
      'in-progress': 'in-progress',
      done: 'completed',
    };

    try {
      setStatusUpdatingTaskId(task.id);
      await axiosInstance.patch(`/tasks/${task.id}/status`, { status: statusMap[status] });

      const filters: any = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (priorityFilter !== 'all') filters.priority = priorityFilter;
      if (typeFilter !== 'all') filters.type = typeFilter;
      if (assigneeFilter !== 'all') filters.assignedTo = assigneeFilter;
      if (repoFilter !== 'all') filters.repositoryId = repoFilter;

      await Promise.all([
        dispatch(fetchTeamTasks({ teamId, filters })),
        dispatch(fetchMyAssignedTasks()),
      ]);

      toast.success('Task status updated');
    } catch {
      toast.error('Failed to update task status');
    } finally {
      setStatusUpdatingTaskId(null);
    }
  };

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

  if (!team) {
    return <DashboardSectionSkeleton cards={2} rows={6} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/teams/${teamId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{team.name} - Tasks</h2>
          <p className="text-muted-foreground">
            View and manage tasks from shared repositories
          </p>
        </div>
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

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="TODO">TODO</SelectItem>
                <SelectItem value="FIXME">FIXME</SelectItem>
                <SelectItem value="BUG">BUG</SelectItem>
                <SelectItem value="HACK">HACK</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {assignableMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {uniqueRepos.length > 1 && (
              <Select value={repoFilter} onValueChange={setRepoFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Repository" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Repositories</SelectItem>
                  {uniqueRepos.map((repo) => (
                    <SelectItem key={repo.id} value={repo.id}>
                      {repo.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      {loading ? (
        <DashboardSectionSkeleton cards={0} rows={6} />
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileCode className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No tasks found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {tasks.length === 0
                ? 'No tasks have been detected in the shared repositories yet. Run a scan to detect tasks.'
                : 'No tasks match your current filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(task.status)}
                      <Badge className={getTypeColor(task.type)}>{task.type}</Badge>
                      <Badge variant="outline" className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {task.repository.name}
                      </span>
                    </div>

                    <p className="font-medium mb-1 line-clamp-2">{task.description}</p>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileCode className="h-3 w-3" />
                        {task.filePath}:{task.lineNumber}
                      </span>
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Assignee */}
                    {task.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={task.assignedTo.avatarUrl} />
                          <AvatarFallback>
                            {task.assignedTo.name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm hidden sm:inline">
                          {task.assignedTo.name}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Unassigned
                      </Badge>
                    )}

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canAssign && (
                          <>
                            {task.assignedTo ? (
                              <DropdownMenuItem onClick={() => handleUnassign(task)}>
                                <UserMinus className="mr-2 h-4 w-4" />
                                Unassign
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleAssignClick(task)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Assign
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleAssignClick(task)}>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Reassign
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem
                          disabled={statusUpdatingTaskId === task.id || task.status === 'open'}
                          onClick={() => handleStatusUpdate(task, 'open')}
                        >
                          {statusUpdatingTaskId === task.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <AlertCircle className="mr-2 h-4 w-4" />
                          )}
                          Mark as Open
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={statusUpdatingTaskId === task.id || task.status === 'in-progress'}
                          onClick={() => handleStatusUpdate(task, 'in-progress')}
                        >
                          {statusUpdatingTaskId === task.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Clock className="mr-2 h-4 w-4" />
                          )}
                          Mark as In Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={statusUpdatingTaskId === task.id || task.status === 'done'}
                          onClick={() => handleStatusUpdate(task, 'done')}
                        >
                          {statusUpdatingTaskId === task.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Mark as Done
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => window.open(task.repository.url, '_blank')}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View on GitHub
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Task count */}
      {filteredTasks.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </p>
      )}

      {/* Assign Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>
              Select a team member to assign this task to.
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium line-clamp-2">{selectedTask.description}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTask.filePath}:{selectedTask.lineNumber}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assign to</label>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.avatarUrl} />
                            <AvatarFallback>{member.name?.charAt(0) || '?'}</AvatarFallback>
                          </Avatar>
                          {member.name || member.email}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {member.role}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date (Optional)</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!selectedMember || assignLoading}>
              {assignLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unassign Confirmation Dialog */}
      <AlertDialog open={unassignDialogOpen} onOpenChange={setUnassignDialogOpen}>
        <AlertDialogContentPrimitive>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign this task?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnassign}>Unassign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentPrimitive>
      </AlertDialog>
    </div>
  );
}
