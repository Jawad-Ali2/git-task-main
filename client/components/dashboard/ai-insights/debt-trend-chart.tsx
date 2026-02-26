'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { DebtTrendPoint } from '@/redux/aiInsightsSlice';

interface Props {
  data: DebtTrendPoint[];
}

const chartConfig: ChartConfig = {
  openTasks: { label: 'Open Tasks', color: 'hsl(var(--chart-1))' },
  closedTasks: { label: 'Closed (week)', color: 'hsl(var(--chart-2))' },
  avgDebtScore: { label: 'Avg Debt Score', color: 'hsl(var(--chart-3))' },
};

export function DebtTrendChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Technical Debt Trend</CardTitle>
        <CardDescription>Open tasks and average debt score over the last 12 weeks</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillOpen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-openTasks)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--color-openTasks)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillDebt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-avgDebtScore)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-avgDebtScore)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <Tooltip content={<ChartTooltipContent />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="openTasks"
              stroke="var(--color-openTasks)"
              fill="url(#fillOpen)"
              name="Open Tasks"
            />
            <Area
              type="monotone"
              dataKey="avgDebtScore"
              stroke="var(--color-avgDebtScore)"
              fill="url(#fillDebt)"
              name="Avg Debt Score"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
