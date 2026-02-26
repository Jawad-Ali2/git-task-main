'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchAiInsights,
  selectAiInsights,
  selectAiInsightsLoading,
  selectAiInsightsError,
} from '@/redux/aiInsightsSlice';
import {
  fetchRepositories,
  selectRepositories,
} from '@/redux/repositoriesSlice';
import { BrainCircuit, Loader2, RefreshCw } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HealthScoreCard,
  SprintProgressCard,
  DebtTrendChart,
  CategoryChart,
  HighRiskTaskList,
  RecommendationsList,
  AiNarrativeCard,
} from '@/components/dashboard/ai-insights';

const ALL_REPOS = '__all__';

export default function AiInsightsPage() {
  const dispatch = useAppDispatch();
  const data = useAppSelector(selectAiInsights);
  const loading = useAppSelector(selectAiInsightsLoading);
  const error = useAppSelector(selectAiInsightsError);
  const repositories = useAppSelector(selectRepositories);
  const [selectedRepo, setSelectedRepo] = useState<string>(ALL_REPOS);

  useEffect(() => {
    dispatch(fetchRepositories());
  }, [dispatch]);

  useEffect(() => {
    const repositoryId = selectedRepo === ALL_REPOS ? undefined : selectedRepo;
    dispatch(fetchAiInsights({ repositoryId }));
  }, [dispatch, selectedRepo]);

  const handleRefresh = () => {
    const repositoryId = selectedRepo === ALL_REPOS ? undefined : selectedRepo;
    dispatch(fetchAiInsights({ repositoryId, force: true }));
  };

  const handleRepoChange = (value: string) => {
    setSelectedRepo(value);
  };

  // ── Loading state ──
  if (loading && !data) {
    return (
      <EmptyState
        loading
        loadingText="Analyzing your codebase — this may take a moment..."
        title=""
      />
    );
  }

  // ── Error state ──
  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Insights" description="AI-powered technical debt analysis" />
        <EmptyState
          icon={BrainCircuit}
          title="Unable to load insights"
          description={error}
          action={{ label: 'Retry', onClick: handleRefresh }}
        />
      </div>
    );
  }

  // ── Empty state ──
  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Insights" description="AI-powered technical debt analysis" />
        <EmptyState
          icon={BrainCircuit}
          title="No insights available"
          description="Scan your repositories first to generate AI insights about your codebase."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="AI Insights" description="AI-powered technical debt analysis">
        <div className="flex items-center gap-2">
          <Select value={selectedRepo} onValueChange={handleRepoChange}>
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue placeholder="All repositories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_REPOS}>All repositories</SelectItem>
              {repositories.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </PageHeader>

      {/* AI Narrative (full-width) */}
      <AiNarrativeCard summary={data.aiNarrativeSummary} />

      {/* Health + Sprint — side by side */}
      <div className="grid gap-4 md:grid-cols-2">
        <HealthScoreCard health={data.projectHealth} />
        <SprintProgressCard sprint={data.sprintProgress} />
      </div>

      {/* Debt trend chart (full-width) */}
      <DebtTrendChart data={data.debtTrend} />

      {/* Categories + High-risk — side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryChart categories={data.categories} />
        <HighRiskTaskList tasks={data.highRiskTasks} />
      </div>

      {/* Recommendations (full-width) */}
      <RecommendationsList recommendations={data.recommendations} />

      {/* Generation timestamp */}
      <p className="text-xs text-muted-foreground text-right">
        Generated at {new Date(data.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
