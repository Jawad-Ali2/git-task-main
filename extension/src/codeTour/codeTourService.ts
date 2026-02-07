import * as vscode from 'vscode';
import {
  CodeTour,
  CodeTourResponse,
  TaskContext,
} from './codeTourTypes';

// Cache TTL: 1 hour in milliseconds
const CACHE_TTL_MS = 60 * 60 * 1000;

// Storage key prefix for code tours
const STORAGE_KEY_PREFIX = 'gittask.codeTour.';

/**
 * Service for generating and caching AI-guided code tours
 */
export class CodeTourService {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly apiBaseUrl: string = 'http://localhost:3001'
  ) {}

  /**
   * Generate or retrieve a cached code tour for a task
   */
  async getCodeTour(taskContext: TaskContext): Promise<CodeTour> {
    const cacheKey = this.getCacheKey(taskContext);
    
    // Check for cached tour
    const cachedTour = this.getCachedTour(cacheKey);
    if (cachedTour) {
      return cachedTour;
    }

    // Generate new tour
    const tour = await this.generateCodeTour(taskContext);
    
    // Cache the tour
    this.cacheTour(cacheKey, tour);
    
    return tour;
  }

  /**
   * Get a cached tour if it exists and is still valid
   */
  private getCachedTour(cacheKey: string): CodeTour | undefined {
    const cached = this.context.globalState.get<CodeTour>(cacheKey);
    
    if (!cached) {
      return undefined;
    }

    // Check if cache is still valid
    const now = Date.now();
    if (now - cached.generatedAt > cached.ttl) {
      // Cache expired, remove it
      void this.context.globalState.update(cacheKey, undefined);
      return undefined;
    }

    return cached;
  }

  /**
   * Cache a tour in globalState
   */
  private cacheTour(cacheKey: string, tour: CodeTour): void {
    void this.context.globalState.update(cacheKey, tour);
  }

  /**
   * Generate a unique cache key for a task
   */
  private getCacheKey(taskContext: TaskContext): string {
    // Create a key based on file path, line number, and task label
    const hash = this.simpleHash(
      `${taskContext.filePath}:${taskContext.lineNumber}:${taskContext.taskLabel}`
    );
    return `${STORAGE_KEY_PREFIX}${hash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate a code tour using AI
   */
  private async generateCodeTour(taskContext: TaskContext): Promise<CodeTour> {
    try {
      // Try to call the backend API
      const response = await this.callAiApi(taskContext);
      
      return this.buildCodeTour(taskContext, response);
    } catch (error) {
      // Fallback to local generation if API fails
      console.warn('AI API call failed, using local generation:', error);
      return this.generateLocalCodeTour(taskContext);
    }
  }

  /**
   * Call the backend AI API for code tour generation
   */
  private async callAiApi(taskContext: TaskContext): Promise<CodeTourResponse> {
    const prompt = this.buildAiPrompt(taskContext);
    
    const response = await fetch(`${this.apiBaseUrl}/api/ai/code-tour`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        taskLabel: taskContext.taskLabel,
        taskType: taskContext.taskType,
        filePath: taskContext.relativePath,
        lineNumber: taskContext.lineNumber + 1, // Convert to 1-based
        surroundingCode: taskContext.surroundingCode,
        nearestSymbol: taskContext.nearestSymbol,
        language: taskContext.language,
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json() as CodeTourResponse;
  }

  /**
   * Build the AI prompt for code tour generation
   */
  private buildAiPrompt(taskContext: TaskContext): string {
    return `You are an expert code reviewer helping a developer understand a TODO/FIXME comment in their codebase.

## Task Information
- **Type**: ${taskContext.taskType.toUpperCase()}
- **Description**: ${taskContext.taskLabel}
- **File**: ${taskContext.relativePath}
- **Line**: ${taskContext.lineNumber + 1}
- **Language**: ${taskContext.language}
${taskContext.nearestSymbol ? `- **Nearest Symbol**: ${taskContext.nearestSymbol}` : ''}

## Surrounding Code
\`\`\`${taskContext.language}
${taskContext.surroundingCode}
\`\`\`

## Your Task
Analyze this TODO/FIXME comment and generate a comprehensive code tour. Provide:

1. **Summary**: Explain what the TODO likely refers to and why it was added.

2. **Reading Order**: Suggest a safe, logical order to read and understand the relevant code. Include:
   - The file and line where the TODO is located
   - Related functions or classes that should be understood first
   - Any dependencies or imports that are relevant
   - Test files that might help understand expected behavior

3. **Dependencies**: List any modules, services, or external dependencies that are involved.

4. **Risks**: Identify potential risks or things to be careful about when addressing this TODO:
   - Side effects
   - Breaking changes
   - Performance implications
   - Security considerations

5. **Suggested Changes**: Provide specific suggestions for how to address this TODO:
   - Code modifications
   - Refactoring opportunities
   - Best practices to follow

Return your response as a JSON object with this structure:
{
  "summary": "string explaining the TODO",
  "steps": [
    {
      "stepNumber": 1,
      "title": "Step title",
      "description": "Detailed description",
      "filePath": "optional/file/path.ts",
      "lineNumber": 42,
      "symbolName": "optionalSymbolName",
      "relevance": "Why this step matters"
    }
  ],
  "dependencies": ["list", "of", "dependencies"],
  "risks": ["list", "of", "risks"],
  "suggestedChanges": ["list", "of", "suggested", "changes"]
}`;
  }

  /**
   * Build a CodeTour object from the AI response
   */
  private buildCodeTour(taskContext: TaskContext, response: CodeTourResponse): CodeTour {
    return {
      id: this.generateTourId(),
      taskLabel: taskContext.taskLabel,
      taskType: taskContext.taskType,
      sourceFilePath: taskContext.relativePath,
      sourceLineNumber: taskContext.lineNumber + 1,
      summary: response.summary,
      steps: response.steps,
      dependencies: response.dependencies,
      risks: response.risks,
      suggestedChanges: response.suggestedChanges,
      generatedAt: Date.now(),
      ttl: CACHE_TTL_MS,
    };
  }

  /**
   * Generate a local code tour when API is unavailable
   */
  private generateLocalCodeTour(taskContext: TaskContext): CodeTour {
    const steps = this.generateLocalSteps(taskContext);
    
    return {
      id: this.generateTourId(),
      taskLabel: taskContext.taskLabel,
      taskType: taskContext.taskType,
      sourceFilePath: taskContext.relativePath,
      sourceLineNumber: taskContext.lineNumber + 1,
      summary: this.generateLocalSummary(taskContext),
      steps,
      dependencies: this.detectDependencies(taskContext.surroundingCode),
      risks: this.generateLocalRisks(taskContext),
      suggestedChanges: this.generateLocalSuggestions(taskContext),
      generatedAt: Date.now(),
      ttl: CACHE_TTL_MS,
    };
  }

  /**
   * Generate a local summary based on task context
   */
  private generateLocalSummary(taskContext: TaskContext): string {
    const typeDescriptions: Record<string, string> = {
      todo: 'This TODO comment indicates a planned feature or improvement that needs to be implemented.',
      fixme: 'This FIXME comment highlights a known issue or bug that requires attention.',
      hack: 'This HACK comment marks a temporary workaround that should be properly addressed.',
      structured: 'This structured task defines specific work to be completed.',
    };

    const baseDescription = typeDescriptions[taskContext.taskType] || 
      'This comment marks code that needs attention.';

    return `${baseDescription}\n\n**Task**: "${taskContext.taskLabel}"\n\n` +
      `Located in \`${taskContext.relativePath}\` at line ${taskContext.lineNumber + 1}` +
      (taskContext.nearestSymbol ? ` within the \`${taskContext.nearestSymbol}\` symbol.` : '.');
  }

  /**
   * Generate local tour steps
   */
  private generateLocalSteps(taskContext: TaskContext): Array<{
    stepNumber: number;
    title: string;
    description: string;
    filePath?: string;
    lineNumber?: number;
    symbolName?: string;
    relevance?: string;
  }> {
    const steps = [];

    // Step 1: Start at the task location
    steps.push({
      stepNumber: 1,
      title: 'Review the Task Comment',
      description: `Start by reviewing the ${taskContext.taskType.toUpperCase()} comment to understand what needs to be done.`,
      filePath: taskContext.relativePath,
      lineNumber: taskContext.lineNumber + 1,
      relevance: 'This is where the task is defined.',
    });

    // Step 2: Understand the surrounding context
    if (taskContext.nearestSymbol) {
      steps.push({
        stepNumber: 2,
        title: `Understand ${taskContext.nearestSymbol}`,
        description: `Review the \`${taskContext.nearestSymbol}\` ${this.guessSymbolType(taskContext.nearestSymbol)} to understand the context in which this task exists.`,
        filePath: taskContext.relativePath,
        symbolName: taskContext.nearestSymbol,
        relevance: 'Understanding the surrounding code is essential before making changes.',
      });
    }

    // Step 3: Check data flow
    steps.push({
      stepNumber: steps.length + 1,
      title: 'Analyze Data Flow',
      description: 'Examine how data flows into and out of this area. Look for function parameters, return values, and state mutations.',
      filePath: taskContext.relativePath,
      relevance: 'Understanding data flow helps prevent unintended side effects.',
    });

    // Step 4: Search for usages
    steps.push({
      stepNumber: steps.length + 1,
      title: 'Find Related Usages',
      description: `Search the workspace for usages of ${taskContext.nearestSymbol ? `\`${taskContext.nearestSymbol}\`` : 'key identifiers from the task comment'} to understand impact.`,
      relevance: 'Identifying all usages helps ensure changes don\'t break other parts of the codebase.',
    });

    // Step 5: Check tests
    steps.push({
      stepNumber: steps.length + 1,
      title: 'Review Related Tests',
      description: 'Look for test files that cover this functionality. They document expected behavior and help ensure your changes are correct.',
      relevance: 'Tests are living documentation that show expected behavior.',
    });

    return steps;
  }

  /**
   * Guess the type of symbol (function, class, etc.)
   */
  private guessSymbolType(symbolName: string): string {
    if (symbolName[0] === symbolName[0].toUpperCase()) {
      return 'class or component';
    }
    return 'function or method';
  }

  /**
   * Detect dependencies from code
   */
  private detectDependencies(code: string): string[] {
    const dependencies: string[] = [];
    
    // Match import statements
    const importMatches = code.matchAll(/import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*)\s+from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      dependencies.push(match[1]);
    }

    // Match require statements
    const requireMatches = code.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
    for (const match of requireMatches) {
      dependencies.push(match[1]);
    }

    return [...new Set(dependencies)];
  }

  /**
   * Generate local risk assessment
   */
  private generateLocalRisks(taskContext: TaskContext): string[] {
    const risks: string[] = [];

    if (taskContext.taskType === 'fixme') {
      risks.push('This is marked as FIXME - there may be a bug that affects functionality.');
    }

    if (taskContext.taskType === 'hack') {
      risks.push('This is marked as HACK - the current implementation may have hidden issues.');
      risks.push('Removing or modifying this hack may reveal underlying problems.');
    }

    if (taskContext.nearestSymbol) {
      risks.push(`Changes to \`${taskContext.nearestSymbol}\` may affect other parts of the codebase.`);
    }

    risks.push('Always run the test suite after making changes.');
    risks.push('Consider the impact on any consumers of this code.');

    return risks;
  }

  /**
   * Generate local suggestions
   */
  private generateLocalSuggestions(taskContext: TaskContext): string[] {
    const suggestions: string[] = [];

    suggestions.push('Understand the full context before making changes.');
    suggestions.push('Write or update tests to cover the expected behavior.');
    
    if (taskContext.taskType === 'hack') {
      suggestions.push('Consider a proper solution rather than extending the hack.');
    }

    if (taskContext.taskType === 'fixme') {
      suggestions.push('Document the root cause when fixing the issue.');
    }

    suggestions.push('Consider breaking large changes into smaller, reviewable chunks.');
    suggestions.push('Update documentation if the behavior changes.');

    return suggestions;
  }

  /**
   * Generate a unique tour ID
   */
  private generateTourId(): string {
    return `tour_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Clear all cached tours
   */
  async clearAllCachedTours(): Promise<void> {
    const keys = this.context.globalState.keys();
    for (const key of keys) {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        await this.context.globalState.update(key, undefined);
      }
    }
  }

  /**
   * Get the count of cached tours
   */
  getCachedTourCount(): number {
    const keys = this.context.globalState.keys();
    return keys.filter(key => key.startsWith(STORAGE_KEY_PREFIX)).length;
  }
}

/**
 * Extract task context from a CodeTask and document
 */
export async function extractTaskContext(
  task: { label: string; type: string; fileUri: vscode.Uri; line: number },
  document: vscode.TextDocument
): Promise<TaskContext> {
  const totalLines = document.lineCount;
  const startLine = Math.max(0, task.line - 20);
  const endLine = Math.min(totalLines - 1, task.line + 20);

  // Extract surrounding code
  const lines: string[] = [];
  for (let i = startLine; i <= endLine; i++) {
    lines.push(document.lineAt(i).text);
  }
  const surroundingCode = lines.join('\n');

  // Find nearest symbol
  let nearestSymbol: string | undefined;
  for (let i = task.line; i >= startLine; i--) {
    const text = document.lineAt(i).text;
    const symbolMatch = text.match(
      /\b(class|interface|function|async function|const|let|var|export\s+(?:default\s+)?(?:class|function|const))\s+([A-Za-z0-9_$]+)/
    );
    if (symbolMatch) {
      nearestSymbol = symbolMatch[2];
      break;
    }
  }

  // Detect language from document
  const language = document.languageId;

  return {
    filePath: task.fileUri.fsPath,
    relativePath: vscode.workspace.asRelativePath(task.fileUri),
    lineNumber: task.line,
    taskLabel: task.label,
    taskType: task.type,
    surroundingCode,
    nearestSymbol,
    language,
  };
}
