'use client';

import { Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface Props {
  summary: string | null;
}

export function AiNarrativeCard({ summary }: Props) {
  if (!summary) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            AI Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            AI narrative is unavailable. Ensure your OpenAI API key is configured to enable AI-generated summaries.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-linear-to-br from-background to-muted/30 border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-primary" />
          AI Summary
        </CardTitle>
        <CardDescription>GPT-generated overview of your codebase health</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {summary.split('\n\n').map((paragraph, i) => (
            <p key={i} className="text-sm leading-relaxed text-foreground/90">
              {paragraph}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
