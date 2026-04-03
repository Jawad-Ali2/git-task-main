'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plug, CheckCircle2, AlertCircle, Settings as SettingsIcon, Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { DashboardFormSkeleton } from '@/components/common/page-loading';
import TrelloConfigModal from '@/components/trello-config-modal';
import JiraConfigModal from '@/components/jira-config-modal';
import SyncConfirmationModal from '@/components/sync-confirmation-modal';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
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

interface UserConnection {
  id: string;
  provider: 'trello' | 'jira';
  status: string;
  createdAt: string;
}

interface Integration {
  id: string;
  provider: 'trello' | 'jira';
  status: string;
  config: any;
  isConfigured: boolean;
  lastSyncAt?: string;
  lastError?: string;
}

export default function RepositorySettingsPage() {
  const params = useParams();
  const router = useRouter();
  const repoId = params?.repoId as string;

  const [repository, setRepository] = useState<any>(null);
  const [userConnections, setUserConnections] = useState<UserConnection[]>([]);
  const [repoIntegration, setRepoIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  
  const [trelloConfigModalOpen, setTrelloConfigModalOpen] = useState(false);
  const [jiraConfigModalOpen, setJiraConfigModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [isNewLink, setIsNewLink] = useState(false); // Track if this is a fresh link (not yet configured)
  const configSuccessRef = useRef(false); // Ref to track if config was saved (survives the modal close race condition)
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [repoId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [repoRes, connectionsRes, integrationsRes] = await Promise.all([
        axiosInstance.get(`/repositories/${repoId}`),
        axiosInstance.get('/integrations/connections'), // User-level OAuth connections
        axiosInstance.get(`/integrations?repositoryId=${repoId}`), // Repo-specific integrations
      ]);

      setRepository(repoRes.data);
      setUserConnections(connectionsRes.data);
      
      // Find integration for this specific repository (should be at most 1)
      const integration = integrationsRes.data.find(
        (int: any) => int.repository?.id === repoId
      );
      setRepoIntegration(integration || null);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load repository settings');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkProvider = async (provider: 'trello' | 'jira') => {
    try {
      setLinking(true);
      const { data: newIntegration } = await axiosInstance.post(
        `/integrations/link/${provider}/${repoId}`
      );
      
      // Don't show success toast yet - wait for configuration
      setRepoIntegration(newIntegration);
      setIsNewLink(true); // Mark as new link
      
      // Open config modal
      if (provider === 'trello') {
        setTrelloConfigModalOpen(true);
      } else {
        setJiraConfigModalOpen(true);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Failed to link ${provider}`);
    } finally {
      setLinking(false);
    }
  };

  // Handle modal close - if it's a new link and user cancels, delete the integration
  const handleConfigModalClose = async (open: boolean, provider: 'trello' | 'jira') => {
    if (provider === 'trello') {
      setTrelloConfigModalOpen(open);
    } else {
      setJiraConfigModalOpen(open);
    }
    
    // If closing modal and this was a new link that wasn't configured, delete it
    // Check configSuccessRef to avoid deleting after successful save (race condition)
    if (!open && isNewLink && !configSuccessRef.current && repoIntegration) {
      try {
        await axiosInstance.delete(`/integrations/${repoIntegration.id}`);
        setRepoIntegration(null);
        toast.info('Integration cancelled');
      } catch (error) {
        console.error('Failed to cleanup integration:', error);
      }
    }
    setIsNewLink(false);
    configSuccessRef.current = false; // Reset for next time
  };

  // Handle successful configuration
  const handleConfigSuccess = () => {
    configSuccessRef.current = true; // Set ref IMMEDIATELY to prevent race condition
    setIsNewLink(false); // No longer a new link
    fetchData();
    setSyncModalOpen(true);
    toast.success(`${repoIntegration?.provider === 'trello' ? 'Trello' : 'Jira'} configured successfully!`);
  };

  const handleUnlinkProvider = () => {
    if (!repoIntegration) return;
    setUnlinkDialogOpen(true);
  };

  const confirmUnlinkProvider = async () => {
    if (!repoIntegration) return;
    try {
      await axiosInstance.delete(`/integrations/${repoIntegration.id}`);
      toast.success('Integration unlinked successfully');
      setRepoIntegration(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to unlink integration');
    }
  };

  const trelloConnection = userConnections.find((c) => c.provider === 'trello');
  const jiraConnection = userConnections.find((c) => c.provider === 'jira');

  if (loading) {
    return <DashboardFormSkeleton />;
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

  const renderIntegrationCard = (
    provider: 'trello' | 'jira',
    connection: UserConnection | undefined,
    icon: React.ReactNode,
    bgColor: string,
    title: string
  ) => {
    const isCurrentProvider = repoIntegration?.provider === provider;
    const hasOtherProvider = repoIntegration && repoIntegration.provider !== provider;

    return (
      <Card className={hasOtherProvider ? 'opacity-50' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center`}>
                {icon}
              </div>
              <div>
                <CardTitle>{title} Integration</CardTitle>
                <CardDescription>
                  Sync tasks from this repository to {title}
                </CardDescription>
              </div>
            </div>
            {isCurrentProvider && (
              <Badge
                variant={repoIntegration.status === 'active' ? 'default' : 'destructive'}
              >
                {repoIntegration.status === 'active' ? (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                ) : (
                  <AlertCircle className="w-3 h-3 mr-1" />
                )}
                Linked
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!connection ? (
            // OAuth not connected
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You haven&apos;t connected your {title} account yet. Go to{' '}
                <a href="/dashboard/settings/integrations" className="text-primary underline">
                  Dashboard Integrations
                </a>{' '}
                to connect {title} first.
              </p>
            </div>
          ) : hasOtherProvider ? (
            // Another provider is already linked
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This repository is already linked to {repoIntegration?.provider === 'trello' ? 'Trello' : 'Jira'}.
                Unlink it first to use {title} instead.
              </p>
            </div>
          ) : !isCurrentProvider ? (
            // OAuth connected but not linked to this repo
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your {title} account is connected. Link this repository to sync tasks.
              </p>
              <Button onClick={() => handleLinkProvider(provider)} disabled={linking}>
                {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Link2 className="mr-2 h-4 w-4" />
                Link to {title}
              </Button>
            </div>
          ) : (
            // Currently linked to this provider
            <div className="space-y-4">
              {/* Configuration Details */}
              {provider === 'trello' && repoIntegration.config && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Trello Board</p>
                    <p className="text-sm text-muted-foreground">
                      {repoIntegration.config?.boardName || 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">TODO List</p>
                    <p className="text-sm text-muted-foreground">
                      {repoIntegration.config?.todoListName || 'Not configured'}
                    </p>
                  </div>
                  {repoIntegration.config?.inProgressListName && (
                    <div>
                      <p className="text-sm font-medium">In Progress List</p>
                      <p className="text-sm text-muted-foreground">
                        {repoIntegration.config.inProgressListName}
                      </p>
                    </div>
                  )}
                  {repoIntegration.config?.doneListName && (
                    <div>
                      <p className="text-sm font-medium">Done List</p>
                      <p className="text-sm text-muted-foreground">
                        {repoIntegration.config.doneListName}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {provider === 'jira' && repoIntegration.config && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Jira Site</p>
                    <p className="text-sm text-muted-foreground">
                      {repoIntegration.config?.siteUrl 
                        ? new URL(repoIntegration.config.siteUrl).hostname 
                        : 'Not configured'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Project</p>
                    <p className="text-sm text-muted-foreground">
                      {repoIntegration.config?.projectName || 'Not configured'}
                    </p>
                  </div>
                  {repoIntegration.config?.todoStatusName && (
                    <div>
                      <p className="text-sm font-medium">TODO Status</p>
                      <p className="text-sm text-muted-foreground">
                        {repoIntegration.config.todoStatusName}
                      </p>
                    </div>
                  )}
                  {repoIntegration.config?.doneStatusName && (
                    <div>
                      <p className="text-sm font-medium">Done Status</p>
                      <p className="text-sm text-muted-foreground">
                        {repoIntegration.config.doneStatusName}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Status Badges */}
              {repoIntegration.config && (
                <div className="flex flex-wrap gap-2">
                  {provider === 'trello' && (
                    <>
                      <Badge variant="outline">
                        Auto-Create: {repoIntegration.config.autoCreateCards ? 'On' : 'Off'}
                      </Badge>
                      <Badge variant="outline">
                        Auto-Move: {repoIntegration.config.autoMoveCards ? 'On' : 'Off'}
                      </Badge>
                    </>
                  )}
                  {provider === 'jira' && (
                    <>
                      <Badge variant="outline">
                        Auto-Create: {repoIntegration.config.autoCreateIssues ? 'On' : 'Off'}
                      </Badge>
                      <Badge variant="outline">
                        Auto-Transition: {repoIntegration.config.autoTransitionIssues ? 'On' : 'Off'}
                      </Badge>
                    </>
                  )}
                  <Badge variant="outline">
                    Sync: {repoIntegration.config.syncEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              )}

              {/* Not configured warning */}
              {!repoIntegration.isConfigured && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Configuration Required</AlertTitle>
                  <AlertDescription>
                    Please configure this integration to start syncing tasks.
                  </AlertDescription>
                </Alert>
              )}

              {/* Last Sync */}
              {repoIntegration.lastSyncAt && (
                <p className="text-xs text-muted-foreground">
                  Last synced: {new Date(repoIntegration.lastSyncAt).toLocaleString()}
                </p>
              )}

              {/* Error Display */}
              {repoIntegration.lastError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    {repoIntegration.lastError}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => provider === 'trello' ? setTrelloConfigModalOpen(true) : setJiraConfigModalOpen(true)}
                >
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Configure
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleUnlinkProvider}
                >
                  <Unlink className="w-4 h-4 mr-2" />
                  Unlink
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

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

      {/* Info Alert */}
      <Alert>
        <Plug className="h-4 w-4" />
        <AlertTitle>Project Management Integration</AlertTitle>
        <AlertDescription>
          Link this repository to a project management tool to sync tasks. 
          You can only link one tool per repository.
        </AlertDescription>
      </Alert>

      {/* Trello Integration Card */}
      {renderIntegrationCard(
        'trello',
        trelloConnection,
        <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.656 1.343 3 3 3h18c1.656 0 3-1.344 3-3V3c0-1.657-1.344-3-3-3zM10.44 18.18c0 .795-.645 1.44-1.44 1.44H4.56c-.795 0-1.44-.646-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44H9c.795 0 1.44.645 1.44 1.44v13.62zm10.44-6c0 .794-.645 1.44-1.44 1.44H15c-.795 0-1.44-.646-1.44-1.44V4.56c0-.795.646-1.44 1.44-1.44h4.44c.795 0 1.44.645 1.44 1.44v7.62z"/>
        </svg>,
        'bg-blue-500',
        'Trello'
      )}

      {/* Jira Integration Card */}
      {renderIntegrationCard(
        'jira',
        jiraConnection,
        <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
        </svg>,
        'bg-blue-600',
        'Jira'
      )}

      {/* Other Settings (Future) */}
      <Card className="opacity-50">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Coming soon...</CardDescription>
        </CardHeader>
      </Card>

      {/* Trello Config Modal */}
      {repoIntegration && repoIntegration.provider === 'trello' && (
        <TrelloConfigModal
          open={trelloConfigModalOpen}
          onOpenChange={(open) => handleConfigModalClose(open, 'trello')}
          integrationId={repoIntegration.id}
          currentConfig={repoIntegration.config}
          repositoryId={repoId}
          onConfigured={handleConfigSuccess}
        />
      )}

      {/* Jira Config Modal */}
      {repoIntegration && repoIntegration.provider === 'jira' && (
        <JiraConfigModal
          open={jiraConfigModalOpen}
          onOpenChange={(open) => handleConfigModalClose(open, 'jira')}
          integrationId={repoIntegration.id}
          currentConfig={repoIntegration.config}
          onConfigured={handleConfigSuccess}
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

      {/* Unlink Confirmation Dialog */}
      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink this integration from this repository?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlinkProvider}>Unlink</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
