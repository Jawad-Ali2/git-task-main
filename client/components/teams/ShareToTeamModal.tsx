'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Users, Check } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchTeams,
  shareRepository,
  selectTeams,
  selectTeamsLoading,
} from '@/redux/teamsSlice';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShareToTeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repositoryId: string;
  repositoryName: string;
}

export function ShareToTeamModal({
  open,
  onOpenChange,
  repositoryId,
  repositoryName,
}: ShareToTeamModalProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const dispatch = useAppDispatch();
  const teams = useAppSelector(selectTeams);
  const loading = useAppSelector(selectTeamsLoading);

  useEffect(() => {
    if (open) {
      dispatch(fetchTeams());
    }
  }, [open, dispatch]);

  const handleShare = async () => {
    if (!selectedTeamId) return;

    setSharing(true);
    try {
      await dispatch(shareRepository({ teamId: selectedTeamId, repoId: repositoryId })).unwrap();
      toast.success(`Repository shared with team!`);
      onOpenChange(false);
      setSelectedTeamId(null);
    } catch (err: any) {
      toast.error(err || 'Failed to share repository');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share to Team
          </DialogTitle>
          <DialogDescription>
            Share <strong>{repositoryName}</strong> with one of your teams. Team members will be able to view tasks from this repository.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label className="mb-3 block">Select a team</Label>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>You're not in any teams yet</p>
              <p className="text-sm mt-1">Create or join a team first</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {teams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors",
                    selectedTeamId === team.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {team.memberCount || team.members?.length || 0} members
                    </p>
                  </div>
                  {selectedTeamId === team.id && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sharing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={sharing || !selectedTeamId || teams.length === 0}
          >
            {sharing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
