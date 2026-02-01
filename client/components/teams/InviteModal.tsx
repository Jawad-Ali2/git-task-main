'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, RefreshCw, Loader2, Link as LinkIcon } from 'lucide-react';
import { useAppDispatch } from '@/redux/hooks';
import { regenerateInviteCode } from '@/redux/teamsSlice';
import { toast } from 'sonner';

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  inviteCode: string;
  canManage: boolean;
}

export function InviteModal({
  open,
  onOpenChange,
  teamId,
  teamName,
  inviteCode,
  canManage,
}: InviteModalProps) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const dispatch = useAppDispatch();

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/teams/join/${inviteCode}`
    : '';

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await dispatch(regenerateInviteCode(teamId)).unwrap();
      toast.success('Invite code regenerated');
    } catch (err: any) {
      toast.error(err || 'Failed to regenerate invite code');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Invite to {teamName}
          </DialogTitle>
          <DialogDescription>
            Share the invite link or code with others to let them join your team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Invite Link</Label>
            <div className="flex gap-2">
              <Input
                value={inviteUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(inviteUrl)}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Invite Code</Label>
            <div className="flex gap-2">
              <Input
                value={inviteCode}
                readOnly
                className="font-mono text-lg tracking-widest text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(inviteCode)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {canManage && (
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="text-muted-foreground"
              >
                {regenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Regenerate Code
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                This will invalidate the old invite code.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
