'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchTeamPreview,
  joinTeam,
  selectTeamPreview,
  selectTeamsLoading,
  selectJoinLoading,
  selectTeamsError,
  clearError,
  clearTeamPreview,
  fetchTeams,
} from '@/redux/teamsSlice';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/common';
import { Loader2, Users, ArrowLeft, Search, CheckCircle, Shield, Code } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DashboardFormSkeleton } from '@/components/common/page-loading';

export default function JoinTeamPage() {
  const [inviteCode, setInviteCode] = useState('');
  const dispatch = useAppDispatch();
  const router = useRouter();
  const teamPreview = useAppSelector(selectTeamPreview);
  const loading = useAppSelector(selectTeamsLoading);
  const joinLoading = useAppSelector(selectJoinLoading);
  const error = useAppSelector(selectTeamsError);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteCode.trim()) return;

    dispatch(fetchTeamPreview(inviteCode.trim().toUpperCase()));
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;

    const result = await dispatch(joinTeam({ inviteCode: inviteCode.trim().toUpperCase() }));
    
    if (joinTeam.fulfilled.match(result)) {
      toast.success('Successfully joined the team!');
      dispatch(fetchTeams()); // Refresh teams list
      router.push('/dashboard/teams');
    }
  };

  const handleCodeChange = (value: string) => {
    setInviteCode(value.toUpperCase());
    if (error) dispatch(clearError());
    if (teamPreview) dispatch(clearTeamPreview());
  };

  if (loading && !teamPreview) {
    return <DashboardFormSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/teams">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title="Join Team"
          description="Enter an invite code to join an existing team"
        />
      </div>

      <div className="max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Enter Invite Code
            </CardTitle>
            <CardDescription>
              Ask your team admin for an invite code, or paste the full invite link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLookup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Invite Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    placeholder="ABCD1234"
                    value={inviteCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    disabled={loading || joinLoading}
                    maxLength={8}
                    className="font-mono text-lg tracking-widest uppercase"
                  />
                  <Button type="submit" disabled={loading || !inviteCode.trim() || inviteCode.length < 8}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The 8-character code from your invite link or team admin.
                </p>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </form>
          </CardContent>
        </Card>

        {teamPreview && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Team Found!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-lg font-semibold">{teamPreview.name}</p>
                <p className="text-sm text-muted-foreground">
                  {teamPreview.memberCount} {teamPreview.memberCount === 1 ? 'member' : 'members'}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                New members join as <span className="font-medium text-foreground">Developer</span> by default.
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  dispatch(clearTeamPreview());
                  setInviteCode('');
                }}
                disabled={joinLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleJoin} disabled={joinLoading}>
                {joinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Join Team
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
