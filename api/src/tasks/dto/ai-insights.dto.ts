import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AiInsightsQueryDto {
  @ApiPropertyOptional({ description: 'Filter insights by repository ID' })
  @IsOptional()
  @IsUUID()
  repositoryId?: string;
}

// ── Response shapes ──

export interface DebtTrendPoint {
  date: string; // ISO date (day)
  openTasks: number;
  closedTasks: number;
  avgDebtScore: number;
}

export interface CategoryBreakdown {
  category: string; // bug | refactor | feature | performance | security | documentation | other
  count: number;
  avgDebtScore: number;
  percentage: number;
}

export interface HighRiskTask {
  id: string;
  description: string;
  type: string;
  filePath: string;
  lineNumber: number;
  debtScore: number;
  ageInDays: number;
  addedBy: string | null;
  repositoryName: string;
  riskReason: string;
}

export interface ProjectHealthSummary {
  score: number; // 0-100
  label: string; // Healthy | Needs Attention | At Risk | Critical
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
  avgDebtScore: number;
  topContributors: {
    username: string;
    tasksAdded: number;
    tasksResolved: number;
  }[];
}

export interface SprintProgress {
  recentlyAdded: number; // last 14 days
  recentlyResolved: number;
  netChange: number;
  velocity: number; // avg resolved per week over last 30 days
}

export interface Recommendation {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  affectedFiles: string[];
  taskIds: string[];
}

export interface AiInsightsResponse {
  generatedAt: string;
  debtTrend: DebtTrendPoint[];
  categories: CategoryBreakdown[];
  highRiskTasks: HighRiskTask[];
  projectHealth: ProjectHealthSummary;
  sprintProgress: SprintProgress;
  recommendations: Recommendation[];
  aiNarrativeSummary: string | null; // GPT generated overview (null when AI unavailable)
}
