'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, Check, Lock, Globe, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import axiosInstance from '@/lib/axios';
import { useAppDispatch } from '@/redux/hooks';
import { addNotification } from '@/redux/scanNotificationSlice';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

interface AddRepositoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddRepositoryModal({ open, onOpenChange, onSuccess }: AddRepositoryModalProps) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
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
    if (open) {
      fetchRepos(1, search);
    }
  }, [open, search]);

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
        setSaving(false);
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

      onOpenChange(false);
      onSuccess();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Add Repositories</DialogTitle>
          <DialogDescription>
            Select repositories to monitor for tasks. {selectedRepos.size} / 20 selected
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-4 flex-1 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {loading && repos.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">Loading repositories...</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <div className="border rounded-md">
                  <ScrollArea className="h-[450px] rounded-md">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead className="min-w-[200px]">Repository</TableHead>
                          <TableHead className="w-[120px]">Visibility</TableHead>
                          <TableHead className="min-w-[250px]">Description</TableHead>
                          <TableHead className="w-[100px] text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {repos.map((repo) => (
                          <TableRow
                            key={repo.githubId}
                            className={`cursor-pointer transition-colors ${
                              repo.isSaved ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted/50'
                            } ${selectedRepos.has(repo.githubId) ? 'bg-primary/5' : ''}`}
                            onClick={() => !repo.isSaved && handleToggleRepo(repo.githubId)}
                          >
                            <TableCell>
                              <div className="flex items-center justify-center">
                                {selectedRepos.has(repo.githubId) && (
                                  <CheckCircle2 className="h-5 w-5 text-primary" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-sm">{repo.name}</span>
                                <span className="text-xs text-muted-foreground">{repo.fullName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-xs">
                                {repo.private ? (
                                  <>
                                    <Lock className="h-3 w-3 text-yellow-700" />
                                    Private
                                  </>
                                ) : (
                                  <>
                                    <Globe className="h-3 w-3 text-blue-500" />
                                    Public
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {repo.description || '-'}
                              </p>
                            </TableCell>
                            <TableCell className="text-right">
                              {repo.isSaved && (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <Check className="h-3 w-3" />
                                  Added
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>

                {/* Load More Button - Outside ScrollArea */}
                <div className="flex items-center justify-center mt-4">
                  {loading && repos.length > 0 && (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  )}
                  {hasMore && !loading && (
                    <Button onClick={handleLoadMore} variant="outline" size="sm">
                      Load More
                    </Button>
                  )}
                </div>
              </div>

              {/* Mobile List View */}
              <div className="md:hidden">
                <ScrollArea className="h-[450px]">
                  <div className="space-y-3 pr-4">
                    {repos.map((repo) => (
                      <div
                        key={repo.githubId}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          repo.isSaved ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary'
                        } ${selectedRepos.has(repo.githubId) ? 'border-primary bg-primary/5' : ''}`}
                        onClick={() => !repo.isSaved && handleToggleRepo(repo.githubId)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm truncate">{repo.name}</h3>
                              {selectedRepos.has(repo.githubId) && (
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{repo.fullName}</p>
                            
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge variant={repo.private ? 'secondary' : 'outline'} className="gap-1 text-xs">
                                {repo.private ? (
                                  <>
                                    <Lock className="h-3 w-3" />
                                    Private
                                  </>
                                ) : (
                                  <>
                                    <Globe className="h-3 w-3" />
                                    Public
                                  </>
                                )}
                              </Badge>
                              {repo.isSaved && (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <Check className="h-3 w-3" />
                                  Added
                                </Badge>
                              )}
                            </div>
                            
                            {repo.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {repo.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Load More Button - Outside ScrollArea */}
                <div className="flex items-center justify-center mt-4">
                  {loading && repos.length > 0 && (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  )}
                  {hasMore && !loading && (
                    <Button onClick={handleLoadMore} variant="outline" size="sm">
                      Load More
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || selectedRepos.size === 0}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Add Selected ({selectedRepos.size})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
