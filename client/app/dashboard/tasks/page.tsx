'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Code, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import axiosInstance from '@/lib/axios';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import { PageHeader } from '@/components/common';
import { TaskCard, TaskCodeSnippetModal, TaskFilters } from '@/components/dashboard';
import { DashboardSectionSkeleton } from '@/components/common/page-loading';

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
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCodeSnippetModalOpen, setIsCodeSnippetModalOpen] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // Get initial filters from URL query parameters
  const initialStatusFilter = searchParams.get('status') || 'all';
  const initialPriorityFilter = searchParams.get('priority') || 'all';
  const initialTypeFilter = searchParams.get('type') || 'all';
  const initialRepoFilter = searchParams.get('repository') || 'all';

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
  } = useTaskFilters({
    tasks,
    initialStatusFilter,
    initialPriorityFilter,
    initialTypeFilter,
    initialRepoFilter,
  });

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
    return <DashboardSectionSkeleton cards={2} rows={8} />;
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

          {/* Separate completed and non-completed tasks */}
          {(() => {
            const activeTasks = filteredTasks.filter(t => t.status !== 'completed');
            const completedTasks = filteredTasks.filter(t => t.status === 'completed');

            return (
              <div className="space-y-6">
                {/* Active Tasks Section */}
                <div>
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold">Active Tasks ({activeTasks.length})</h3>
                    <p className="text-sm text-muted-foreground">Pending, in-progress, and other active tasks</p>
                  </div>

                  {activeTasks.length === 0 ? (
                    <div className="p-8 rounded-lg bg-muted/30 text-center">
                      <Code className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No active tasks</p>
                    </div>
                  ) : (
                    <div className="divide-y rounded-lg overflow-hidden">
                      {activeTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onViewCode={(task) => {
                            setSelectedTask(task);
                            setIsCodeSnippetModalOpen(true);
                          }}
                          showRepository={true}
                          layout="detailed"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Completed Tasks Section */}
                {completedTasks.length > 0 && (
                  <div className="rounded-lg overflow-hidden">
                    <button
                      onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                      className="w-full p-4 bg-muted/50 hover:bg-muted cursor-pointer font-semibold flex items-center gap-2 transition-colors"
                    >
                      <ChevronDown
                        className={`h-5 w-5 transition-transform ${showCompletedTasks ? 'rotate-180' : ''}`}
                      />
                      <span className="text-lg">Completed Tasks ({completedTasks.length})</span>
                    </button>
                    {showCompletedTasks && (
                      <div className="divide-y">
                        {completedTasks.map((task) => (
                          <div key={task.id} className="opacity-60 hover:opacity-100 transition-opacity bg-muted/20">
                            <TaskCard
                              task={task}
                              onViewCode={(task) => {
                                setSelectedTask(task);
                                setIsCodeSnippetModalOpen(true);
                              }}
                              showRepository={true}
                              layout="detailed"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
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
