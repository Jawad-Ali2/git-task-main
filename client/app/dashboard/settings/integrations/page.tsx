'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchUserConnections,
  getTrelloAuthUrl,
  completeTrelloAuth,
  getJiraAuthUrl,
  completeJiraAuth,
  deleteIntegration,
  clearError,
} from '@/redux/integrationsSlice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

export default function IntegrationsPage() {
  const dispatch = useAppDispatch();
  const { userConnections, loading, error } = useAppSelector(
    (state) => state.integrations
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<string>('');
  const [deleteProvider, setDeleteProvider] = useState<'trello' | 'jira'>('trello');

  useEffect(() => {
    dispatch(fetchUserConnections());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleConnectTrello = async () => {
    try {
      const authUrl = await dispatch(getTrelloAuthUrl()).unwrap();

      const width = 600;
      const height = 700;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'Trello Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'trello-token') {
          const token = event.data.token;

          try {
            await dispatch(completeTrelloAuth(token)).unwrap();
            toast.success('Trello connected successfully! You can now link repositories from their settings.');
            popup?.close();
            dispatch(fetchUserConnections());
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to start authorization');
    }
  };

  const handleConnectJira = async () => {
    try {
      const authUrl = await dispatch(getJiraAuthUrl()).unwrap();

      const width = 600;
      const height = 700;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'Jira Authorization',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'jira-code') {
          const code = event.data.code;

          try {
            await dispatch(completeJiraAuth(code)).unwrap();
            toast.success('Jira connected successfully! You can now link repositories from their settings.');
            popup?.close();
            dispatch(fetchUserConnections());
            window.removeEventListener('message', handleMessage);
          } catch (err: any) {
            toast.error(err.message || 'Failed to complete Jira authorization');
            popup?.close();
          }
        } else if (event.data.type === 'jira-error') {
          toast.error(event.data.error || 'Jira authorization failed');
          popup?.close();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start Jira authorization');
    }
  };

  const handleDelete = async () => {
    if (!integrationToDelete) return;

    try {
      await dispatch(deleteIntegration(integrationToDelete)).unwrap();
      toast.success('Integration disconnected successfully');
      setDeleteDialogOpen(false);
      setIntegrationToDelete('');
      dispatch(fetchUserConnections());
    } catch (err: any) {
      toast.error(err.message || 'Failed to disconnect integration');
    }
  };

  const trelloConnection = userConnections.find((i) => i.provider === 'trello');
  const jiraConnection = userConnections.find((i) => i.provider === 'jira');

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect external services to sync your tasks
          </p>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>How it works</AlertTitle>
          <AlertDescription>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Connect your Trello or Jira account here (OAuth authorization)</li>
              <li>Go to a repository&apos;s settings to link it to a specific board/project</li>
              <li>Configure which lists/statuses to use for task syncing</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Trello Connection Card */}
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
                    Sync tasks to Trello boards
                  </CardDescription>
                </div>
              </div>
              {trelloConnection && (
                <Badge variant={trelloConnection.status === 'active' ? 'default' : 'destructive'}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!trelloConnection ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your Trello account to enable task syncing with Trello boards.
                </p>
                <Button onClick={handleConnectTrello} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect Trello
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  ✓ Trello account connected. Go to a repository&apos;s settings to link it to a Trello board.
                </p>
                <p className="text-xs text-muted-foreground">
                  Connected since: {new Date(trelloConnection.createdAt).toLocaleDateString()}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setIntegrationToDelete(trelloConnection.id);
                    setDeleteProvider('trello');
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jira Connection Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle>Jira</CardTitle>
                  <CardDescription>
                    Sync tasks to Jira projects
                  </CardDescription>
                </div>
              </div>
              {jiraConnection && (
                <Badge variant={jiraConnection.status === 'active' ? 'default' : 'destructive'}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!jiraConnection ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your Jira account to enable task syncing with Jira projects.
                </p>
                <Button onClick={handleConnectJira} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect Jira
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  ✓ Jira account connected. Go to a repository&apos;s settings to link it to a Jira project.
                </p>
                <p className="text-xs text-muted-foreground">
                  Connected since: {new Date(jiraConnection.createdAt).toLocaleDateString()}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setIntegrationToDelete(jiraConnection.id);
                    setDeleteProvider('jira');
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Future integrations placeholder */}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {deleteProvider === 'trello' ? 'Trello' : 'Jira'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect your {deleteProvider === 'trello' ? 'Trello' : 'Jira'} account 
              and unlink all repositories. Existing {deleteProvider === 'trello' ? 'cards' : 'issues'} 
              will not be deleted, but syncing will stop.
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
