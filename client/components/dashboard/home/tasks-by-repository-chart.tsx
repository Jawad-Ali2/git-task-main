'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FolderGit2 } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import Link from 'next/link';

interface RepositoryTaskCount {
  repositoryId: string;
  repositoryName: string;
  taskCount: number;
  pending: number;
  inProgress: number;
  completed: number;
}

export function TasksByRepositoryChart() {
  const [data, setData] = useState<RepositoryTaskCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRepositoryTaskCounts();
  }, []);

  const fetchRepositoryTaskCounts = async () => {
    setLoading(true);
    try {
      // Fetch all tasks and group by repository
      const response = await axiosInstance.get('/tasks');
      const tasks = response.data || [];

      // Group tasks by repository
      const repoMap = new Map<string, RepositoryTaskCount>();
      
      tasks.forEach((task: any) => {
        const repoId = task.repository.id;
        const repoName = task.repository.name;
        
        if (!repoMap.has(repoId)) {
          repoMap.set(repoId, {
            repositoryId: repoId,
            repositoryName: repoName,
            taskCount: 0,
            pending: 0,
            inProgress: 0,
            completed: 0,
          });
        }
        
        const repo = repoMap.get(repoId)!;
        repo.taskCount++;
        
        // Count by status (support both canonical + client vocab)
        if (task.status === 'pending' || task.status === 'open') repo.pending++;
        else if (task.status === 'in-progress' || task.status === 'in_progress') repo.inProgress++;
        else if (task.status === 'completed' || task.status === 'done') repo.completed++;
      });

      // Convert to array and sort by task count, limit to top 5
      const repoData = Array.from(repoMap.values()).sort((a, b) => b.taskCount - a.taskCount).slice(0, 5);
      setData(repoData);
    } catch (error) {
      console.error('Failed to fetch repository task counts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tasks by Repository</CardTitle>
          <CardDescription>Distribution of tasks across repositories</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tasks by Repository</CardTitle>
          <CardDescription>Distribution of tasks across repositories</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <FolderGit2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No tasks found in any repository</p>
        </CardContent>
      </Card>
    );
  }

  const maxTasks = Math.max(...data.map(repo => repo.taskCount));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks by Repository</CardTitle>
        <CardDescription>Distribution of tasks across {data.length} repositories</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((repo) => {
            const percentage = maxTasks > 0 ? (repo.taskCount / maxTasks) * 100 : 0;
            const pendingPercentage = repo.taskCount > 0 ? (repo.pending / repo.taskCount) * 100 : 0;
            const inProgressPercentage = repo.taskCount > 0 ? (repo.inProgress / repo.taskCount) * 100 : 0;
            const completedPercentage = repo.taskCount > 0 ? (repo.completed / repo.taskCount) * 100 : 0;

            return (
              <div key={repo.repositoryId} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Link 
                    href={`/dashboard/repositories/${repo.repositoryId}/tasks`}
                    className="font-medium hover:text-primary transition-colors truncate max-w-[200px]"
                  >
                    {repo.repositoryName}
                  </Link>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {repo.taskCount} tasks
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Main bar showing total tasks */}
                <div className="w-full h-8 bg-muted rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-primary/20 transition-all duration-500 ease-out flex items-center"
                    style={{ width: `${percentage}%` }}
                  >
                    {/* Stacked status bars */}
                    <div className="absolute inset-0 flex">
                      {/* Completed */}
                      {repo.completed > 0 && (
                        <div
                          className="h-full bg-green-500/60 transition-all duration-500"
                          style={{ width: `${completedPercentage}%` }}
                          title={`Completed: ${repo.completed}`}
                        />
                      )}
                      {/* In Progress */}
                      {repo.inProgress > 0 && (
                        <div
                          className="h-full bg-blue-500/60 transition-all duration-500"
                          style={{ width: `${inProgressPercentage}%` }}
                          title={`In Progress: ${repo.inProgress}`}
                        />
                      )}
                      {/* Pending */}
                      {repo.pending > 0 && (
                        <div
                          className="h-full bg-yellow-500/60 transition-all duration-500"
                          style={{ width: `${pendingPercentage}%` }}
                          title={`Pending: ${repo.pending}`}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Status breakdown */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground pl-1">
                  {repo.pending > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                      <span>{repo.pending} pending</span>
                    </div>
                  )}
                  {repo.inProgress > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500/60" />
                      <span>{repo.inProgress} in progress</span>
                    </div>
                  )}
                  {repo.completed > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500/60" />
                      <span>{repo.completed} completed</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500/60" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500/60" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500/60" />
            <span>Completed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// "use client"

// import { TrendingUp } from "lucide-react"
// import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

// import {
//   CardFooter
// } from "@/components/ui/card"
// import {
//   ChartConfig,
//   ChartContainer,
//   ChartLegend,
//   ChartLegendContent,
//   ChartTooltip,
//   ChartTooltipContent,
// } from "@/components/ui/chart"

// export const description = "A stacked bar chart with a legend"

// const chartData = [
//   { month: "January", desktop: 186, mobile: 80 },
//   { month: "February", desktop: 305, mobile: 200 },
//   { month: "March", desktop: 237, mobile: 120 },
//   { month: "April", desktop: 73, mobile: 190 },
//   { month: "May", desktop: 209, mobile: 130 },
//   { month: "June", desktop: 214, mobile: 140 },
// ]

// const chartConfig = {
//   desktop: {
//     label: "Desktop",
//     color: "var(--chart-1)",
//   },
//   mobile: {
//     label: "Mobile",
//     color: "var(--chart-2)",
//   },
// } satisfies ChartConfig

// export function ChartBarStacked() {
//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle>Bar Chart - Stacked + Legend</CardTitle>
//         <CardDescription>January - June 2024</CardDescription>
//       </CardHeader>
//       <CardContent>
//         <ChartContainer config={chartConfig}>
//           <BarChart accessibilityLayer data={chartData}>
//             <CartesianGrid vertical={false} />
//             <XAxis
//               dataKey="month"
//               tickLine={false}
//               tickMargin={10}
//               axisLine={false}
//               tickFormatter={(value) => value.slice(0, 3)}
//             />
//             <ChartTooltip content={<ChartTooltipContent hideLabel />} />
//             <ChartLegend content={<ChartLegendContent />} />
//             <Bar
//               dataKey="desktop"
//               stackId="a"
//               fill="var(--color-desktop)"
//               radius={[0, 0, 4, 4]}
//             />
//             <Bar
//               dataKey="mobile"
//               stackId="a"
//               fill="var(--color-mobile)"
//               radius={[4, 4, 0, 0]}
//             />
//           </BarChart>
//         </ChartContainer>
//       </CardContent>
//       <CardFooter className="flex-col items-start gap-2 text-sm">
//         <div className="flex gap-2 leading-none font-medium">
//           Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
//         </div>
//         <div className="text-muted-foreground leading-none">
//           Showing total visitors for the last 6 months
//         </div>
//       </CardFooter>
//     </Card>
//   )
// }
