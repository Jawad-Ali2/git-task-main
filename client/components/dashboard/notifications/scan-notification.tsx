'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  selectActiveNotifications,
  dismissNotification,
  removeNotification,
  triggerScan,
  triggerMultipleScans,
  selectIsScanningRepo,
} from '@/redux/scanNotificationSlice';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Loader2, CheckCircle2, FolderGit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function ScanNotificationContainer() {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectActiveNotifications);
  const [closing, setClosing] = useState<Set<string>>(new Set());

  const handleDismiss = (id: string) => {
    setClosing(prev => new Set(prev).add(id));
    setTimeout(() => {
      dispatch(removeNotification(id));
    }, 300); // Match animation duration
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {notifications.map(notification => (
        <ScanNotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={handleDismiss}
          isClosing={closing.has(notification.id)}
        />
      ))}
    </div>
  );
}

interface ScanNotificationCardProps {
  notification: {
    id: string;
    repositories: Array<{
      id: string;
      githubId: string;
      name: string;
      fullName?: string;
      needsScan: boolean;
    }>;
    timestamp: number;
  };
  onDismiss: (id: string) => void;
  isClosing: boolean;
}

function ScanNotificationCard({ notification, onDismiss, isClosing }: ScanNotificationCardProps) {
  const dispatch = useAppDispatch();
  const [scannedRepos, setScannedRepos] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);

  const repoCount = notification.repositories.length;
  const allScanned = scannedRepos.size === repoCount;

  const handleScanAll = async () => {
    setIsScanning(true);
    const repoIds = notification.repositories.map(r => r.id);
    
    try {
      await dispatch(triggerMultipleScans({ repoIds })).unwrap();
      // Mark all as scanned
      setScannedRepos(new Set(repoIds));
      
      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        onDismiss(notification.id);
      }, 2000);
    } catch (error) {
      console.error('Failed to scan repositories:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanSingle = async (repoId: string) => {
    try {
      await dispatch(triggerScan({ repoId })).unwrap();
      setScannedRepos(prev => new Set(prev).add(repoId));
    } catch (error) {
      console.error('Failed to scan repository:', error);
    }
  };

  useEffect(() => {
    if (allScanned && scannedRepos.size > 0) {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [allScanned, scannedRepos.size, notification.id, onDismiss]);

  return (
    <Card
      className={cn(
        "p-4 shadow-lg border-l-4 border-l-blue-500 pointer-events-auto transition-all duration-300",
        isClosing && "opacity-0 translate-x-full",
        allScanned && "border-l-green-500"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-1">
            {allScanned ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <FolderGit2 className="h-5 w-5 text-blue-600" />
            )}
          </div>
          
          <div className="flex-1 space-y-2">
            <div>
              <h4 className="font-semibold text-sm">
                {allScanned ? 'Scanning Complete!' : 'New Repositories Added'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {allScanned 
                  ? `${repoCount} ${repoCount === 1 ? 'repository' : 'repositories'} scanned successfully`
                  : `${repoCount} ${repoCount === 1 ? 'repository' : 'repositories'} added. Scan for tasks?`
                }
              </p>
            </div>

            {!allScanned && (
              <div className="space-y-1.5">
                {notification.repositories.map(repo => (
                  <RepoScanItem
                    key={repo.id}
                    repo={repo}
                    isScanned={scannedRepos.has(repo.id)}
                    onScan={() => handleScanSingle(repo.id)}
                  />
                ))}
              </div>
            )}

            {!allScanned && (
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={handleScanAll}
                  disabled={isScanning}
                  className="flex-1"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    'Scan All'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDismiss(notification.id)}
                >
                  Later
                </Button>
              </div>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => onDismiss(notification.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

interface RepoScanItemProps {
  repo: {
    id: string;
    name: string;
    fullName?: string;
  };
  isScanned: boolean;
  onScan: () => void;
}

function RepoScanItem({ repo, isScanned, onScan }: RepoScanItemProps) {
  const dispatch = useAppDispatch();
  const isScanning = useAppSelector(selectIsScanningRepo(repo.id));

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-muted/50 rounded-md">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FolderGit2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium truncate">
          {repo.fullName || repo.name}
        </span>
      </div>
      
      {isScanned ? (
        <Badge variant="secondary" className="text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Scanned
        </Badge>
      ) : isScanning ? (
        <Badge variant="secondary" className="text-xs">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Scanning
        </Badge>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2"
          onClick={onScan}
        >
          Scan
        </Button>
      )}
    </div>
  );
}
