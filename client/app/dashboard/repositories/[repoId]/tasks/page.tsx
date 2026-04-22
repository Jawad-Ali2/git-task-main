'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Code, Play, RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import axiosInstance from '@/lib/axios';
import { useAppSelector } from '@/redux/hooks';
import { selectRepositories } from '@/redux/repositoriesSlice';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import { useTaskActions } from '@/hooks/useTaskActions';
import { toast } from 'sonner';
import { EmptyState, PageHeader } from '@/components/common';
import { TaskCard, TaskCodeSnippetModal, TaskFilters, StatsCard } from '@/components/dashboard';
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
    // Trello fields
    trelloCardId?: string;
    trelloCardUrl?: string;
    // Jira fields
    jiraIssueId?: string;
    jiraIssueKey?: string;
    jiraIssueUrl?: string;
}

export default function RepositoryTasksPage() {
    const params = useParams();
    const repoId = params.repoId as string;
    const repositories = useAppSelector(selectRepositories);
    const currentRepo = repositories.find(r => r.id === repoId);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showCompletedTasks, setShowCompletedTasks] = useState(false);
    const [integration, setIntegration] = useState<{ provider: 'trello' | 'jira' | null; configured: boolean }>({ provider: null, configured: false });
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
        filteredTasks,
        clearFilters,
    } = useTaskFilters({ tasks });

    const { updateStatus, updatePriority, scanRepository } = useTaskActions();

    useEffect(() => {
        fetchTasks();
        checkIntegration();
    }, [repoId]);

    const checkIntegration = async () => {
        try {
            // Check for any integration linked to this repository
            const response = await axiosInstance.get(`/integrations?repositoryId=${repoId}`);
            const repoIntegration = response.data.find(
                (int: any) => int.repository?.id === repoId && int.isConfigured
            );
            
            if (repoIntegration) {
                setIntegration({
                    provider: repoIntegration.provider,
                    configured: true,
                });
            } else {
                setIntegration({ provider: null, configured: false });
            }
        } catch (error) {
            console.error('Failed to check integration:', error);
        }
    };

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/tasks/repository/${repoId}`);
            // Add dummy author data and code snippets
            // const tasksWithExtras = (response.data || []).map((task: Task) => ({
            //     ...task,
            //     author: ['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Johnson'][Math.floor(Math.random() * 4)],
            //     authorEmail: ['john@example.com', 'jane@example.com', 'bob@example.com', 'alice@example.com'][Math.floor(Math.random() * 4)],
            //     codeSnippet: `// ${task.filePath}:${task.lineNumber}\nfunction example() {\n  // ${task.type}: ${task.description}\n  // Implementation needed here\n}`,
            //     context: `This ${task.type} task in ${task.filePath} requires attention. The issue is located at line ${task.lineNumber} and should be addressed with ${task.priority} priority.`,
            // }));
            setTasks(response.data || []);
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleScanRepository = async () => {
        setScanning(true);
        const success = await scanRepository(repoId);
        if (success) {
            setTimeout(() => {
                fetchTasks();
                setScanning(false);
            }, 3000);
        } else {
            setScanning(false);
        }
    };

    const handleUpdateStatus = async (taskId: string, status: 'pending' | 'in-progress' | 'completed') => {
        const success = await updateStatus(taskId, status);
        if (success) {
            setTasks(tasks.map(t => t.id === taskId ? { ...t, status } : t));
        }
    };

    const handleUpdatePriority = async (taskId: string, priority: 'low' | 'medium' | 'high') => {
        const success = await updatePriority(taskId, priority);
        if (success) {
            setTasks(tasks.map(t => t.id === taskId ? { ...t, priority } : t));
        }
    };

    const handleSync = async () => {
        if (!integration.configured || !integration.provider) {
            toast.error('No integration configured for this repository');
            return;
        }

        setSyncing(true);
        try {
            const endpoint = integration.provider === 'jira' 
                ? '/integrations/jira/sync/repository'
                : '/integrations/sync/repository';
            
            const response = await axiosInstance.post(endpoint, {
                repositoryId: repoId,
            });

            const { synced, failed, total } = response.data;
            const providerName = integration.provider === 'jira' ? 'Jira' : 'Trello';

            if (failed === 0) {
                toast.success(
                    `Successfully synced ${synced} of ${total} task${total !== 1 ? 's' : ''} to ${providerName}!`,
                    {
                        description: synced === 0 ? 'All tasks were already synced' : undefined,
                    }
                );
            } else {
                toast.warning(
                    `Synced ${synced} task${synced !== 1 ? 's' : ''}, but ${failed} failed`,
                    {
                        description: `Total tasks: ${total}`,
                    }
                );
            }

            // Refresh tasks to update sync status
            fetchTasks();
        } catch (error: any) {
            const providerName = integration.provider === 'jira' ? 'Jira' : 'Trello';
            toast.error(error.response?.data?.message || `Failed to sync tasks to ${providerName}`);
            console.error('Sync error:', error);
        } finally {
            setSyncing(false);
        }
    };

    const getDebtScoreColor = (score: number) => {
        if (score >= 81) return 'text-red-600 bg-red-500/10 border-red-500/20';
        if (score >= 61) return 'text-orange-600 bg-orange-500/10 border-orange-500/20';
        if (score >= 41) return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20';
        if (score >= 21) return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
        return 'text-green-600 bg-green-500/10 border-green-500/20';
    };

    const getDebtScoreLabel = (score: number) => {
        if (score >= 81) return 'Critical';
        if (score >= 61) return 'High';
        if (score >= 41) return 'Medium';
        if (score >= 21) return 'Low';
        return 'Minor';
    };

    const stats = {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === 'pending').length,
        inProgress: tasks.filter((t) => t.status === 'in-progress').length,
        completed: tasks.filter((t) => t.status === 'completed').length,
    };

    if (loading) {
        return <DashboardSectionSkeleton cards={2} rows={8} />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title={currentRepo?.name || 'Repository'}
                description="Tasks for this repository"
            >
                <div className="flex gap-2">
                    {integration.configured && integration.provider && (
                        <Button
                            variant="outline"
                            onClick={handleSync}
                            disabled={syncing || tasks.length === 0}
                        >
                            {syncing ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Syncing...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Sync to {integration.provider === 'jira' ? 'Jira' : 'Trello'}
                                </>
                            )}
                        </Button>
                    )}
                    <Button onClick={handleScanRepository} disabled={scanning}>
                        {scanning ? (
                            <>
                                <Play className="h-4 w-4 mr-2 animate-spin" />
                                Scanning...
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4 mr-2" />
                                Scan Repository
                            </>
                        )}
                    </Button>
                </div>
            </PageHeader>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatsCard title="Total Tasks" value={stats.total} />
                <StatsCard title="Pending" value={stats.pending} valueColor="text-yellow-500" />
                <StatsCard title="In Progress" value={stats.inProgress} valueColor="text-blue-500" />
                <StatsCard title="Completed" value={stats.completed} valueColor="text-green-500" />
            </div>

            {/* Tasks List */}
            <Card>
                <CardContent className="pb-0">
                    <TaskFilters
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        typeFilter={typeFilter}
                        onTypeChange={setTypeFilter}
                        priorityFilter={priorityFilter}
                        onPriorityChange={setPriorityFilter}
                        statusFilter={statusFilter}
                        onStatusChange={setStatusFilter}
                        onClearFilters={clearFilters}
                        totalCount={tasks.length}
                        filteredCount={filteredTasks.length}
                        layout="horizontal"
                    />

                    {filteredTasks.length === 0 ? (
                        <EmptyState
                            icon={Code}
                            title="No tasks found"
                            description={tasks.length === 0 ? 'Scan this repository to find TODO comments and tasks' : 'Try adjusting your filters'}
                            action={tasks.length === 0 ? {
                                label: scanning ? 'Scanning...' : 'Scan Now',
                                onClick: handleScanRepository,
                                icon: Play,
                            } : undefined}
                        />
                    ) : (
                        (() => {
                            const activeTasks = filteredTasks.filter(t => t.status !== 'completed');
                            const completedTasks = filteredTasks.filter(t => t.status === 'completed');
                            
                            return (
                              <div className="space-y-6 pb-6">
                                {/* Active Tasks Section */}
                                <div>
                                  {activeTasks.length > 0 ? (
                                    <div className="divide-y rounded-lg overflow-hidden">
                                      {activeTasks.map((task) => (
                                        <TaskCard
                                          key={task.id}
                                          task={task}
                                          onViewCode={(task) => {
                                            setSelectedTask(task);
                                            setIsCodeSnippetModalOpen(true);
                                          }}
                                          onCreateCard={integration.configured ? (task) => {
                                            setSelectedTask(task);
                                          } : undefined}
                                          onUpdateStatus={handleUpdateStatus}
                                          onUpdatePriority={handleUpdatePriority}
                                          showStatusSelect={true}
                                          showPrioritySelect={true}
                                          layout="detailed"
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="p-8 rounded-lg bg-muted/30 text-center">
                                      <Code className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                                      <p className="text-sm text-muted-foreground">No active tasks</p>
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
                                              onCreateCard={integration.configured ? (task) => {
                                                setSelectedTask(task);
                                              } : undefined}
                                              onUpdateStatus={handleUpdateStatus}
                                              onUpdatePriority={handleUpdatePriority}
                                              showStatusSelect={true}
                                              showPrioritySelect={true}
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
                          })()
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
