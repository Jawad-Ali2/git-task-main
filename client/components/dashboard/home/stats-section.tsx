'use client';

import { CheckCircle2, Clock, ListTodo, TrendingUp } from 'lucide-react';
import { StatsCard } from './stats-card';

interface DashboardStatsSectionProps {
  stats: {
    total: number;
    byStatus: {
      pending: number;
      'in-progress': number;
      completed: number;
    };
  };
}

export function DashboardStatsSection({ stats }: DashboardStatsSectionProps) {
  const completionRate = stats.total > 0 
    ? ((stats.byStatus.completed / stats.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatsCard
        title="Total Tasks"
        value={stats.total}
        description="Across all repositories"
        icon={ListTodo}
      />
      <StatsCard
        title="Pending"
        value={stats.byStatus.pending}
        description={`${stats.total > 0 ? ((stats.byStatus.pending / stats.total) * 100).toFixed(0) : 0}% of total`}
        icon={Clock}
        iconColor="text-yellow-500"
      />
      <StatsCard
        title="In Progress"
        value={stats.byStatus['in-progress']}
        description={`${stats.total > 0 ? ((stats.byStatus['in-progress'] / stats.total) * 100).toFixed(0) : 0}% of total`}
        icon={TrendingUp}
        iconColor="text-blue-500"
      />
      <StatsCard
        title="Completed"
        value={stats.byStatus.completed}
        description={`${completionRate}% completion rate`}
        icon={CheckCircle2}
        iconColor="text-green-500"
      />
    </div>
  );
}
