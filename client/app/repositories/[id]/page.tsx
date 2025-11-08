'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Scan, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import axiosInstance from '@/lib/axios';
import Link from 'next/link';

interface ScanStatus {
  status: 'idle' | 'scanning' | 'completed' | 'failed';
  progress: number;
  totalFiles: number;
  scannedFiles: number;
  foundTasks: number;
  currentFile?: string;
  error?: string;
}

interface Task {
  id: string;
  type: string;
  message: string;
  filePath: string;
  lineNumber: number;
  priority: string;
  status: string;
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

interface Repository {
  id: string;
  name: string;
  url: string;
  private: boolean;
}

export default function RepositoryTasksPage() {
  const params = useParams();
  const repoId = params.id as string;

  const [repository, setRepository] = useState<Repository | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetchRepositoryAndTasks();
    checkScanStatus();
  }, [repoId]);

  // Poll scan status every 2 seconds when scanning
  useEffect(() => {
    if (scanning || scanStatus?.status === 'scanning') {
      const interval = setInterval(() => {
        checkScanStatus();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [scanning, scanStatus?.status]);

  const fetchRepositoryAndTasks = async () => {
    setLoading(true);
    try {
      // Fetch all repos to find the current one
      const reposResponse = await axiosInstance.get('/repositories');
      const repo = reposResponse.data.find((r: Repository) => r.id === repoId);
      setRepository(repo || null);

      // Fetch tasks for this repo
      const tasksResponse = await axiosInstance.get(`/tasks/repository/${repoId}`);
      setTasks(tasksResponse.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkScanStatus = async () => {
    try {
      const response = await axiosInstance.get(`/tasks/scan/${repoId}/status`);

      if (response.data.status) {
        setScanStatus(response.data);

        // If scan completed, refresh tasks
        if (response.data.status === 'completed' && scanning) {
          setScanning(false);
          await fetchRepositoryAndTasks();
        }

        // If scan failed, stop polling
        if (response.data.status === 'failed') {
          setScanning(false);
        }
      }
    } catch (error) {
      console.error('Failed to check scan status:', error);
    }
  };

  const handleStartScan = async () => {
    setScanning(true);
    try {
      await axiosInstance.post(`/tasks/scan/${repoId}`);
      // Start polling for status
      setTimeout(() => checkScanStatus(), 1000);
    } catch (error) {
      console.error('Failed to start scan:', error);
      alert('Failed to start scan. Please try again.');
      setScanning(false);
    }
  };

  const handleCancelScan = async () => {
    try {
      await axiosInstance.post(`/tasks/scan/${repoId}/cancel`);
      setScanStatus(null);
      setScanning(false);
    } catch (error) {
      console.error('Failed to cancel scan:', error);
    }
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

  const taskStats = {
    total: tasks.length,
    byType: tasks.reduce((acc, task) => {
      acc[task.type] = (acc[task.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byPriority: tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>

    );
  }

  if (!repository) {
    return (

      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Repository not found</p>
            <Link href="/repositories">
              <Button className="mt-4">Back to Repositories</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

    );
  }

  return (

    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/repositories">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{repository.name}</h1>
              <p className="text-sm text-muted-foreground">
                {repository.private ? '🔒 Private' : '🌍 Public'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={repository.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                View on GitHub
              </Button>
            </a>
            <Button
              onClick={handleStartScan}
              disabled={scanning || scanStatus?.status === 'scanning'}
            >
              {scanning || scanStatus?.status === 'scanning' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Scan className="h-4 w-4 mr-2" />
                  {tasks.length > 0 ? 'Re-scan' : 'Scan'} Repository
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Scan Progress Card */}
        {scanStatus && (scanStatus.status === 'scanning' || scanStatus.status === 'completed' || scanStatus.status === 'failed') && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {scanStatus.status === 'scanning' && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                    {scanStatus.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {scanStatus.status === 'failed' && <AlertCircle className="h-5 w-5 text-red-500" />}
                    Scan Status: {scanStatus.status.charAt(0).toUpperCase() + scanStatus.status.slice(1)}
                  </CardTitle>
                  <CardDescription>
                    {scanStatus.status === 'scanning' && `Scanning ${scanStatus.currentFile || '...'}`}
                    {scanStatus.status === 'completed' && `Found ${scanStatus.foundTasks} tasks`}
                    {scanStatus.status === 'failed' && scanStatus.error}
                  </CardDescription>
                </div>
                {scanStatus.status === 'scanning' && (
                  <Button variant="destructive" size="sm" onClick={handleCancelScan}>
                    Cancel Scan
                  </Button>
                )}
              </div>
            </CardHeader>
            {scanStatus.status === 'scanning' && (
              <CardContent className="space-y-4">
                <Progress value={scanStatus.progress} />
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Progress</p>
                    <p className="font-medium">{scanStatus.progress.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Files Scanned</p>
                    <p className="font-medium">{scanStatus.scannedFiles} / {scanStatus.totalFiles}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tasks Found</p>
                    <p className="font-medium">{scanStatus.foundTasks}</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Tasks</CardDescription>
              <CardTitle className="text-3xl">{taskStats.total}</CardTitle>
            </CardHeader>
          </Card>
          {Object.entries(taskStats.byType).slice(0, 3).map(([type, count]) => (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardDescription>{type}</CardDescription>
                <CardTitle className="text-3xl">{count}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Tasks List */}
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Scan className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No tasks found</p>
              <p className="text-sm text-muted-foreground mb-4">
                Click "Scan Repository" to extract tasks from this repository
              </p>
              <Button onClick={handleStartScan} disabled={scanning}>
                <Scan className="h-4 w-4 mr-2" />
                Scan Repository
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getTypeColor(task.type)}>{task.type}</Badge>
                        <Badge variant="outline" className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </div>
                      <p className="text-lg font-medium mb-2">{task.message}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="truncate">{task.filePath}</span>
                        <span>Line {task.lineNumber}</span>
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
                            </div>
                          )}
                          {task.completedBy && (
                            <div className="flex items-center gap-1 text-green-600">
                              <span className="font-medium">Completed by:</span>
                              <span>{task.completedBy}</span>
                              {task.completedAt && (
                                <span>• {new Date(task.completedAt).toLocaleDateString()}</span>
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
      </main>
    </div>
  );
}
