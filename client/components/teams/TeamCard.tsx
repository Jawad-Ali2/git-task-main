'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, FolderGit2, Crown, Shield, Code } from 'lucide-react';
import { Team, TeamRole } from '@/redux/teamsSlice';

interface TeamCardProps {
  team: Team;
}

const roleConfig: Record<TeamRole, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'outline' }> = {
  pm: { label: 'PM', icon: Crown, variant: 'default' },
  tl: { label: 'Team Lead', icon: Shield, variant: 'secondary' },
  developer: { label: 'Developer', icon: Code, variant: 'outline' },
};

export function TeamCard({ team }: TeamCardProps) {
  const role = team.role || 'developer';
  const config = roleConfig[role];
  const RoleIcon = config.icon;

  return (
    <Link href={`/dashboard/teams/${team.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={team.createdBy?.avatarUrl} />
                <AvatarFallback className="text-lg">
                  {team.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{team.name}</CardTitle>
                {team.description && (
                  <CardDescription className="line-clamp-1 mt-1">
                    {team.description}
                  </CardDescription>
                )}
              </div>
            </div>
            <Badge variant={config.variant} className="flex items-center gap-1">
              <RoleIcon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{team.memberCount || team.members?.length || 0} members</span>
            </div>
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4" />
              <span>{team.repositories?.length || 0} repos</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
