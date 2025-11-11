'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import axios from '@/lib/axios';
import { toast } from 'sonner';

interface SyncConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositoryId: string;
  repositoryName: string;
}

export default function SyncConfirmationModal({
  open,
  onOpenChange,
  repositoryId,
  repositoryName,
}: SyncConfirmationModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    failed: number;
    total: number;
  } | null>(null);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await axios.post('/integrations/sync/repository', {
        repositoryId,
      });

      const { synced, failed, total } = response.data;

      setSyncResult({ synced, failed, total });

      if (failed === 0) {
        toast.success(`Successfully synced ${synced} task${synced !== 1 ? 's' : ''} to Trello!`);
      } else {
        toast.warning(
          `Synced ${synced} task${synced !== 1 ? 's' : ''}, but ${failed} failed.`
        );
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to sync tasks');
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncLater = () => {
    onOpenChange(false);
    toast.info('You can sync tasks anytime from the repository page');
  };

  const handleClose = () => {
    onOpenChange(false);
    setSyncResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sync Tasks to Trello?</DialogTitle>
          <DialogDescription>
            Would you like to sync existing tasks from <strong>{repositoryName}</strong> to Trello now?
          </DialogDescription>
        </DialogHeader>

        {!syncResult ? (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will create Trello cards for all tasks in this repository that haven't been synced yet.
              You can also do this later from the repository tasks page.
            </p>
          </div>
        ) : (
          <div className="py-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>
                <strong>{syncResult.synced}</strong> task{syncResult.synced !== 1 ? 's' : ''} synced successfully
              </span>
            </div>
            {syncResult.failed > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-5 w-5 text-red-500" />
                <span>
                  <strong>{syncResult.failed}</strong> task{syncResult.failed !== 1 ? 's' : ''} failed to sync
                </span>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Total: {syncResult.total} task{syncResult.total !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        <DialogFooter>
          {!syncResult ? (
            <>
              <Button variant="outline" onClick={handleSyncLater} disabled={syncing}>
                Sync Later
              </Button>
              <Button onClick={handleSyncNow} disabled={syncing}>
                {syncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
