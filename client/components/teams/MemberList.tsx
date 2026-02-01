'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Crown,
  Shield,
  Code,
  MoreVertical,
  UserMinus,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { TeamMember, TeamRole, updateMemberRole, removeMember } from '@/redux/teamsSlice';
import { useAppDispatch } from '@/redux/hooks';
import { toast } from 'sonner';

interface MemberListProps {
  members: TeamMember[];
  teamId: string;
  currentUserId: string;
  currentUserRole: TeamRole;
  createdById: string;
}

const roleConfig: Record<TeamRole, { label: string; icon: React.ElementType; color: string }> = {
  pm: { label: 'PM', icon: Crown, color: 'text-yellow-500' },
  tl: { label: 'Team Lead', icon: Shield, color: 'text-blue-500' },
  developer: { label: 'Developer', icon: Code, color: 'text-green-500' },
};

interface MemberItemProps {
  member: TeamMember;
  teamId: string;
  currentUserId: string;
  canManage: boolean;
  isCreator: boolean;
  isSelf: boolean;
}

function MemberItem({ member, teamId, currentUserId, canManage, isCreator, isSelf }: MemberItemProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const config = roleConfig[member.role];
  const RoleIcon = config.icon;

  const handleRoleChange = async (newRole: TeamRole) => {
    if (newRole === member.role) return;
    
    setLoading(true);
    try {
      await dispatch(updateMemberRole({ teamId, userId: member.userId, role: newRole })).unwrap();
      toast.success(`Role updated to ${roleConfig[newRole].label}`);
    } catch (err: any) {
      toast.error(err || 'Failed to update role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await dispatch(removeMember({ teamId, userId: member.userId })).unwrap();
      toast.success('Member removed from team');
    } catch (err: any) {
      toast.error(err || 'Failed to remove member');
    } finally {
      setLoading(false);
      setConfirmRemove(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between py-3">
        <Link 
          href={`/dashboard/teams/${teamId}/members/${member.userId}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity group"
        >
          <Avatar>
            <AvatarImage src={member.user?.avatarUrl} />
            <AvatarFallback>
              {member.user?.name?.charAt(0) || member.user?.email?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium group-hover:text-primary transition-colors">
              {member.user?.name || member.user?.email || 'Unknown User'}
              {isSelf && <span className="text-muted-foreground ml-2">(you)</span>}
            </p>
            {member.user?.email && member.user?.name && (
              <p className="text-sm text-muted-foreground">{member.user.email}</p>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <RoleIcon className={`h-3 w-3 ${config.color}`} />
            {config.label}
          </Badge>
          {canManage && !isCreator && !isSelf && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreVertical className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleRoleChange('pm')}>
                  <Crown className="h-4 w-4 mr-2 text-yellow-500" />
                  Set as PM
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRoleChange('tl')}>
                  <Shield className="h-4 w-4 mr-2 text-blue-500" />
                  Set as Team Lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRoleChange('developer')}>
                  <Code className="h-4 w-4 mr-2 text-green-500" />
                  Set as Developer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmRemove(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Remove from Team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {member.user?.name || 'this member'} from the team?
              They will lose access to all team repositories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function MemberList({
  members,
  teamId,
  currentUserId,
  currentUserRole,
  createdById,
}: MemberListProps) {
  // Only PM can manage roles
  const canManage = currentUserRole === 'pm';

  // Sort members: PM first, then TL, then developers
  const sortedMembers = [...members].sort((a, b) => {
    const order: Record<TeamRole, number> = { pm: 0, tl: 1, developer: 2 };
    return order[a.role] - order[b.role];
  });

  return (
    <div className="divide-y">
      {sortedMembers.map((member) => (
        <MemberItem
          key={member.id}
          member={member}
          teamId={teamId}
          currentUserId={currentUserId}
          canManage={canManage}
          isCreator={member.userId === createdById}
          isSelf={member.userId === currentUserId}
        />
      ))}
    </div>
  );
}
