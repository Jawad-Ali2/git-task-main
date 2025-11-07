'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Search, Filter, Code, FileText, AlertCircle, CheckCircle, Clock, Loader2, ArrowLeft, Play, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import axiosInstance from '@/lib/axios';
import Link from 'next/link';
import { useAppSelector } from '@/redux/hooks';
import { selectRepositories } from '@/redux/repositoriesSlice';

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
    const router = useRouter();
    const repoId = params.repoId as string;
    const repositories = useAppSelector(selectRepositories);
    const currentRepo = repositories.find(r => r.id === repoId);

    const [tasks, setTasks] = useState<Task[]>([]);
    const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchTasks();
    }, [repoId]);

    useEffect(() => {
        filterTasks();
    }, [tasks, searchQuery, typeFilter, priorityFilter, statusFilter]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/tasks/repository/${repoId}`);
            setTasks(response.data || []);
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleScanRepository = async () => {
        setScanning(true);
        try {
            await axiosInstance.post(`/tasks/scan/${repoId}`);
            // Wait a bit for scan to complete then refresh
            setTimeout(() => {
                fetchTasks();
                setScanning(false);
            }, 3000);
        } catch (error) {
            console.error('Failed to scan repository:', error);
            setScanning(false);
        }
    };

    const handleUpdateStatus = async (taskId: string, status: 'pending' | 'in-progress' | 'completed') => {
        try {
            await axiosInstance.patch(`/tasks/${taskId}/status`, { status });
            // Update local state
            setTasks(tasks.map(t => t.id === taskId ? { ...t, status } : t));
        } catch (error) {
            console.error('Failed to update task status:', error);
        }
    };

    const handleUpdatePriority = async (taskId: string, priority: 'low' | 'medium' | 'high') => {
        try {
            await axiosInstance.patch(`/tasks/${taskId}/priority`, { priority });
            // Update local state
            setTasks(tasks.map(t => t.id === taskId ? { ...t, priority } : t));
        } catch (error) {
            console.error('Failed to update task priority:', error);
        }
    };

    const filterTasks = () => {
        let filtered = [...tasks];

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(
                (task) =>
                    task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    task.filePath.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Type filter
        if (typeFilter !== 'all') {
            filtered = filtered.filter((task) => task.type === typeFilter);
        }

        // Priority filter
        if (priorityFilter !== 'all') {
            filtered = filtered.filter((task) => task.priority === priorityFilter);
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter((task) => task.status === statusFilter);
        }

        setFilteredTasks(filtered);
    };

    const getTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            TODO: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            FIXME: 'bg-red-500/10 text-red-500 border-red-500/20',
            HACK: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
            NOTE: 'bg-green-500/10 text-green-500 border-green-500/20',
            BUG: 'bg-red-600/10 text-red-600 border-red-600/20',
        };
        return colors[type] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    };

    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            high: 'bg-red-500/10 text-red-500',
            medium: 'bg-yellow-500/10 text-yellow-500',
            low: 'bg-green-500/10 text-green-500',
        };
        return colors[priority] || 'bg-gray-500/10 text-gray-500';
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <Clock className="h-4 w-4 text-yellow-500" />;
            case 'in-progress':
                return <TrendingUp className="h-4 w-4 text-blue-500" />;
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            default:
                return <AlertCircle className="h-4 w-4" />;
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">{currentRepo?.name || 'Repository'}</h2>
                        <p className="text-muted-foreground">
                            Tasks for this repository
                        </p>
                    </div>
                </div>
                <Button onClick={handleScanRepository} disabled={scanning}>
                    {scanning ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Tasks</CardDescription>
                        <CardTitle className="text-3xl">{stats.total}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Pending</CardDescription>
                        <CardTitle className="text-3xl text-yellow-500">{stats.pending}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>In Progress</CardDescription>
                        <CardTitle className="text-3xl text-blue-500">{stats.inProgress}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Completed</CardDescription>
                        <CardTitle className="text-3xl text-green-500">{stats.completed}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Filters */}
            <Card className="">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search tasks..."
                                value={searchQuery}
                                onChange={(e: any) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="TODO">TODO</SelectItem>
                                <SelectItem value="FIXME">FIXME</SelectItem>
                                <SelectItem value="HACK">HACK</SelectItem>
                                <SelectItem value="NOTE">NOTE</SelectItem>
                                <SelectItem value="BUG">BUG</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priorities</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {filteredTasks.length} of {tasks.length} tasks
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setSearchQuery('');
                                setTypeFilter('all');
                                setPriorityFilter('all');
                                setStatusFilter('all');
                            }}
                        >
                            Clear Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Tasks List */}
            {loading ? (
                <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading tasks...</p>
                </div>
            ) : filteredTasks.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Code className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-2">No tasks found</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            {tasks.length === 0
                                ? 'Scan this repository to find TODO comments and tasks'
                                : 'Try adjusting your filters'}
                        </p>
                        {tasks.length === 0 && (
                            <Button onClick={handleScanRepository} disabled={scanning}>
                                {scanning ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Scanning...
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-4 w-4 mr-2" />
                                        Scan Now
                                    </>
                                )}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {filteredTasks.map((task) => (
                        <Card key={task.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="pt-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                                            <Badge className={getTypeColor(task.type)}>{task.type}</Badge>

                                            <Select
                                                value={task.priority}
                                                onValueChange={(value) => handleUpdatePriority(task.id, value as any)}
                                            >
                                                <SelectTrigger className="w-[120px] h-7">
                                                    <Badge variant="outline" className={getPriorityColor(task.priority)}>
                                                        {task.priority}
                                                    </Badge>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="high">High</SelectItem>
                                                    <SelectItem value="medium">Medium</SelectItem>
                                                    <SelectItem value="low">Low</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            <Select
                                                value={task.status}
                                                onValueChange={(value) => handleUpdateStatus(task.id, value as any)}
                                            >
                                                <SelectTrigger className="w-[140px] h-7">
                                                    <div className="flex items-center gap-1">
                                                        {getStatusIcon(task.status)}
                                                        <span className="text-sm capitalize">
                                                            {task.status.replace('-', ' ')}
                                                        </span>
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Pending</SelectItem>
                                                    <SelectItem value="in-progress">In Progress</SelectItem>
                                                    <SelectItem value="completed">Completed</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            {task.debt_score !== null && task.debt_score !== undefined && (
                                                <Badge variant="outline" className={getDebtScoreColor(task.debt_score)}>
                                                    <AlertCircle className="h-3 w-3 mr-1" />
                                                    Debt: {task.debt_score}/100 ({getDebtScoreLabel(task.debt_score)})
                                                </Badge>
                                            )}
                                        </div>

                                        <p className="text-lg font-medium mb-2">{task.description}</p>

                                        {task.ai_summary && (
                                            <div className="mb-3 p-3 bg-muted/50 rounded-md border border-muted">
                                                <p className="text-sm text-muted-foreground">
                                                    <span className="font-semibold text-foreground">AI Summary: </span>
                                                    {task.ai_summary}
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                                            <div className="flex items-center gap-1">
                                                <FileText className="h-4 w-4" />
                                                <span className="truncate">{task.filePath}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Code className="h-4 w-4" />
                                                <span>Line {task.lineNumber}</span>
                                            </div>
                                        </div>

                                        {/* Commit tracking info */}
                                        {(task.addedBy || task.completedBy || task.lastModifiedBy) && (
                                            <div className="mt-3 pt-3 border-t border-muted space-y-1 text-xs text-muted-foreground">
                                                {task.addedBy && (
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-medium">Added by:</span>
                                                        <span>{task.addedBy}</span>
                                                        {task.addedAt && (
                                                            <span>• {new Date(task.addedAt).toLocaleDateString()}</span>
                                                        )}
                                                        {task.addedInCommit && (
                                                            <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
                                                                {task.addedInCommit.substring(0, 7)}
                                                            </code>
                                                        )}
                                                    </div>
                                                )}
                                                {task.lastModifiedBy && (
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-medium">Modified by:</span>
                                                        <span>{task.lastModifiedBy}</span>
                                                        {task.lastModifiedAt && (
                                                            <span>• {new Date(task.lastModifiedAt).toLocaleDateString()}</span>
                                                        )}
                                                        {task.lastModifiedInCommit && (
                                                            <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
                                                                {task.lastModifiedInCommit.substring(0, 7)}
                                                            </code>
                                                        )}
                                                    </div>
                                                )}
                                                {task.completedBy && (
                                                    <div className="flex items-center gap-1 text-green-600">
                                                        <span className="font-medium">Completed by:</span>
                                                        <span>{task.completedBy}</span>
                                                        {task.completedAt && (
                                                            <span>• {new Date(task.completedAt).toLocaleDateString()}</span>
                                                        )}
                                                        {task.completedInCommit && (
                                                            <code className="bg-green-100 text-green-700 px-1 py-0.5 rounded text-[10px]">
                                                                {task.completedInCommit.substring(0, 7)}
                                                            </code>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
