'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Label } from '@/components/ui/label';
import { EmptyState, PageHeader } from '@/components/common';
import { Loader2, Users, ArrowLeft, CheckCircle, Shield, Code, XCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function JoinTeamByCodePage() {
  const params = useParams();
  const inviteCode = (params.code as string)?.toUpperCase();
  const [selectedRole, setSelectedRole] = useState<'developer' | 'pm'>('developer');
  const dispatch = useAppDispatch();
  const router = useRouter();
  const teamPreview = useAppSelector(selectTeamPreview);
  const loading = useAppSelector(selectTeamsLoading);
  const joinLoading = useAppSelector(selectJoinLoading);
  const error = useAppSelector(selectTeamsError);

  useEffect(() => {
    if (inviteCode) {
      dispatch(fetchTeamPreview(inviteCode));
    }
    return () => {
      dispatch(clearTeamPreview());
      dispatch(clearError());
    };
  }, [dispatch, inviteCode]);

  const handleJoin = async () => {
    if (!inviteCode) return;

    const result = await dispatch(joinTeam({ inviteCode, role: selectedRole }));
    
    if (joinTeam.fulfilled.match(result)) {
      toast.success('Successfully joined the team!');
      dispatch(fetchTeams());
      router.push('/dashboard/teams');
    }
  };

  if (loading) {
    return <EmptyState loading={true} loadingText="Looking up team..." title="" />;
  }

  if (error) {
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
            description="Something went wrong"
          />
        </div>

        <Card className="max-w-xl border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Invalid Invite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
          <CardFooter>
            <Link href="/dashboard/teams/join">
              <Button variant="outline">Try Another Code</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!teamPreview) {
    return <EmptyState loading={true} loadingText="Looking up team..." title="" />;
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
          description="You've been invited to join a team"
        />
      </div>

      <Card className="max-w-xl border-green-500/50 bg-green-500/5">
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
          
          <div className="space-y-3">
            <Label>Join as:</Label>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setSelectedRole('developer')}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors",
                  selectedRole === 'developer' && "border-primary bg-primary/5"
                )}
              >
                <Code className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Developer</p>
                  <p className="text-sm text-muted-foreground">
                    Write code, complete tasks, share repositories
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('pm')}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors",
                  selectedRole === 'pm' && "border-primary bg-primary/5"
                )}
              >
                <Shield className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">Project Manager</p>
                  <p className="text-sm text-muted-foreground">
                    Manage team, assign tasks, view analytics
                  </p>
                </div>
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Link href="/dashboard/teams">
            <Button variant="outline" disabled={joinLoading}>
              Cancel
            </Button>
          </Link>
          <Button onClick={handleJoin} disabled={joinLoading}>
            {joinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Join Team
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
