'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/authHook';
import axiosInstance from '@/lib/axios';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuth();
  const [repositories, setRepositories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRepositories = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/repositories');
      setRepositories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRepositories();
    }
  }, [user]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Your Saved Repositories</CardTitle>
            <CardDescription>
              {loading ? 'Loading...' : `${repositories.length} repositories saved (max 20)`}
            </CardDescription>
          </div>
          <Link href="/repositories">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Repositories
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading repositories...</p>
          </div>
        ) : repositories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No repositories saved yet
            </p>
            <Link href="/repositories">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Repository
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repo: any) => (
              <Card className='border rounded-xl' key={repo.id || repo.name}>
                <CardHeader>
                  <CardTitle className="text-lg">{repo.name}</CardTitle>
                  <CardDescription>
                    {repo.private ? '🔒 Private' : '🌍 Public'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View on GitHub →
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
