'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import axiosInstance from '@/lib/axios';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [repositories, setRepositories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Check if redirected from OAuth
    const authStatus = searchParams.get('auth');
    if (authStatus === 'success') {
      // Remove query param
      router.replace('/dashboard');
    }
  }, [searchParams, router]);

  const syncRepositories = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/repositories/sync');
      setRepositories(response.data.repos || []);
    } catch (error) {
      console.error('Failed to sync repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRepositories = async () => {
    try {
      const response = await axiosInstance.get('/repositories');
      setRepositories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRepositories();
    }
  }, [user]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <h1 className="text-2xl font-bold">GitTask Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Repositories</CardTitle>
                  <CardDescription>
                    {repositories.length > 0
                      ? `${repositories.length} repositories synced`
                      : 'No repositories synced yet'}
                  </CardDescription>
                </div>
                <Button onClick={syncRepositories} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Sync Repositories
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {repositories.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    Click "Sync Repositories" to fetch your GitHub repositories
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {repositories.map((repo: any) => (
                    <Card key={repo.id || repo.name}>
                      <CardHeader>
                        <CardTitle className="text-lg">{repo.name}</CardTitle>
                        <CardDescription>
                          {repo.private ? '🔒 Private' : '🌍 Public'}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
