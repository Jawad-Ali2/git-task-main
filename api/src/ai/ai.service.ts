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
      this.logger.warn('⚠️  OPENAI_API_KEY not found. AI features will be disabled.');
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
    surroundingCode?: string
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
        surroundingCode
      );

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a code quality and technical debt analyzer. Respond only with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
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
    }>
  ): Promise<TaskAnalysis[]> {
    if (!this.isAvailable()) {
      this.logger.warn('AI service not available, using basic analysis');
      return tasks.map(task => ({
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
        
        const batchPromises = batch.map(task =>
          this.analyzeTask(
            task.description,
            task.type,
            task.filePath,
            task.lineNumber,
            task.surroundingCode
          )
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Add small delay between batches to respect rate limits
        if (i + batchSize < tasks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to analyze tasks in batch: ${error.message}`);
      
      // Fallback to basic analysis
      return tasks.map(task => ({
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
    surroundingCode?: string
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
  private parseAiResponse(response: string): { summary?: string; debtScore?: number } {
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
      'BUG': 75,
      'FIXME': 70,
      'HACK': 65,
      'TODO': 40,
      'NOTE': 15,
    };

    return scoreMap[type.toUpperCase()] || 30;
  }
}
