import { IsString, IsNumber, IsOptional } from 'class-validator';

/**
 * DTO for requesting an AI-generated code tour
 */
export class CodeTourRequestDto {
  @IsString()
  prompt: string;

  @IsString()
  taskLabel: string;

  @IsString()
  taskType: string;

  @IsString()
  filePath: string;

  @IsNumber()
  lineNumber: number;

  @IsString()
  surroundingCode: string;

  @IsOptional()
  @IsString()
  nearestSymbol?: string;

  @IsString()
  language: string;
}

/**
 * Step in the code tour
 */
export interface CodeTourStep {
  stepNumber: number;
  title: string;
  description: string;
  filePath?: string;
  lineNumber?: number;
  symbolName?: string;
  relevance?: string;
}

/**
 * Response from the code tour generation
 */
export interface CodeTourResponseDto {
  summary: string;
  steps: CodeTourStep[];
  dependencies: string[];
  risks: string[];
  suggestedChanges: string[];
}
