'use client';

import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { SprintProgress } from '@/redux/aiInsightsSlice';

interface Props {
  sprint: SprintProgress;
}

export function SprintProgressCard({ sprint }: Props) {
  const netIcon =
    sprint.netChange > 0 ? (
      <TrendingUp className="h-4 w-4 text-red-400" />
    ) : sprint.netChange < 0 ? (
      <TrendingDown className="h-4 w-4 text-green-400" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    );

  const netColor =
    sprint.netChange > 0 ? 'text-red-400' : sprint.netChange < 0 ? 'text-green-400' : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" />
          Sprint Progress
        </CardTitle>
        <CardDescription>Last 14 days activity</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Added</p>
            <p className="text-2xl font-semibold">+{sprint.recentlyAdded}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Resolved</p>
            <p className="text-2xl font-semibold text-green-500">-{sprint.recentlyResolved}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Net Change</p>
            <p className={`text-2xl font-semibold flex items-center gap-1 ${netColor}`}>
              {netIcon}
              {sprint.netChange > 0 ? '+' : ''}
              {sprint.netChange}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Velocity</p>
            <p className="text-2xl font-semibold">{sprint.velocity}<span className="text-sm text-muted-foreground">/wk</span></p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
