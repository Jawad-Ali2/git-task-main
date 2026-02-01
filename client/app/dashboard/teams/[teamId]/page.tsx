'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchTeamById,
  selectCurrentTeam,
  selectTeamsLoading,
  selectTeamsError,
  clearCurrentTeam,
  deleteTeam,
  leaveTeam,
  unshareRepository,
  TeamRole,
} from '@/redux/teamsSlice';
import { selectCurrentUser } from '@/redux/authSlice';
import { MemberList, InviteModal, ActivityFeed } from '@/components/teams';
import { EmptyState, PageHeader } from '@/components/common';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Users,
  ArrowLeft,
  Settings,
  UserPlus,
  FolderGit2,
  MoreVertical,
  Trash2,
  LogOut,
  ExternalLink,
  Loader2,
  Crown,
  Shield,
  Code,
  Link as LinkIcon,
  ListTodo,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const roleConfig: Record<TeamRole, { label: string; icon: React.ElementType; color: string }> = {
  pm: { label: 'PM', icon: Crown, color: 'text-yellow-500' },
  tl: { label: 'Team Lead', icon: Shield, color: 'text-blue-500' },
  developer: { label: 'Developer', icon: Code, color: 'text-green-500' },
};

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const router = useRouter();
  const dispatch = useAppDispatch();
  
  const team = useAppSelector(selectCurrentTeam);
  const loading = useAppSelector(selectTeamsLoading);
  const error = useAppSelector(selectTeamsError);
  const user = useAppSelector(selectCurrentUser);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (teamId) {
      dispatch(fetchTeamById(teamId));
    }
    return () => {
      dispatch(clearCurrentTeam());
    };
  }, [dispatch, teamId]);

  const currentMember = team?.members?.find((m) => m.userId === user?.userId);
  const currentRole = currentMember?.role || 'developer';
  const isPM = currentRole === 'pm';
  const canManage = ['pm', 'tl'].includes(currentRole);

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await dispatch(deleteTeam(teamId)).unwrap();
      toast.success('Team deleted');
      router.push('/dashboard/teams');
    } catch (err: any) {
      toast.error(err || 'Failed to delete team');
    } finally {
      setActionLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleLeave = async () => {
    setActionLoading(true);
    try {
      await dispatch(leaveTeam(teamId)).unwrap();
      toast.success('Left team');
      router.push('/dashboard/teams');
    } catch (err: any) {
      toast.error(err || 'Failed to leave team');
    } finally {
      setActionLoading(false);
      setLeaveDialogOpen(false);
    }
  };

  const handleUnshareRepo = async (repoId: string) => {
    try {
      await dispatch(unshareRepository({ teamId, repoId })).unwrap();
      toast.success('Repository unshared');
    } catch (err: any) {
      toast.error(err || 'Failed to unshare repository');
    }
  };

  if (loading && !team) {
    return <EmptyState loading={true} loadingText="Loading team..." title="" />;
  }

  if (error || !team) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/teams">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <PageHeader title="Team Not Found" />
        </div>
        <EmptyState
          icon={Users}
          title="Team not found"
          description={error || "The team you're looking for doesn't exist or you don't have access."}
          action={{
            label: 'Back to Teams',
            onClick: () => router.push('/dashboard/teams'),
          }}
        />
      </div>
    );
  }

  const RoleIcon = roleConfig[currentRole].icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/teams">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <PageHeader
            title={team.name}
            description={team.description || 'No description'}
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <RoleIcon className={`h-3 w-3 ${roleConfig[currentRole].color}`} />
                {roleConfig[currentRole].label}
              </Badge>
              {canManage && (
                <Link href={`/dashboard/teams/${teamId}/analytics`}>
                  <Button variant="outline">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Analytics
                  </Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => setInviteModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canManage && (
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/teams/${teamId}/settings`}>
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {!isPM && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setLeaveDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Leave Team
                      </DropdownMenuItem>
                    </>
                  )}
                  {isPM && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Team
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </PageHeader>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Members Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Members
            </CardTitle>
            <CardDescription>
              {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MemberList
              members={team.members}
              teamId={teamId}
              currentUserId={user?.userId || ''}
              currentUserRole={currentRole}
              createdById={team.createdById}
            />
          </CardContent>
        </Card>

        {/* Repositories Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderGit2 className="h-5 w-5" />
                Shared Repositories
              </CardTitle>
              <CardDescription>
                {team.repositories?.length || 0} repositories shared
              </CardDescription>
            </div>
            <Link href={`/dashboard/teams/${teamId}/tasks`}>
              <Button variant="outline" size="sm">
                <ListTodo className="h-4 w-4 mr-2" />
                View All Tasks
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {team.repositories?.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FolderGit2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No repositories shared yet</p>
                <p className="text-sm mt-1">
                  Share repositories from your dashboard
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {team.repositories?.map((tr) => (
                  <div
                    key={tr.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Link
                      href={`/dashboard/teams/${teamId}/tasks?repositoryId=${tr.repositoryId}`}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium hover:text-primary">{tr.repository.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {tr.repository.private ? 'Private' : 'Public'} • Click to view tasks
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      <a
                        href={tr.repository.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-muted rounded-md"
                        title="View on GitHub"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnshareRepo(tr.repositoryId)}
                          title="Unshare repository"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite Link Card */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Invite Link
            </CardTitle>
            <CardDescription>
              Share this link to invite others to your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded-md text-sm font-mono truncate">
                {typeof window !== 'undefined'
                  ? `${window.location.origin}/dashboard/teams/join/${team.inviteCode}`
                  : ''}
              </code>
              <Button variant="outline" onClick={() => setInviteModalOpen(true)}>
                Copy
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Feed */}
      <ActivityFeed teamId={teamId} />

      {/* Invite Modal */}
      <InviteModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        teamId={teamId}
        teamName={team.name}
        inviteCode={team.inviteCode}
        canManage={canManage}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{team.name}"? This action cannot be undone.
              All members will lose access and shared repositories will be unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave "{team.name}"? You will lose access to shared
              repositories and will need a new invite to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
