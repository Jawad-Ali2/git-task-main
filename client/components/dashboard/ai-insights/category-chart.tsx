'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { CategoryBreakdown } from '@/redux/aiInsightsSlice';

interface Props {
  categories: CategoryBreakdown[];
}

const CATEGORY_COLORS: Record<string, string> = {
  bug: 'hsl(0, 72%, 51%)',        // red
  security: 'hsl(25, 95%, 53%)',   // orange
  performance: 'hsl(45, 93%, 47%)',// amber
  refactor: 'hsl(221, 83%, 53%)', // blue
  documentation: 'hsl(142, 76%, 36%)', // green
  feature: 'hsl(262, 83%, 58%)',  // purple
  other: 'hsl(220, 9%, 46%)',     // gray
};

const chartConfig: ChartConfig = {
  count: { label: 'Tasks', color: 'hsl(var(--chart-1))' },
};

export function CategoryChart({ categories }: Props) {
  const data = categories.map((c) => ({
    ...c,
    fill: CATEGORY_COLORS[c.category] ?? CATEGORY_COLORS.other,
    label: c.category.charAt(0).toUpperCase() + c.category.slice(1),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Task Categories</CardTitle>
        <CardDescription>Classification of open & completed tasks by AI + rule-based analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis type="number" className="text-xs" />
            <YAxis dataKey="label" type="category" className="text-xs" width={75} />
            <Tooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Tasks">
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        <div className="mt-4 flex flex-wrap gap-3">
          {data.map((c) => (
            <div key={c.category} className="flex items-center gap-1.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.fill }} />
              <span className="text-muted-foreground">
                {c.label}: {c.count} ({c.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
