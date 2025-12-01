'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plug, CheckCircle2, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import TrelloConfigModal from '@/components/trello-config-modal';
import SyncConfirmationModal from '@/components/sync-confirmation-modal';

export default function RepositorySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const repoId = params?.repoId as string;

  const [repository, setRepository] = useState<any>(null);
  const [integration, setIntegration] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [repoId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [repoRes, integrationsRes] = await Promise.all([
        axiosInstance.get(`/repositories/${repoId}`),
        axiosInstance.get('/integrations?provider=trello'),
      ]);

      setRepository(repoRes.data);
      
      // Find integration for this specific repository
      const repoIntegration = integrationsRes.data.find(
        (int: any) => int.repository?.id === repoId
      );
      setIntegration(repoIntegration || null);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load repository settings');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectTrello = async () => {
    try {
      const { data } = await axiosInstance.get('/integrations/trello/authorize');
      const authUrl = data.authUrl;

      const width = 600;
      const height = 700;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'Trello Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      setAuthWindow(popup);

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'trello-token') {
          const token = event.data.token;

          try {
            // Complete auth with repositoryId
            const { data: newIntegration } = await axiosInstance.post('/integrations/trello/callback', {
              token,
              repositoryId: repoId, // ✅ Associate with this repository
            });

            toast.success('Trello connected successfully!');
            popup?.close();
            
            setIntegration(newIntegration);
            setConfigModalOpen(true);

            window.removeEventListener('message', handleMessage);
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to complete authorization');
            popup?.close();
          }
        } else if (event.data.type === 'trello-error') {
          toast.error(event.data.error || 'Authorization failed');
          popup?.close();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      return () => {
        window.removeEventListener('message', handleMessage);
      };
    } catch (err: any) {
      toast.error(err.message || 'Failed to start authorization');
    }
  };

  const handleDisconnectTrello = async () => {
    if (!integration) return;

    if (!confirm('Are you sure you want to disconnect Trello from this repository?')) {
      return;
    }

    try {
      await axiosInstance.delete(`/integrations/${integration.id}`);
      toast.success('Trello disconnected successfully');
      setIntegration(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to disconnect Trello');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Repository not found</p>
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Repository Settings</h2>
          <p className="text-muted-foreground">{repository.name}</p>
        </div>
      </div>

      {/* Trello Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.656 1.343 3 3 3h18c1.656 0 3-1.344 3-3V3c0-1.657-1.344-3-3-3zM10.44 18.18c0 .795-.645 1.44-1.44 1.44H4.56c-.795 0-1.44-.646-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44H9c.795 0 1.44.645 1.44 1.44v13.62zm10.44-6c0 .794-.645 1.44-1.44 1.44H15c-.795 0-1.44-.646-1.44-1.44V4.56c0-.795.646-1.44 1.44-1.44h4.44c.795 0 1.44.645 1.44 1.44v7.62z"/>
                </svg>
              </div>
              <div>
                <CardTitle>Trello Integration</CardTitle>
                <CardDescription>
                  Sync tasks from this repository to Trello
                </CardDescription>
              </div>
            </div>
            {integration && (
              <Badge
                variant={integration.status === 'active' ? 'default' : 'destructive'}
              >
                {integration.status === 'active' ? (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                ) : (
                  <AlertCircle className="w-3 h-3 mr-1" />
                )}
                {integration.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!integration ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Trello to automatically sync tasks from this repository to a Trello board.
                You can configure different boards for different repositories.
              </p>
              <Button onClick={handleConnectTrello}>
                <Plug className="mr-2 h-4 w-4" />
                Connect Trello
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Configuration Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Trello Board</p>
                  <p className="text-sm text-muted-foreground">
                    {integration.config?.boardName || 'Not configured'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">TODO List</p>
                  <p className="text-sm text-muted-foreground">
                    {integration.config?.todoListName || 'Not configured'}
                  </p>
                </div>
                {integration.config?.inProgressListName && (
                  <div>
                    <p className="text-sm font-medium">In Progress List</p>
                    <p className="text-sm text-muted-foreground">
                      {integration.config.inProgressListName}
                    </p>
                  </div>
                )}
                {integration.config?.doneListName && (
                  <div>
                    <p className="text-sm font-medium">Done List</p>
                    <p className="text-sm text-muted-foreground">
                      {integration.config.doneListName}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Badges */}
              {integration.config && (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    Auto-Create: {integration.config.autoCreateCards ? 'On' : 'Off'}
                  </Badge>
                  <Badge variant="outline">
                    Auto-Move: {integration.config.autoMoveCards ? 'On' : 'Off'}
                  </Badge>
                  <Badge variant="outline">
                    Sync: {integration.config.syncEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              )}

              {/* Last Sync */}
              {integration.lastSyncAt && (
                <p className="text-xs text-muted-foreground">
                  Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
                </p>
              )}

              {/* Error Display */}
              {integration.lastError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    {integration.lastError}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfigModalOpen(true)}
                >
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Configure
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnectTrello}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Settings (Future) */}
      <Card className="opacity-50">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Coming soon...</CardDescription>
        </CardHeader>
      </Card>

      {/* Trello Config Modal */}
      {integration && (
        <TrelloConfigModal
          open={configModalOpen}
          onOpenChange={setConfigModalOpen}
          integrationId={integration.id}
          currentConfig={integration.config}
          repositoryId={repoId} // ✅ Pass repository ID for board creation
          onConfigured={() => {
            fetchData();
            // Show sync confirmation modal after configuration
            setSyncModalOpen(true);
          }}
        />
      )}

      {/* Sync Confirmation Modal */}
      {repository && (
        <SyncConfirmationModal
          open={syncModalOpen}
          onOpenChange={setSyncModalOpen}
          repositoryId={repoId}
          repositoryName={repository.name}
        />
      )}
    </div>
  );
}
