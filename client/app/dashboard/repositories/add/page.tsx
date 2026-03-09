'use client';

import { useEffect, useState } from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import axiosInstance from '@/lib/axios';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/redux/hooks';
import { addNotification } from '@/redux/scanNotificationSlice';
import { toast } from 'sonner';

interface Repository {
  githubId: string;
  name: string;
  fullName: string;
  url: string;
  private: boolean;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  updatedAt: string;
  isSaved: boolean;
}

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();
  const dispatch = useAppDispatch();

  const fetchRepos = async (pageNum: number = 1, searchTerm: string = '') => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/repositories/list', {
        params: { page: pageNum, per_page: 30, search: searchTerm }
      });

      if (pageNum === 1) {
        setRepos(response.data.repos);
        // Pre-select already saved repos
        const saved = new Set<string>(
          response.data.repos.filter((r: Repository) => r.isSaved).map((r: Repository) => r.githubId)
        );
        setSelectedRepos(saved);
      } else {
        setRepos(prev => [...prev, ...response.data.repos]);
      }

      setHasMore(response.data.pagination.hasMore);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos(1, search);
  }, [search]);

  const handleToggleRepo = (githubId: string) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(githubId)) {
      newSelected.delete(githubId);
    } else {
      if (newSelected.size >= 20) {
        toast.warning('You can only save up to 20 repositories');
        return;
      }
      newSelected.add(githubId);
    }
    setSelectedRepos(newSelected);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newRepos = Array.from(selectedRepos).filter(
        id => !repos.find(r => r.githubId === id)?.isSaved
      );

      if (newRepos.length === 0) {
        toast.warning('No new repositories to save');
        return;
      }

      const response = await axiosInstance.post('/repositories/save', {
        repositoryIds: newRepos
      });

      // Get the newly added repository details from backend response
      const addedRepos = response.data.repositories || [];

      // Trigger scan notification
      if (addedRepos.length > 0) {
        dispatch(addNotification({
          repositories: addedRepos,
        }));
      }

      router.push('/dashboard');
    } catch (error: any) {
      console.error('Failed to save repositories:', error);
      toast.error(error.response?.data?.message || 'Failed to save repositories');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchRepos(nextPage, search);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Select Repositories</CardTitle>
            <CardDescription>
              {selectedRepos.size} / 20 selected
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving || selectedRepos.size === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Save Selected
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background"
            />
          </div>
        </div>

        {loading && repos.length === 0 ? (
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Loading repositories...</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {repos.map((repo) => (
                <Card
                  key={repo.githubId}
                  className={`border rounded-xl cursor-pointer transition-all ${selectedRepos.has(repo.githubId) ? 'ring-2 ring-primary' : ''
                    } ${repo.isSaved ? 'opacity-60' : ''}`}
                  onClick={() => !repo.isSaved && handleToggleRepo(repo.githubId)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{repo.name}</CardTitle>
                        <CardDescription>
                          {repo.private ? '🔒 Private' : '🌍 Public'}
                          {repo.language && ` • ${repo.language}`}
                        </CardDescription>
                      </div>
                      {selectedRepos.has(repo.githubId) && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </CardHeader>
                  {repo.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {repo.description}
                      </p>
                    </CardContent>
                  )}
                  {repo.isSaved && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground italic">Already saved</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {hasMore && !loading && (
              <div className="text-center mt-8">
                <Button onClick={handleLoadMore} variant="outline">
                  Load More
                </Button>
              </div>
            )}

            {loading && repos.length > 0 && (
              <div className="text-center mt-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
