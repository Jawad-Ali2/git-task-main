'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Clock, AlertCircle, FolderGit2, Plus } from 'lucide-react';

export function DashboardQuickActions() {
  const actions = [
    {
      icon: Clock,
      title: 'Pending Tasks',
      description: 'View tasks waiting to be started',
      href: '/dashboard/tasks?status=pending',
      color: 'bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20',
      iconColor: 'text-yellow-600',
    },
    {
      icon: AlertCircle,
      title: 'High Priority',
      description: 'Focus on critical tasks',
      href: '/dashboard/tasks?priority=high',
      color: 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20',
      iconColor: 'text-red-600',
    },
    {
      icon: FolderGit2,
      title: 'Repositories',
      description: 'Manage your repositories',
      href: '/dashboard/repositories',
      color: 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20',
      iconColor: 'text-blue-600',
    },
    {
      icon: Plus,
      title: 'Add Repository',
      description: 'Connect a new repository',
      href: '/dashboard/integrations',
      color: 'bg-green-500/10 border-green-500/20 hover:bg-green-500/20',
      iconColor: 'text-green-600',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Manage your tasks and repositories</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link key={index} href={action.href}>
                <div className={`p-4 border rounded-lg transition-colors cursor-pointer ${action.color}`}>
                  <div className="flex flex-col gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center ${action.iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{action.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
