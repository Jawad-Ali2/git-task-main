'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { createTeam, selectCreateLoading, selectTeamsError, clearError } from '@/redux/teamsSlice';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/common';
import { Loader2, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreateTeamPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const dispatch = useAppDispatch();
  const router = useRouter();
  const loading = useAppSelector(selectCreateLoading);
  const error = useAppSelector(selectTeamsError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    const result = await dispatch(
      createTeam({ name: name.trim(), description: description.trim() || undefined })
    );
    
    if (createTeam.fulfilled.match(result)) {
      router.push(`/dashboard/teams/${result.payload.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/teams">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title="Create Team"
          description="Set up a new team for collaboration"
        />
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Details
          </CardTitle>
          <CardDescription>
            Create a team to collaborate with developers and project managers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name *</Label>
              <Input
                id="name"
                placeholder="My Awesome Team"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) dispatch(clearError());
                }}
                disabled={loading}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of your team (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                Help others understand what your team is about.
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex gap-3 pt-4">
              <Link href="/dashboard/teams">
                <Button type="button" variant="outline" disabled={loading}>
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading || !name.trim()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Team
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
