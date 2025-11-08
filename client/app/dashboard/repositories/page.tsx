'use client';

import { useEffect, useState } from 'react';
import { Plus, FolderGit2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/authHook';
import axiosInstance from '@/lib/axios';
import { AddRepositoryModal, RepoTable } from '@/components/dashboard';

export default function RepositoriesPage() {
  const { user } = useAuth();
  const [repositories, setRepositories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRepositories = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/repositories');
      setRepositories(response.data || []);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      alert('Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRepositories();
    }
  }, [user]);

  const handleDeleteRepository = async (repoId: string) => {
    try {
      const repo = repositories.find((r) => r.id === repoId);
      if (!repo) return;

      await axiosInstance.delete(`/repositories/${repoId}`);

      // Update local state
      setRepositories((prev) => prev.filter((r) => r.id !== repoId));

      alert(`${repo.name} has been removed`);
    } catch (error: any) {
      console.error('Failed to delete repository:', error);
      alert(error.response?.data?.message || 'Failed to delete repository');
    }
  };

  if (loading && repositories.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Repositories</h2>
          <p className="text-muted-foreground">
            Manage your monitored repositories
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Repositories
        </Button>
      </div>

      {/* No Repositories State */}
      {repositories.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <FolderGit2 className="h-16 w-16 text-muted-foreground" />
          <div className="text-center">
            <p className="text-lg font-medium">No repositories yet</p>
            <p className="text-muted-foreground">
              Add repositories to start monitoring for tasks
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Repository
          </Button>
        </div>
      ) : (
        /* Repositories Table */
        <RepoTable
          data={repositories}
          onDeleteRepository={handleDeleteRepository}
        />
      )}

      {/* Add Repository Modal */}
      <AddRepositoryModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={fetchRepositories}
      />

    </div>
  );
}
