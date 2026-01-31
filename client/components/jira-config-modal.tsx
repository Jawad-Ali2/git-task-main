'use client';

import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchJiraProjects,
  fetchJiraStatuses,
  configureJira,
  JiraConfig,
} from '@/redux/integrationsSlice';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface JiraConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  currentConfig?: JiraConfig;
  onConfigured?: () => void;
  repositoryId?: string;
}

export default function JiraConfigModal({
  open,
  onOpenChange,
  integrationId,
  currentConfig,
  onConfigured,
}: JiraConfigModalProps) {
  const dispatch = useAppDispatch();
  const { jiraProjects, jiraStatuses, jiraIssueTypes, loading, error } = useAppSelector(
    (state) => state.integrations
  );

  const [selectedProjectId, setSelectedProjectId] = useState(
    currentConfig?.projectId || ''
  );
  const [config, setConfig] = useState<JiraConfig>({
    // Preserve OAuth-related fields from current config
    cloudId: currentConfig?.cloudId || '',
    siteUrl: currentConfig?.siteUrl || '',
    // User-configurable fields
    projectId: currentConfig?.projectId || '',
    projectKey: currentConfig?.projectKey || '',
    projectName: currentConfig?.projectName || '',
    issueTypeId: currentConfig?.issueTypeId || '',
    issueTypeName: currentConfig?.issueTypeName || '',
    todoStatusId: currentConfig?.todoStatusId || '',
    todoStatusName: currentConfig?.todoStatusName || '',
    inProgressStatusId: currentConfig?.inProgressStatusId || '',
    inProgressStatusName: currentConfig?.inProgressStatusName || '',
    doneStatusId: currentConfig?.doneStatusId || '',
    doneStatusName: currentConfig?.doneStatusName || '',
    syncEnabled: currentConfig?.syncEnabled ?? true,
    autoCreateIssues: currentConfig?.autoCreateIssues ?? true,
    autoTransitionIssues: currentConfig?.autoTransitionIssues ?? true,
  });

  useEffect(() => {
    if (open) {
      dispatch(fetchJiraProjects());
    }
  }, [open, dispatch]);

  useEffect(() => {
    if (selectedProjectId) {
      dispatch(fetchJiraStatuses(selectedProjectId));
    }
  }, [selectedProjectId, dispatch]);

  const handleProjectChange = (projectId: string) => {
    const project = jiraProjects.find((p) => p.id === projectId);
    setSelectedProjectId(projectId);
    setConfig({
      ...config,
      projectId,
      projectKey: project?.key || '',
      projectName: project?.name || '',
      // Reset status and issue type selections when project changes
      issueTypeId: '',
      issueTypeName: '',
      todoStatusId: '',
      todoStatusName: '',
      inProgressStatusId: '',
      inProgressStatusName: '',
      doneStatusId: '',
      doneStatusName: '',
    });
  };

  const handleIssueTypeChange = (issueTypeId: string) => {
    const issueType = jiraIssueTypes.find((t) => t.id === issueTypeId);
    setConfig({
      ...config,
      issueTypeId,
      issueTypeName: issueType?.name || '',
    });
  };

  const handleStatusChange = (
    type: 'todo' | 'inProgress' | 'done',
    statusId: string
  ) => {
    const status = jiraStatuses.find((s) => s.id === statusId);
    if (type === 'todo') {
      setConfig({
        ...config,
        todoStatusId: statusId,
        todoStatusName: status?.name || '',
      });
    } else if (type === 'inProgress') {
      setConfig({
        ...config,
        inProgressStatusId: statusId,
        inProgressStatusName: status?.name || '',
      });
    } else {
      setConfig({
        ...config,
        doneStatusId: statusId,
        doneStatusName: status?.name || '',
      });
    }
  };

  const handleSave = async () => {
    if (!config.projectId || !config.todoStatusId) {
      toast.error('Please select a project and at least a TODO status');
      return;
    }

    try {
      const result = await dispatch(
        configureJira({
          id: integrationId,
          config,
        })
      ).unwrap();
      
      // Check webhook status
      if (result.webhookCreated) {
        toast.success('Jira configured! Webhook created for bi-directional sync.');
      } else if (result.webhookError) {
        toast.warning('Jira configured but webhook failed. Jira → GitTask sync won\'t work.', {
          description: 'Make sure BACKEND_URL is publicly accessible.',
          duration: 8000,
        });
      } else {
        toast.success('Jira configuration saved successfully!');
      }
      
      // Call optional callback BEFORE closing modal to prevent race condition
      if (onConfigured) {
        onConfigured();
      }
      
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save configuration');
    }
  };

  // Filter issue types to exclude subtasks
  const standardIssueTypes = jiraIssueTypes.filter((t) => !t.subtask);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Jira Integration</DialogTitle>
          <DialogDescription>
            Select your Jira project and map statuses to task states. This
            determines where issues will be created and transitioned as tasks progress.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Error Alert - Jira token expired */}
          {error && error.includes('expired') && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive font-medium mb-2">
                Jira Connection Expired
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                Your Jira connection has expired. Please reconnect from Dashboard Settings.
              </p>
              <a
                href="/dashboard/settings/integrations"
                className="text-sm text-primary hover:underline"
              >
                Go to Dashboard Settings →
              </a>
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project">Jira Project *</Label>
            <Select value={selectedProjectId} onValueChange={handleProjectChange} disabled={!!error}>
              <SelectTrigger id="project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {jiraProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.key} - {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {jiraProjects.length === 0 && !loading && !error && (
              <p className="text-sm text-muted-foreground">
                No projects found. Make sure you have access to at least one Jira project.
              </p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Don't have a project?{' '}
              <a
                href="https://www.atlassian.com/software/jira/guides/getting-started/basics#step-1-create-a-project"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Create one in Jira
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {selectedProjectId && (
            <>
              {/* Issue Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="issueType">
                  Issue Type *
                  <span className="text-muted-foreground text-xs ml-2">
                    (for new tasks)
                  </span>
                </Label>
                <Select
                  value={config.issueTypeId}
                  onValueChange={handleIssueTypeChange}
                >
                  <SelectTrigger id="issueType">
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    {standardIssueTypes.map((issueType) => (
                      <SelectItem key={issueType.id} value={issueType.id}>
                        {issueType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the issue type to use when creating new Jira issues from tasks.
                  Common choices: Task, Story, or Bug.
                </p>
              </div>

              {/* Status Mappings */}
              {jiraStatuses.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="todoStatus">
                      TODO Status *
                      <span className="text-muted-foreground text-xs ml-2">
                        (for new/open tasks)
                      </span>
                    </Label>
                    <Select
                      value={config.todoStatusId}
                      onValueChange={(value) => handleStatusChange('todo', value)}
                    >
                      <SelectTrigger id="todoStatus">
                        <SelectValue placeholder="Select TODO status" />
                      </SelectTrigger>
                      <SelectContent>
                        {jiraStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.name}
                            <span className="text-muted-foreground text-xs ml-2">
                              ({status.statusCategory.name})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inProgressStatus">
                      In Progress Status
                      <span className="text-muted-foreground text-xs ml-2">
                        (optional)
                      </span>
                    </Label>
                    <Select
                      value={config.inProgressStatusId}
                      onValueChange={(value) =>
                        handleStatusChange('inProgress', value)
                      }
                    >
                      <SelectTrigger id="inProgressStatus">
                        <SelectValue placeholder="Select In Progress status" />
                      </SelectTrigger>
                      <SelectContent>
                        {jiraStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.name}
                            <span className="text-muted-foreground text-xs ml-2">
                              ({status.statusCategory.name})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="doneStatus">
                      Done Status
                      <span className="text-muted-foreground text-xs ml-2">
                        (optional)
                      </span>
                    </Label>
                    <Select
                      value={config.doneStatusId}
                      onValueChange={(value) => handleStatusChange('done', value)}
                    >
                      <SelectTrigger id="doneStatus">
                        <SelectValue placeholder="Select Done status" />
                      </SelectTrigger>
                      <SelectContent>
                        {jiraStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.name}
                            <span className="text-muted-foreground text-xs ml-2">
                              ({status.statusCategory.name})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Sync Options */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Sync Options</h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Sync</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow syncing tasks with Jira
                    </p>
                  </div>
                  <Switch
                    checked={config.syncEnabled}
                    onCheckedChange={(checked: boolean) =>
                      setConfig({ ...config, syncEnabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Create Issues</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically create Jira issues for new TODOs
                    </p>
                  </div>
                  <Switch
                    checked={config.autoCreateIssues}
                    onCheckedChange={(checked: boolean) =>
                      setConfig({ ...config, autoCreateIssues: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Transition Issues</Label>
                    <p className="text-sm text-muted-foreground">
                      Update task status when issues are transitioned in Jira
                    </p>
                  </div>
                  <Switch
                    checked={config.autoTransitionIssues}
                    onCheckedChange={(checked: boolean) =>
                      setConfig({ ...config, autoTransitionIssues: checked })
                    }
                  />
                </div>
              </div>
            </>
          )}

          {selectedProjectId && jiraStatuses.length === 0 && loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !config.projectId || !config.todoStatusId}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
