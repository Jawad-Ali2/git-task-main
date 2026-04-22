'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BarChart3 } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const STATUS_COLORS = {
  open: '#f59e0b',
  'in-progress': '#3b82f6',
  done: '#22c55e',
  pending: '#f59e0b',
  completed: '#22c55e',
};

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const TYPE_COLORS = ['#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#84cc16'];

export function DashboardAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/tasks');
      const tasks = response.data || [];

      // Calculate analytics
      const byStatus: Record<string, number> = {
        pending: 0,
        'in-progress': 0,
        completed: 0,
      };
      const byPriority: Record<string, number> = {
        high: 0,
        medium: 0,
        low: 0,
      };
      const byType: Record<string, number> = {};

      tasks.forEach((task: any) => {
        // Count by status
        const status = task.status || 'pending';
        if (status === 'in_progress') {
          byStatus['in-progress']++;
        } else if (status === 'completed' || status === 'done') {
          byStatus.completed++;
        } else {
          byStatus.pending++;
        }

        // Count by priority
        const priority = task.priority || 'medium';
        byPriority[priority] = (byPriority[priority] || 0) + 1;

        // Count by type
        const type = task.type || 'TODO';
        byType[type] = (byType[type] || 0) + 1;
      });

      setData({ byStatus, byPriority, byType });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics Overview
          </CardTitle>
          <CardDescription>Task distribution and metrics</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const statusData = [
    { name: 'Pending', value: data.byStatus.pending, fill: STATUS_COLORS.pending },
    { name: 'In Progress', value: data.byStatus['in-progress'], fill: STATUS_COLORS['in-progress'] },
    { name: 'Completed', value: data.byStatus.completed, fill: STATUS_COLORS.done },
  ].filter(item => item.value > 0);

  const priorityData = [
    { name: 'High', value: data.byPriority.high, fill: PRIORITY_COLORS.high },
    { name: 'Medium', value: data.byPriority.medium, fill: PRIORITY_COLORS.medium },
    { name: 'Low', value: data.byPriority.low, fill: PRIORITY_COLORS.low },
  ].filter(item => item.value > 0);

  const typeData = Object.entries(data.byType)
    .map(([name, value], index) => ({
      name: name.toUpperCase(),
      value,
      fill: TYPE_COLORS[index % TYPE_COLORS.length],
    }))
    .filter((item: any) => item.value > 0);

  return (
    <div className="space-y-6">
      {/* <h2 className="text-lg font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        Analytics Overview
      </h2> */}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Status Distribution */}
        {statusData.length > 0 && (
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-sm">Tasks by Status</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={55}
                      dataKey="value"
                      labelLine={false}
                      label={false}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} tasks`} />
                    <Legend verticalAlign="bottom" height={18} iconType="circle" wrapperStyle={{ paddingTop: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Priority Distribution */}
        {priorityData.length > 0 && (
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-sm">Tasks by Priority</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={priorityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={55}
                      dataKey="value"
                      labelLine={false}
                      label={false}
                    >
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} tasks`} />
                    <Legend verticalAlign="bottom" height={18} iconType="circle" wrapperStyle={{ paddingTop: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Type Distribution */}
        {typeData.length > 0 && (
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-sm">Tasks by Type</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={typeData}
                    layout="vertical"
                    margin={{ left: 25, right: 8, top: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={32} fontSize={11} />
                    <Tooltip formatter={(value) => `${value} tasks`} />
                    <Bar dataKey="value" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
