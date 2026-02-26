'use client';

import { useEffect, useState } from 'react';
import { Code } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import axiosInstance from '@/lib/axios';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import { EmptyState, LoadingState, PageHeader } from '@/components/common';
import { TaskCard, TaskCodeSnippetModal, TaskFilters } from '@/components/dashboard';

interface Task {
  id: string;
  type: string;
  description: string;
  filePath: string;
  lineNumber: number;
  priority: string;
  status: string;
  ai_summary?: string;
  debt_score?: number;
  repository: {
    id: string;
    name: string;
  };
  // Extended fields with dummy data
  author?: string;
  authorEmail?: string;
  authorAvatar?: string;
  codeSnippet?: string;
  context?: string;
  // Commit tracking fields
  addedBy?: string;
  addedAt?: string;
  addedInCommit?: string;
  completedBy?: string;
  completedAt?: string;
  completedInCommit?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  lastModifiedInCommit?: string;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCodeSnippetModalOpen, setIsCodeSnippetModalOpen] = useState(false);

  const {
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    priorityFilter,
    setPriorityFilter,
    statusFilter,
    setStatusFilter,
    repoFilter,
    setRepoFilter,
    filteredTasks,
    clearFilters,
  } = useTaskFilters({ tasks });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/tasks');
      setTasks(response.data || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const uniqueRepos = Array.from(new Set(tasks.map((t) => t.repository.id))).map((id) => {
    const task = tasks.find((t) => t.repository.id === id);
    return { id, name: task?.repository.name || '' };
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
  };

  if (loading) {
    return <LoadingState text="Loading tasks..." />;
  }

  return (
    <div className='space-y-6'>
      <PageHeader
        title="Tasks"
        description="Overview of your tasks"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Tasks</CardTitle>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending</CardTitle>
            <CardTitle className="text-3xl text-yellow-500">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">In Progress</CardTitle>
            <CardTitle className="text-3xl text-blue-500">{stats.inProgress}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Completed</CardTitle>
            <CardTitle className="text-3xl text-green-500">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tasks List */}
      <Card>
        <CardContent>
          <TaskFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            repoFilter={repoFilter}
            onRepoChange={setRepoFilter}
            repositories={uniqueRepos}
            onClearFilters={clearFilters}
            showRepoFilter={true}
            totalCount={tasks.length}
            filteredCount={filteredTasks.length}
            layout='horizontal'
          />


          {/* Tasks List */}
          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={Code}
              title="No tasks found"
              description="Try scanning your repositories or adjusting your filters"
            />
          ) : (
            <div className="divide-y">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onViewCode={(task) => {
                    setSelectedTask(task);
                    setIsCodeSnippetModalOpen(true);
                  }}
                  onCreateCard={(task) => {
                      setSelectedTask(task);
                  }}
                  showRepository={true}
                  layout="detailed"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <TaskCodeSnippetModal
        open={isCodeSnippetModalOpen}
        onOpenChange={setIsCodeSnippetModalOpen}
        task={selectedTask}
      />
    </div>
  );
}
