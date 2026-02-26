import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/tasks.entity';
import { Repository as RepoEntity } from '../repositories/entities/repository.entity';
import { AiService } from '../ai/ai.service';
import {
  AiInsightsResponse,
  CategoryBreakdown,
  DebtTrendPoint,
  HighRiskTask,
  ProjectHealthSummary,
  Recommendation,
  SprintProgress,
} from './dto/ai-insights.dto';

// TODO: This code has not been read or reviewed fully

// ── Category classification rules ──

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  bug: [
    'bug',
    'fix',
    'error',
    'crash',
    'broken',
    'fail',
    'issue',
    'defect',
    'fault',
    'incorrect',
  ],
  security: [
    'security',
    'auth',
    'xss',
    'csrf',
    'inject',
    'sanitize',
    'escape',
    'vulnerability',
    'secret',
    'token',
    'password',
    'encrypt',
  ],
  performance: [
    'perf',
    'slow',
    'optimize',
    'cache',
    'memory',
    'leak',
    'latency',
    'speed',
    'bottleneck',
    'n+1',
  ],
  refactor: [
    'refactor',
    'clean',
    'restructure',
    'simplify',
    'decouple',
    'extract',
    'rename',
    'move',
    'split',
    'merge',
    'technical debt',
    'ugly',
    'hack',
    'workaround',
    'temp',
    'temporary',
  ],
  documentation: [
    'doc',
    'comment',
    'readme',
    'explain',
    'describe',
    'jsdoc',
    'tsdoc',
    'typedoc',
    'document',
  ],
  feature: [
    'feature',
    'implement',
    'add',
    'support',
    'enable',
    'create',
    'build',
    'integrate',
    'enhance',
    'extend',
  ],
};

function classifyTask(task: Task): string {
  const text = `${task.description} ${task.type}`.toLowerCase();

  // Type-based fast-path
  if (task.type === 'BUG') return 'bug';
  if (task.type === 'HACK') return 'refactor';

  // Keyword scoring
  let bestCategory = 'other';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce(
      (s, kw) => s + (text.includes(kw) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

// ── Helpers ──

function daysBetween(a: Date, b: Date): number {
  return Math.floor(
    Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24),
  );
}

function healthLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Needs Attention';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

  constructor(
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(RepoEntity)
    private readonly repoRepo: Repository<RepoEntity>,
    private readonly aiService: AiService,
  ) {}

  /**
   * Build the full AI Insights response for a user, optionally filtered to one repo.
   */
  async getInsights(
    userId: string,
    repositoryId?: string,
  ): Promise<AiInsightsResponse> {
    const tasks = await this.fetchTasks(userId, repositoryId);

    const now = new Date();

    const categories = this.buildCategories(tasks);
    const highRiskTasks = this.buildHighRiskTasks(tasks, now);
    const projectHealth = this.buildProjectHealth(tasks);
    const sprintProgress = this.buildSprintProgress(tasks, now);
    const debtTrend = this.buildDebtTrend(tasks, now);
    const recommendations = this.buildRecommendations(tasks, now);

    // Generate AI narrative if service is available
    let aiNarrativeSummary: string | null = null;
    if (this.aiService.isAvailable()) {
      aiNarrativeSummary = await this.generateNarrative(
        projectHealth,
        sprintProgress,
        categories,
        highRiskTasks,
        recommendations,
      );
    }

    return {
      generatedAt: now.toISOString(),
      debtTrend,
      categories,
      highRiskTasks,
      projectHealth,
      sprintProgress,
      recommendations,
      aiNarrativeSummary,
    };
  }

  // ─── Data fetching ───

  private async fetchTasks(
    userId: string,
    repositoryId?: string,
  ): Promise<Task[]> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.repository', 'repository')
      .where('repository.userId = :userId', { userId });

    if (repositoryId) {
      qb.andWhere('repository.id = :repositoryId', { repositoryId });
    }

    return qb.getMany();
  }

  // ─── Category breakdown ───

  private buildCategories(tasks: Task[]): CategoryBreakdown[] {
    const buckets: Record<string, { count: number; totalDebt: number }> = {};

    for (const task of tasks) {
      const cat = classifyTask(task);
      if (!buckets[cat]) buckets[cat] = { count: 0, totalDebt: 0 };
      buckets[cat].count++;
      buckets[cat].totalDebt += task.debt_score ?? 0;
    }

    const total = tasks.length || 1;

    return Object.entries(buckets)
      .map(([category, { count, totalDebt }]) => ({
        category,
        count,
        avgDebtScore: Math.round((totalDebt / count) * 10) / 10,
        percentage: Math.round((count / total) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // ─── High-risk tasks ───

  private buildHighRiskTasks(tasks: Task[], now: Date): HighRiskTask[] {
    return (
      tasks
        .filter((t) => t.status !== 'completed' && t.status !== 'done')
        .map((t) => {
          const ageInDays = t.addedAt
            ? daysBetween(new Date(t.addedAt), now)
            : 0;
          const debtScore = t.debt_score ?? 0;

          // Composite risk = 60% debt score + 40% age factor (capped at 100)
          const ageFactor = Math.min(ageInDays / 90, 1) * 100;
          const riskScore = debtScore * 0.6 + ageFactor * 0.4;

          const reasons: string[] = [];
          if (debtScore >= 70) reasons.push('high debt score');
          if (ageInDays > 60) reasons.push(`open for ${ageInDays} days`);
          if (t.type === 'BUG' || t.type === 'FIXME')
            reasons.push(`${t.type} marker`);
          if (reasons.length === 0) reasons.push('elevated combined risk');

          return {
            id: t.id,
            description: t.description,
            type: t.type,
            filePath: t.filePath,
            lineNumber: t.lineNumber,
            debtScore,
            ageInDays,
            addedBy: t.addedBy,
            repositoryName: t.repository?.name ?? 'unknown',
            riskReason: reasons.join('; '),
            _riskScore: riskScore,
          };
        })
        .sort((a, b) => b._riskScore - a._riskScore)
        .slice(0, 15)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ _riskScore, ...rest }) => rest)
    );
  }

  // ─── Project health ───

  private buildProjectHealth(tasks: Task[]): ProjectHealthSummary {
    const openTasksList = tasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'done',
    );
    const completedTasksList = tasks.filter(
      (t) => t.status === 'completed' || t.status === 'done',
    );
    const openTasks = openTasksList.length;
    const completedTasks = completedTasksList.length;
    const total = tasks.length;

    // Average debt score across ALL tasks (displayed metric)
    const avgDebtScore =
      total > 0
        ? Math.round(tasks.reduce((s, t) => s + (t.debt_score ?? 0), 0) / total)
        : 0;

    // ── Health score heuristic (higher = healthier) ──
    // Uses multiple weighted signals for a more accurate picture:
    //   1. Open-task debt severity (35%) — only unresolved debt matters
    //   2. Completion ratio (25%) — proportion of tasks resolved
    //   3. Critical issue density (25%) — high-debt open items relative to total
    //   4. Resolution momentum (15%) — recent completions show active maintenance

    // 1. Open-task debt factor: avg debt of OPEN tasks only (resolved debt is irrelevant)
    const avgOpenDebt =
      openTasks > 0
        ? openTasksList.reduce((s, t) => s + (t.debt_score ?? 0), 0) / openTasks
        : 0;
    const openDebtFactor = 1 - Math.min(avgOpenDebt / 100, 1); // 0-1, higher = healthier

    // 2. Completion ratio (with diminishing returns so fresh scans aren't punished)
    //    Uses sqrt to soften the penalty: 50% completion → 0.71 instead of 0.50
    const completionRatio = total > 0 ? completedTasks / total : 1;
    const completionFactor = Math.sqrt(completionRatio);

    // 3. Critical issue density: % of open tasks with high debt (≥70)
    const criticalOpen = openTasksList.filter(
      (t) => (t.debt_score ?? 0) >= 70,
    ).length;
    const criticalDensity = total > 0 ? criticalOpen / total : 0;
    const criticalFactor = 1 - Math.min(criticalDensity * 5, 1); // 20%+ critical → 0

    // 4. Resolution momentum: ratio of recently resolved tasks (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentlyResolved = completedTasksList.filter(
      (t) => t.completedAt && new Date(t.completedAt) >= thirtyDaysAgo,
    ).length;
    const momentumFactor =
      total > 0 ? Math.min(recentlyResolved / Math.max(openTasks, 1), 1) : 1;

    const score = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          openDebtFactor * 35 +
            completionFactor * 25 +
            criticalFactor * 25 +
            momentumFactor * 15,
        ),
      ),
    );

    // Top contributors
    const contributors: Record<string, { added: number; resolved: number }> =
      {};
    for (const t of tasks) {
      if (t.addedBy) {
        if (!contributors[t.addedBy])
          contributors[t.addedBy] = { added: 0, resolved: 0 };
        contributors[t.addedBy].added++;
      }
      if (t.completedBy) {
        if (!contributors[t.completedBy])
          contributors[t.completedBy] = { added: 0, resolved: 0 };
        contributors[t.completedBy].resolved++;
      }
    }

    const topContributors = Object.entries(contributors)
      .map(([username, { added, resolved }]) => ({
        username,
        tasksAdded: added,
        tasksResolved: resolved,
      }))
      .sort(
        (a, b) =>
          b.tasksAdded + b.tasksResolved - (a.tasksAdded + a.tasksResolved),
      )
      .slice(0, 5);

    return {
      score,
      label: healthLabel(score),
      totalTasks: total,
      openTasks,
      completedTasks,
      avgDebtScore,
      topContributors,
    };
  }

  // ─── Sprint progress (last 14 days) ───

  private buildSprintProgress(tasks: Task[], now: Date): SprintProgress {
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentlyAdded = tasks.filter(
      (t) => t.addedAt && new Date(t.addedAt) >= fourteenDaysAgo,
    ).length;

    const recentlyResolved = tasks.filter(
      (t) => t.completedAt && new Date(t.completedAt) >= fourteenDaysAgo,
    ).length;

    // Velocity: tasks resolved in last 30 days, expressed per week
    const resolvedLast30 = tasks.filter(
      (t) => t.completedAt && new Date(t.completedAt) >= thirtyDaysAgo,
    ).length;
    const velocity = Math.round((resolvedLast30 / 30) * 7 * 10) / 10;

    return {
      recentlyAdded,
      recentlyResolved,
      netChange: recentlyAdded - recentlyResolved,
      velocity,
    };
  }

  // ─── Debt trend (last 90 days, weekly buckets) ───

  private buildDebtTrend(tasks: Task[], now: Date): DebtTrendPoint[] {
    const points: DebtTrendPoint[] = [];
    const weeks = 12; // ~90 days

    for (let w = weeks - 1; w >= 0; w--) {
      const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Tasks that existed (added before weekEnd and not yet completed, or completed after weekStart)
      const openAtEnd = tasks.filter((t) => {
        const added = t.addedAt ? new Date(t.addedAt) : new Date(0);
        const completed = t.completedAt ? new Date(t.completedAt) : null;
        return added <= weekEnd && (!completed || completed > weekEnd);
      });

      const closedInWeek = tasks.filter((t) => {
        if (!t.completedAt) return false;
        const completed = new Date(t.completedAt);
        return completed >= weekStart && completed <= weekEnd;
      });

      const avgDebt =
        openAtEnd.length > 0
          ? Math.round(
              openAtEnd.reduce((s, t) => s + (t.debt_score ?? 0), 0) /
                openAtEnd.length,
            )
          : 0;

      points.push({
        date: weekEnd.toISOString().slice(0, 10),
        openTasks: openAtEnd.length,
        closedTasks: closedInWeek.length,
        avgDebtScore: avgDebt,
      });
    }

    return points;
  }

  // ─── Rule-based recommendations ───

  private buildRecommendations(tasks: Task[], now: Date): Recommendation[] {
    const recommendations: Recommendation[] = [];
    let id = 0;

    const openTasks = tasks.filter(
      (t) => t.status !== 'completed' && t.status !== 'done',
    );

    // 1. Stale high-debt tasks
    const staleCritical = openTasks.filter(
      (t) =>
        (t.debt_score ?? 0) >= 70 &&
        t.addedAt &&
        daysBetween(new Date(t.addedAt), now) > 30,
    );
    if (staleCritical.length > 0) {
      recommendations.push({
        id: `rec-${++id}`,
        severity: 'critical',
        title: `${staleCritical.length} high-debt task${staleCritical.length > 1 ? 's' : ''} unresolved for 30+ days`,
        description:
          'These tasks have a debt score ≥ 70 and have been open for over a month. Prioritize them to prevent technical debt accumulation.',
        affectedFiles: [...new Set(staleCritical.map((t) => t.filePath))].slice(
          0,
          10,
        ),
        taskIds: staleCritical.map((t) => t.id).slice(0, 10),
      });
    }

    // 2. Security-related tasks
    const securityTasks = openTasks.filter(
      (t) => classifyTask(t) === 'security',
    );
    if (securityTasks.length > 0) {
      recommendations.push({
        id: `rec-${++id}`,
        severity: 'critical',
        title: `${securityTasks.length} open security-related task${securityTasks.length > 1 ? 's' : ''} detected`,
        description:
          'Security TODOs/FIXMEs indicate potential vulnerabilities. Address these before shipping to production.',
        affectedFiles: [...new Set(securityTasks.map((t) => t.filePath))].slice(
          0,
          10,
        ),
        taskIds: securityTasks.map((t) => t.id).slice(0, 10),
      });
    }

    // 3. File hotspots — files with many open tasks
    const fileCounts: Record<string, Task[]> = {};
    for (const t of openTasks) {
      if (!fileCounts[t.filePath]) fileCounts[t.filePath] = [];
      fileCounts[t.filePath].push(t);
    }
    const hotspots = Object.entries(fileCounts)
      .filter(([, v]) => v.length >= 5)
      .sort((a, b) => b[1].length - a[1].length);

    if (hotspots.length > 0) {
      recommendations.push({
        id: `rec-${++id}`,
        severity: 'warning',
        title: `${hotspots.length} file${hotspots.length > 1 ? 's' : ''} with 5+ open tasks — possible tech-debt hotspots`,
        description:
          'Concentrated code issues suggest these files need refactoring. Consider scheduling a dedicated cleanup sprint.',
        affectedFiles: hotspots.map(([f]) => f).slice(0, 10),
        taskIds: hotspots.flatMap(([, v]) => v.map((t) => t.id)).slice(0, 20),
      });
    }

    // 4. Growing backlog
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const addedRecent = tasks.filter(
      (t) => t.addedAt && new Date(t.addedAt) >= twoWeeksAgo,
    ).length;
    const resolvedRecent = tasks.filter(
      (t) => t.completedAt && new Date(t.completedAt) >= twoWeeksAgo,
    ).length;
    if (addedRecent > resolvedRecent * 1.5 && addedRecent > 3) {
      recommendations.push({
        id: `rec-${++id}`,
        severity: 'warning',
        title: 'Task backlog is growing faster than resolution rate',
        description: `In the last 2 weeks, ${addedRecent} tasks were added but only ${resolvedRecent} resolved. Consider allocating more time for debt reduction.`,
        affectedFiles: [],
        taskIds: [],
      });
    }

    // 5. No recent activity
    if (addedRecent === 0 && resolvedRecent === 0 && tasks.length > 0) {
      recommendations.push({
        id: `rec-${++id}`,
        severity: 'info',
        title: 'No task activity in the last 2 weeks',
        description:
          'No tasks were added or resolved recently. Ensure scans are running and the team is maintaining code annotations.',
        affectedFiles: [],
        taskIds: [],
      });
    }

    // 6. HACKs still present
    const hacks = openTasks.filter((t) => t.type === 'HACK');
    if (hacks.length >= 3) {
      recommendations.push({
        id: `rec-${++id}`,
        severity: 'warning',
        title: `${hacks.length} HACK markers still in codebase`,
        description:
          'HACK comments typically indicate temporary workarounds that should be replaced with proper implementations.',
        affectedFiles: [...new Set(hacks.map((t) => t.filePath))].slice(0, 10),
        taskIds: hacks.map((t) => t.id).slice(0, 10),
      });
    }

    return recommendations.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    });
  }

  // ─── AI narrative ───

  private async generateNarrative(
    health: ProjectHealthSummary,
    sprint: SprintProgress,
    categories: CategoryBreakdown[],
    highRisk: HighRiskTask[],
    recommendations: Recommendation[],
  ): Promise<string | null> {
    try {
      const prompt = `You are a senior engineering advisor. Given the following codebase metrics, write a concise 3-4 paragraph developer-friendly summary covering project health, recent progress, key risks, and one actionable next step.

Metrics:
- Health score: ${health.score}/100 (${health.label})
- Open tasks: ${health.openTasks}, Completed: ${health.completedTasks}, Total: ${health.totalTasks}
- Average debt score: ${health.avgDebtScore}/100
- Sprint (14d): +${sprint.recentlyAdded} added, -${sprint.recentlyResolved} resolved (net ${sprint.netChange > 0 ? '+' : ''}${sprint.netChange})
- Weekly velocity: ${sprint.velocity} tasks/week
- Categories: ${categories.map((c) => `${c.category}(${c.count})`).join(', ')}
- High-risk items: ${highRisk.length} (top: ${
        highRisk
          .slice(0, 3)
          .map((t) => `"${t.description.slice(0, 50)}"`)
          .join(', ') || 'none'
      })
- Recommendations: ${recommendations.map((r) => `[${r.severity}] ${r.title}`).join('; ') || 'none'}

Keep the tone professional but approachable. Use concrete numbers. No bullet lists — write in paragraphs.`;

      // Use the internal AI service's OpenAI instance indirectly by calling analyzeTask
      // with a special wrapper. Since AiService exposes only analyzeTask/analyzeTasks,
      // we'll add a dedicated call via the generateNarrative method below.
      return await this.callOpenAi(prompt);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI narrative generation failed: ${message}`);
      return null;
    }
  }

  /**
   * Internal: call OpenAI through AiService's exposed interface.
   * We leverage analyzeTask but only use the summary field.
   */
  private async callOpenAi(prompt: string): Promise<string | null> {
    if (!this.aiService.isAvailable()) return null;

    // Use analyzeTask as a passthrough — the summary will contain our narrative
    const result = await this.aiService.analyzeTask(
      prompt,
      'NOTE',
      'project-overview',
      0,
    );
    // The AI service returns the summary, which in this case is our narrative
    return result.summary !== prompt ? result.summary : null;
  }
}
