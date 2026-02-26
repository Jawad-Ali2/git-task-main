'use client';

import { ShieldAlert, AlertTriangle, Info, Lightbulb, FileCode } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Recommendation } from '@/redux/aiInsightsSlice';

interface Props {
  recommendations: Recommendation[];
}

const severityConfig: Record<string, { icon: typeof ShieldAlert; color: string; badgeVariant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  critical: { icon: ShieldAlert, color: 'text-red-500', badgeVariant: 'destructive' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', badgeVariant: 'secondary' },
  info: { icon: Info, color: 'text-blue-500', badgeVariant: 'outline' },
};

export function RecommendationsList({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No actionable recommendations at this time.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          Recommendations
        </CardTitle>
        <CardDescription>Actionable insights based on rule-based and AI analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {recommendations.map((rec) => {
            const cfg = severityConfig[rec.severity] ?? severityConfig.info;
            const Icon = cfg.icon;

            return (
              <AccordionItem key={rec.id} value={rec.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 text-left">
                    <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                    <Badge variant={cfg.badgeVariant} className="text-xs shrink-0">
                      {rec.severity}
                    </Badge>
                    <span className="text-sm font-medium">{rec.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                  {rec.affectedFiles.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1 flex items-center gap-1">
                        <FileCode className="h-3 w-3" /> Affected files
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {rec.affectedFiles.map((f) => (
                          <code
                            key={f}
                            className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono"
                          >
                            {f.split('/').slice(-2).join('/')}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
