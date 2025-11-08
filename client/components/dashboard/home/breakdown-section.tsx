'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DashboardBreakdownSectionProps {
  stats: {
    byPriority: {
      high: number;
      medium: number;
      low: number;
    };
    byType: Record<string, number>;
  };
}

export function DashboardBreakdownSection({ stats }: DashboardBreakdownSectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Tasks by Priority</CardTitle>
          <CardDescription>Distribution of task priorities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="destructive">High</Badge>
              <span className="text-sm text-muted-foreground">Critical tasks</span>
            </div>
            <span className="text-2xl font-bold">{stats.byPriority.high}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">Medium</Badge>
              <span className="text-sm text-muted-foreground">Standard tasks</span>
            </div>
            <span className="text-2xl font-bold">{stats.byPriority.medium}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">Low</Badge>
              <span className="text-sm text-muted-foreground">Minor tasks</span>
            </div>
            <span className="text-2xl font-bold">{stats.byPriority.low}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks by Type</CardTitle>
          <CardDescription>Different types of code comments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(stats.byType).map(([type, count]) => {
            const colors: Record<string, string> = {
              TODO: 'bg-blue-500/10 text-blue-500',
              FIXME: 'bg-red-500/10 text-red-500',
              HACK: 'bg-yellow-500/10 text-yellow-500',
              NOTE: 'bg-green-500/10 text-green-500',
              BUG: 'bg-red-600/10 text-red-600',
            };
            return (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={colors[type] || 'bg-gray-500/10 text-gray-500'}>{type}</Badge>
                  <span className="text-sm text-muted-foreground capitalize">{type.toLowerCase()} comments</span>
                </div>
                <span className="text-2xl font-bold">{count}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
