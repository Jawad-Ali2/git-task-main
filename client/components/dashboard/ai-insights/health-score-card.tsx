'use client';

import { Activity, HeartPulse } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { ProjectHealthSummary } from '@/redux/aiInsightsSlice';

interface Props {
  health: ProjectHealthSummary;
}

const colorMap: Record<string, string> = {
  Healthy: 'text-green-500',
  'Needs Attention': 'text-yellow-500',
  'At Risk': 'text-orange-500',
  Critical: 'text-red-500',
};

const progressColor: Record<string, string> = {
  Healthy: '[&>div]:bg-green-500',
  'Needs Attention': '[&>div]:bg-yellow-500',
  'At Risk': '[&>div]:bg-orange-500',
  Critical: '[&>div]:bg-red-500',
};

export function HealthScoreCard({ health }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="h-4 w-4" />
          Project Health
        </CardTitle>
        <CardDescription>Overall codebase health assessment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-4xl font-bold">{health.score}</span>
            <span className="text-muted-foreground text-sm">/100</span>
          </div>
          <span className={`text-sm font-semibold ${colorMap[health.label] ?? 'text-muted-foreground'}`}>
            {health.label}
          </span>
        </div>

        <Progress value={health.score} className={progressColor[health.label] ?? ''} />

        <div className="grid grid-cols-3 gap-4 pt-2 text-center">
          <div>
            <p className="text-2xl font-semibold">{health.openTasks}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{health.completedTasks}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{health.avgDebtScore}</p>
            <p className="text-xs text-muted-foreground">Avg Debt</p>
          </div>
        </div>

        {health.topContributors.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Activity className="h-3 w-3" /> Top Contributors
            </p>
            <div className="space-y-1">
              {health.topContributors.slice(0, 3).map((c) => (
                <div key={c.username} className="flex justify-between text-sm">
                  <span className="truncate font-medium">{c.username}</span>
                  <span className="text-muted-foreground text-xs">
                    +{c.tasksAdded} / -{c.tasksResolved}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
