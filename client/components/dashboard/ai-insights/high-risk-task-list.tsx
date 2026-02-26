'use client';

import { AlertTriangle, Clock, FileCode } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { HighRiskTask } from '@/redux/aiInsightsSlice';

interface Props {
  tasks: HighRiskTask[];
}

const TYPE_VARIANT: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  BUG: 'destructive',
  FIXME: 'destructive',
  HACK: 'secondary',
  TODO: 'outline',
  NOTE: 'outline',
};

export function HighRiskTaskList({ tasks }: Props) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            High-Risk Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No high-risk tasks detected — looking good!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          High-Risk Tasks
        </CardTitle>
        <CardDescription>Tasks ranked by composite risk score (debt + age)</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y">
            {tasks.map((t) => (
              <div key={t.id} className="px-6 py-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={TYPE_VARIANT[t.type] ?? 'outline'} className="text-xs">
                        {t.type}
                      </Badge>
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {t.repositoryName}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-snug line-clamp-2">{t.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileCode className="h-3 w-3" />
                        {t.filePath.split('/').slice(-2).join('/')}:{t.lineNumber}
                      </span>
                      {t.addedBy && (
                        <span>by {t.addedBy}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {t.ageInDays}d old
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold">{t.debtScore}</p>
                    <p className="text-xs text-muted-foreground">debt</p>
                  </div>
                </div>
                <p className="text-xs text-orange-500 mt-1">{t.riskReason}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
