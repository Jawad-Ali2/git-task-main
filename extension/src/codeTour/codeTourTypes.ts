export interface CodeTourStep {
  stepNumber: number;
  /** Title of this step */
  title: string;
  /** Detailed explanation for this step */
  description: string;
  filePath?: string;
  lineNumber?: number;
  /** Symbol or function name relevant to this step */
  symbolName?: string;
  /** Why this step is relevant */
  relevance?: string;
}

export interface CodeTour {
  id: string;
  /** The original task/TODO that triggered the tour */
  taskLabel: string;
  /** Task type (TODO, FIXME, HACK, etc.) */
  taskType: string;
  sourceFilePath: string;
  sourceLineNumber: number;
  summary: string;
  steps: CodeTourStep[];
  dependencies: string[];
  risks: string[];
  suggestedChanges: string[];
  generatedAt: number;
  ttl: number;
}

export interface TaskContext {
  /** Full file path */
  filePath: string;
  relativePath: string;
  lineNumber: number;
  taskLabel: string;
  taskType: string;
  surroundingCode: string;
  nearestSymbol?: string;
  language: string;
}

export interface CodeTourRequest {
  taskLabel: string;
  taskType: string;
  filePath: string;
  lineNumber: number;
  surroundingCode: string;
  nearestSymbol?: string;
  language: string;
}

export interface CodeTourResponse {
  summary: string;
  steps: CodeTourStep[];
  dependencies: string[];
  risks: string[];
  suggestedChanges: string[];
}
