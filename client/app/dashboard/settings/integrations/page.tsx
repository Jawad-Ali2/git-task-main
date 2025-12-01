'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchIntegrations,
  getTrelloAuthUrl,
  completeTrelloAuth,
  deleteIntegration,
  syncRepositoryToTrello,
  clearError,
  clearSyncStatus,
} from '@/redux/integrationsSlice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, Settings, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import TrelloConfigModal from '@/components/trello-config-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function IntegrationsPage() {
  const dispatch = useAppDispatch();
  const { integrations, loading, error, syncStatus } = useAppSelector(
    (state) => state.integrations
  );

  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<string>('');

  useEffect(() => {
    dispatch(fetchIntegrations());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  useEffect(() => {
    if (syncStatus.synced > 0 || syncStatus.failed > 0) {
      if (syncStatus.failed === 0) {
        toast.success(`Successfully synced ${syncStatus.synced} tasks to Trello!`);
      } else {
        toast.warning(
          `Synced ${syncStatus.synced} tasks, ${syncStatus.failed} failed. Check console for details.`
        );
        if (syncStatus.errors.length > 0) {
          console.error('Sync errors:', syncStatus.errors);
        }
      }
      dispatch(clearSyncStatus());
    }
  }, [syncStatus, dispatch]);

  const handleConnectTrello = async () => {
    try {
      const authUrl = await dispatch(getTrelloAuthUrl()).unwrap();

      // Open Trello auth in popup
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

      // Listen for the callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'trello-token') {
          const token = event.data.token;

          try {
            const integration = await dispatch(
              completeTrelloAuth(token)
            ).unwrap();

            toast.success('Trello connected successfully!');

            // Close popup
            popup?.close();

            // Open configuration modal
            setSelectedIntegrationId(integration.id);
            setConfigModalOpen(true);

            // Remove event listener
            window.removeEventListener('message', handleMessage);
          } catch (err: any) {
            toast.error(err.message || 'Failed to complete authorization');
            popup?.close();
          }
        } else if (event.data.type === 'trello-error') {
          toast.error(event.data.error || 'Authorization failed');
          popup?.close();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);

      // Cleanup on unmount
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    } catch (err: any) {
      toast.error(err.message || 'Failed to start authorization');
    }
  };

  const handleConfigure = (integrationId: string) => {
    setSelectedIntegrationId(integrationId);
    setConfigModalOpen(true);
  };

  const handleDelete = async () => {
    if (!integrationToDelete) return;

    try {
      await dispatch(deleteIntegration(integrationToDelete)).unwrap();
      toast.success('Integration removed successfully');
      setDeleteDialogOpen(false);
      setIntegrationToDelete('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete integration');
    }
  };

  const handleSync = async (repositoryId?: string) => {
    try {
      await dispatch(
        syncRepositoryToTrello({
          repositoryId,
          force: false,
        })
      ).unwrap();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start sync');
    }
  };

  const trelloIntegration = integrations.find((i) => i.provider === 'trello');
  const isConfigured = trelloIntegration?.config?.boardId && trelloIntegration?.config?.todoListId;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect external services to sync your tasks and automate workflows
          </p>
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
                  <CardTitle>Trello</CardTitle>
                  <CardDescription>
                    Automatically create and sync Trello cards from your TODOs
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {trelloIntegration && (
                  <Badge
                    variant={trelloIntegration.status === 'active' ? 'default' : 'destructive'}
                  >
                    {trelloIntegration.status === 'active' ? (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    ) : (
                      <AlertCircle className="w-3 h-3 mr-1" />
                    )}
                    {trelloIntegration.status}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!trelloIntegration ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your Trello account to automatically create cards for TODOs and keep them in sync.
                </p>
                <Button onClick={handleConnectTrello} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect Trello
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Board</p>
                    <p className="text-sm text-muted-foreground">
                      {trelloIntegration.config?.boardName || 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">TODO List</p>
                    <p className="text-sm text-muted-foreground">
                      {trelloIntegration.config?.todoListName || 'Not configured'}
                    </p>
                  </div>
                  {trelloIntegration.config?.inProgressListName && (
                    <div>
                      <p className="text-sm font-medium">In Progress List</p>
                      <p className="text-sm text-muted-foreground">
                        {trelloIntegration.config.inProgressListName}
                      </p>
                    </div>
                  )}
                  {trelloIntegration.config?.doneListName && (
                    <div>
                      <p className="text-sm font-medium">Done List</p>
                      <p className="text-sm text-muted-foreground">
                        {trelloIntegration.config.doneListName}
                      </p>
                    </div>
                  )}
                </div>

                {trelloIntegration.config && (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Auto-Create: {trelloIntegration.config.autoCreateCards ? 'On' : 'Off'}
                    </Badge>
                    <Badge variant="outline">
                      Auto-Move: {trelloIntegration.config.autoMoveCards ? 'On' : 'Off'}
                    </Badge>
                    <Badge variant="outline">
                      Sync: {trelloIntegration.config.syncEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                )}

                {trelloIntegration.lastSyncAt && (
                  <p className="text-xs text-muted-foreground">
                    Last synced:{' '}
                    {new Date(trelloIntegration.lastSyncAt).toLocaleString()}
                  </p>
                )}

                {trelloIntegration.lastError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      {trelloIntegration.lastError}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfigure(trelloIntegration.id)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Configure
                  </Button>

                  {isConfigured && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync()}
                      disabled={syncStatus.syncing}
                    >
                      {syncStatus.syncing && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      {!syncStatus.syncing && <ExternalLink className="w-4 h-4 mr-2" />}
                      Sync Now
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setIntegrationToDelete(trelloIntegration.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Future integrations placeholder */}
        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-300 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <CardTitle>Jira</CardTitle>
                <CardDescription>Coming soon...</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-300 rounded-lg flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
              <div>
                <CardTitle>Asana</CardTitle>
                <CardDescription>Coming soon...</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Trello Config Modal */}
      {selectedIntegrationId && (
        <TrelloConfigModal
          open={configModalOpen}
          onOpenChange={setConfigModalOpen}
          integrationId={selectedIntegrationId}
          currentConfig={
            integrations.find((i) => i.id === selectedIntegrationId)?.config
          }
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect your Trello integration. Existing cards will not be deleted, but new TODOs will not be synced automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
