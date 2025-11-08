'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Code, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import axiosInstance from '@/lib/axios';
import { useAppSelector } from '@/redux/hooks';
import { selectRepositories } from '@/redux/repositoriesSlice';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import { useTaskActions } from '@/hooks/useTaskActions';
import { EmptyState, LoadingState, PageHeader } from '@/components/common';
import { TaskCard, TaskCodeSnippetModal, TaskFilters, StatsCard } from '@/components/dashboard';


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

export default function RepositoryTasksPage() {
    const params = useParams();
    const repoId = params.repoId as string;
    const repositories = useAppSelector(selectRepositories);
    const currentRepo = repositories.find(r => r.id === repoId);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
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
    }, [repoId]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/tasks/repository/${repoId}`);
            // Add dummy author data and code snippets
            const tasksWithExtras = (response.data || []).map((task: Task) => ({
                ...task,
                author: ['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Johnson'][Math.floor(Math.random() * 4)],
                authorEmail: ['john@example.com', 'jane@example.com', 'bob@example.com', 'alice@example.com'][Math.floor(Math.random() * 4)],
                codeSnippet: `// ${task.filePath}:${task.lineNumber}\nfunction example() {\n  // ${task.type}: ${task.description}\n  // Implementation needed here\n}`,
                context: `This ${task.type} task in ${task.filePath} requires attention. The issue is located at line ${task.lineNumber} and should be addressed with ${task.priority} priority.`,
            }));
            setTasks(tasksWithExtras);
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
        return <LoadingState text="Loading tasks..." />;
    }

    if (loading) {
        return <LoadingState text="Loading tasks..." />;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title={currentRepo?.name || 'Repository'}
                description="Tasks for this repository"
            >
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
                        <div className="divide-y -mb-6">
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
                                    onUpdateStatus={handleUpdateStatus}
                                    onUpdatePriority={handleUpdatePriority}
                                    showStatusSelect={true}
                                    showPrioritySelect={true}
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
