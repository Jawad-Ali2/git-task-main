'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Clock, AlertCircle, FolderGit2 } from 'lucide-react';

export function DashboardQuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Manage your tasks and repositories</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Link href="/tasks?status=pending">
            <Button variant="outline">
              <Clock className="h-4 w-4 mr-2" />
              View Pending Tasks
            </Button>
          </Link>
          <Link href="/tasks?priority=high">
            <Button variant="outline">
              <AlertCircle className="h-4 w-4 mr-2" />
              High Priority Tasks
            </Button>
          </Link>
          <Link href="/dashboard/repositories">
            <Button variant="outline">
              <FolderGit2 className="h-4 w-4 mr-2" />
              Manage Repositories
            </Button>
          </Link>
          <Link href="/dashboard/repositories/add">
            <Button variant="outline">
              Add New Repository
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
