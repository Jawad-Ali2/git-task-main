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
import { EmptyState, PageHeader } from '@/components/common';
import { DashboardFormSkeleton } from '@/components/common/page-loading';
import { Loader2, Users, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function JoinTeamByCodePage() {
  const params = useParams();
  const inviteCode = (params.code as string)?.toUpperCase();
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

    const result = await dispatch(joinTeam({ inviteCode }));
    
    if (joinTeam.fulfilled.match(result)) {
      toast.success('Successfully joined the team!');
      dispatch(fetchTeams());
      router.push('/dashboard/teams');
    }
  };

  if (loading) {
    return <DashboardFormSkeleton />;
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
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            New members join as <span className="font-medium text-foreground">Developer</span> by default.
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
