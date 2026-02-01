'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchTeams,
  selectTeams,
  selectTeamsLoading,
  selectTeamsError,
} from '@/redux/teamsSlice';
import { TeamCard, CreateTeamModal } from '@/components/teams';
import { EmptyState, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Plus, Search, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function TeamsPage() {
  const dispatch = useAppDispatch();
  const teams = useAppSelector(selectTeams);
  const loading = useAppSelector(selectTeamsLoading);
  const error = useAppSelector(selectTeamsError);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    dispatch(fetchTeams());
  }, [dispatch]);

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && teams.length === 0) {
    return <EmptyState loading={true} loadingText="Loading teams..." title="" />;
  }

  if (error) {
    return (
      <EmptyState
        icon={Users}
        title="Failed to load teams"
        description={error}
        action={{
          label: 'Retry',
          onClick: () => dispatch(fetchTeams()),
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        description="Collaborate with others on your projects"
      >
        <div className="flex gap-2">
          <Link href="/dashboard/teams/join">
            <Button variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              Join Team
            </Button>
          </Link>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Team
          </Button>
        </div>
      </PageHeader>

      {teams.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          description="Create a team to start collaborating with others, or join an existing team using an invite code."
          action={{
            label: 'Create Team',
            onClick: () => setCreateModalOpen(true),
            icon: Plus,
          }}
        />
      ) : filteredTeams.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No teams found"
          description={`No teams matching "${searchQuery}"`}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}

      <CreateTeamModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
