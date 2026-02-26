import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface TaskAnalysis {
  summary: string;
  debtScore: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        '⚠️  OPENAI_API_KEY not found. AI features will be disabled.',
      );
      this.openai = null;
    } else {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('✅ OpenAI initialized with GPT-4o-mini');
    }
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Generate AI summary and debt score for a single task
   */
  async analyzeTask(
    description: string,
    type: string,
    filePath: string,
    lineNumber: number,
    surroundingCode?: string,
  ): Promise<TaskAnalysis> {
    if (!this.isAvailable() || !this.openai) {
      this.logger.warn('AI service not available, skipping analysis');
      return {
        summary: description,
        debtScore: this.calculateBasicDebtScore(type),
      };
    }

    try {
      const prompt = this.buildTaskAnalysisPrompt(
        description,
        type,
        filePath,
        lineNumber,
        surroundingCode,
      );

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a code quality and technical debt analyzer. Respond only with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = response.choices[0]?.message?.content || '{}';

      // Parse the response (expecting JSON format)
      const analysis = this.parseAiResponse(result);

      return {
        summary: analysis.summary || description,
        debtScore: analysis.debtScore || this.calculateBasicDebtScore(type),
      };
    } catch (error) {
      this.logger.error(`Failed to analyze task: ${error.message}`);

      // Fallback to basic analysis
      return {
        summary: description,
        debtScore: this.calculateBasicDebtScore(type),
      };
    }
  }

  /**
   * Analyze multiple tasks in batch (more efficient)
   */
  async analyzeTasks(
    tasks: Array<{
      description: string;
      type: string;
      filePath: string;
      lineNumber: number;
      surroundingCode?: string;
    }>,
  ): Promise<TaskAnalysis[]> {
    if (!this.isAvailable()) {
      this.logger.warn('AI service not available, using basic analysis');
      return tasks.map((task) => ({
        summary: task.description,
        debtScore: this.calculateBasicDebtScore(task.type),
      }));
    }

    try {
      // Process in batches to avoid rate limits
      const batchSize = 5;
      const results: TaskAnalysis[] = [];

      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);

        const batchPromises = batch.map((task) =>
          this.analyzeTask(
            task.description,
            task.type,
            task.filePath,
            task.lineNumber,
            task.surroundingCode,
          ),
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add small delay between batches to respect rate limits
        if (i + batchSize < tasks.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to analyze tasks in batch: ${error.message}`);

      // Fallback to basic analysis
      return tasks.map((task) => ({
        summary: task.description,
        debtScore: this.calculateBasicDebtScore(task.type),
      }));
    }
  }

  /**
   * Build a detailed prompt for task analysis
   */
  private buildTaskAnalysisPrompt(
    description: string,
    type: string,
    filePath: string,
    lineNumber: number,
    surroundingCode?: string,
  ): string {
    return `Analyze the following code task and provide:

1. A concise summary (1-2 sentences) explaining what needs to be done and why it matters
2. A technical debt score from 0-100 where:
   - 0-20: Minor issue, cosmetic or nice-to-have
   - 21-40: Low priority, should be addressed eventually
   - 41-60: Medium priority, impacts code quality
   - 61-80: High priority, impacts functionality or maintainability
   - 81-100: Critical, security issue or major bug

Task Details:
- Type: ${type}
- Description: ${description}
- File: ${filePath}
- Line: ${lineNumber}
${surroundingCode ? `\nSurrounding Code:\n\`\`\`\n${surroundingCode}\n\`\`\`` : ''}

Return ONLY a JSON object in this exact format:
{
  "summary": "your concise summary here",
  "debtScore": numeric_score_0_to_100
}`;
  }

  /**
   * Parse AI response (handle JSON or text format)
   */
  private parseAiResponse(response: string): {
    summary?: string;
    debtScore?: number;
  } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON found, return empty object (will use fallback)
      return {};
    } catch (error) {
      this.logger.warn('Failed to parse AI response as JSON');
      return {};
    }
  }

  /**
   * Calculate basic debt score based on task type (fallback method)
   */
  private calculateBasicDebtScore(type: string): number {
    const scoreMap: Record<string, number> = {
      BUG: 75,
      FIXME: 70,
      HACK: 65,
      TODO: 40,
      NOTE: 15,
    };

    return scoreMap[type.toUpperCase()] || 30;
  }

  /**
   * Generate an AI-guided code tour for understanding code around a task
   */
  async generateCodeTour(request: {
    prompt: string;
    taskLabel: string;
    taskType: string;
    filePath: string;
    lineNumber: number;
    surroundingCode: string;
    nearestSymbol?: string;
    language: string;
  }): Promise<{
    summary: string;
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      filePath?: string;
      lineNumber?: number;
      symbolName?: string;
      relevance?: string;
    }>;
    dependencies: string[];
    risks: string[];
    suggestedChanges: string[];
  }> {
    if (!this.isAvailable() || !this.openai) {
      this.logger.warn('AI service not available, returning basic tour');
      return this.generateBasicCodeTour(request);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert code reviewer and technical guide. Your task is to help developers understand code by creating comprehensive, educational code tours.

Focus on:
- Explaining the purpose and context of the code
- Identifying the best order to read and understand related code
- Highlighting dependencies and potential risks
- Suggesting improvements without being prescriptive

IMPORTANT: You MUST respond with valid JSON matching this EXACT structure:
{
  "summary": "string - A 2-3 sentence explanation of what the TODO/task refers to",
  "steps": [
    {
      "stepNumber": 1,
      "title": "string - Short title for this step",
      "description": "string - Detailed description of what to do/review",
      "filePath": "string or null - Relative file path if applicable",
      "lineNumber": "number or null - Line number if applicable",
      "symbolName": "string or null - Function/class name if applicable",
      "relevance": "string - Why this step matters"
    }
  ],
  "dependencies": ["array of strings - External modules/services involved"],
  "risks": ["array of strings - Potential issues to be aware of"],
  "suggestedChanges": ["array of strings - Recommended code improvements"]
}

All fields are required. Use null for optional values that don't apply. Provide at least 3 steps.`,
          },
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const result = response.choices[0]?.message?.content || '{}';
      const parsed = this.parseCodeTourResponse(result);

      return {
        summary: parsed.summary || this.generateDefaultSummary(request),
        steps: parsed.steps || this.generateDefaultSteps(request),
        dependencies: parsed.dependencies || [],
        risks: parsed.risks || [],
        suggestedChanges: parsed.suggestedChanges || [],
      };
    } catch (error) {
      this.logger.error(`Failed to generate code tour: ${error.message}`);
      return this.generateBasicCodeTour(request);
    }
  }

  /**
   * Parse the code tour response from AI and validate structure
   */
  private parseCodeTourResponse(response: string): {
    summary?: string;
    steps?: Array<{
      stepNumber: number;
      title: string;
      description: string;
      filePath?: string;
      lineNumber?: number;
      symbolName?: string;
      relevance?: string;
    }>;
    dependencies?: string[];
    risks?: string[];
    suggestedChanges?: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {};
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response structure
      const result: {
        summary?: string;
        steps?: Array<{
          stepNumber: number;
          title: string;
          description: string;
          filePath?: string;
          lineNumber?: number;
          symbolName?: string;
          relevance?: string;
        }>;
        dependencies?: string[];
        risks?: string[];
        suggestedChanges?: string[];
      } = {};

      // Validate summary
      if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
        result.summary = parsed.summary.trim();
      }

      // Validate and normalize steps
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        result.steps = parsed.steps
          .filter(
            (step: unknown) =>
              step &&
              typeof step === 'object' &&
              typeof (step as Record<string, unknown>).title === 'string' &&
              typeof (step as Record<string, unknown>).description === 'string',
          )
          .map((step: Record<string, unknown>, index: number) => ({
            stepNumber:
              typeof step.stepNumber === 'number' ? step.stepNumber : index + 1,
            title: String(step.title),
            description: String(step.description),
            filePath:
              typeof step.filePath === 'string' ? step.filePath : undefined,
            lineNumber:
              typeof step.lineNumber === 'number' ? step.lineNumber : undefined,
            symbolName:
              typeof step.symbolName === 'string' ? step.symbolName : undefined,
            relevance:
              typeof step.relevance === 'string' ? step.relevance : undefined,
          }));
      }

      // Validate arrays
      if (Array.isArray(parsed.dependencies)) {
        result.dependencies = parsed.dependencies.filter(
          (d: unknown) => typeof d === 'string',
        );
      }
      if (Array.isArray(parsed.risks)) {
        result.risks = parsed.risks.filter(
          (r: unknown) => typeof r === 'string',
        );
      }
      if (Array.isArray(parsed.suggestedChanges)) {
        result.suggestedChanges = parsed.suggestedChanges.filter(
          (s: unknown) => typeof s === 'string',
        );
      }

      return result;
    } catch (error) {
      this.logger.warn('Failed to parse code tour response as JSON');
      return {};
    }
  }

  /**
   * Generate a basic code tour when AI is unavailable
   */
  private generateBasicCodeTour(request: {
    taskLabel: string;
    taskType: string;
    filePath: string;
    lineNumber: number;
    nearestSymbol?: string;
  }): {
    summary: string;
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      filePath?: string;
      lineNumber?: number;
      symbolName?: string;
      relevance?: string;
    }>;
    dependencies: string[];
    risks: string[];
    suggestedChanges: string[];
  } {
    return {
      summary: this.generateDefaultSummary(request),
      steps: this.generateDefaultSteps(request),
      dependencies: [],
      risks: [
        'Always review the full context before making changes.',
        'Run tests after any modifications.',
      ],
      suggestedChanges: [
        'Understand the code thoroughly before implementing changes.',
        'Consider writing tests for the expected behavior.',
      ],
    };
  }

  /**
   * Generate a default summary for the code tour
   */
  private generateDefaultSummary(request: {
    taskLabel: string;
    taskType: string;
    filePath: string;
    lineNumber: number;
  }): string {
    const typeDescriptions: Record<string, string> = {
      todo: 'This TODO comment indicates planned work that needs to be completed.',
      fixme:
        'This FIXME comment highlights a known issue that requires attention.',
      hack: 'This HACK comment marks a temporary workaround that should be properly addressed.',
    };

    const baseDesc =
      typeDescriptions[request.taskType.toLowerCase()] ||
      'This comment marks code that needs attention.';

    return `${baseDesc}\n\nTask: "${request.taskLabel}"\nLocation: ${request.filePath}:${request.lineNumber}`;
  }

  /**
   * Generate default steps for the code tour
   */
  private generateDefaultSteps(request: {
    taskLabel: string;
    filePath: string;
    lineNumber: number;
    nearestSymbol?: string;
  }): Array<{
    stepNumber: number;
    title: string;
    description: string;
    filePath?: string;
    lineNumber?: number;
    symbolName?: string;
    relevance?: string;
  }> {
    type TourStep = {
      stepNumber: number;
      title: string;
      description: string;
      filePath?: string;
      lineNumber?: number;
      symbolName?: string;
      relevance?: string;
    };

    const steps: TourStep[] = [
      {
        stepNumber: 1,
        title: 'Review the Task',
        description:
          'Start by reading the task comment to understand what needs to be done.',
        filePath: request.filePath,
        lineNumber: request.lineNumber,
        relevance: 'This is the source of the task.',
      },
    ];

    if (request.nearestSymbol) {
      steps.push({
        stepNumber: 2,
        title: `Understand ${request.nearestSymbol}`,
        description: `Review the ${request.nearestSymbol} to understand the context of this task.`,
        filePath: request.filePath,
        symbolName: request.nearestSymbol,
        relevance: 'Understanding the surrounding code is essential.',
      });
    }

    steps.push({
      stepNumber: steps.length + 1,
      title: 'Find Related Code',
      description:
        'Search for usages and references to understand the impact of changes.',
      relevance: 'Helps prevent unintended side effects.',
    });

    steps.push({
      stepNumber: steps.length + 1,
      title: 'Check Tests',
      description: 'Review existing tests to understand expected behavior.',
      relevance: 'Tests document the expected functionality.',
    });

    return steps;
  }
}
