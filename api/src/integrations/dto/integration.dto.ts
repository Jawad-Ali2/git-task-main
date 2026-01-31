import { IsString, IsOptional, IsBoolean, IsObject, IsUUID, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { TrelloConfig, JiraConfig } from '../interfaces/provider-config.interface';

export class CreateIntegrationDto {
  @IsString()
  provider: 'trello' | 'jira' | 'asana';

  @IsString()
  accessToken: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  tokenExpiresAt?: Date;

  @IsOptional()
  @IsObject()
  config?: TrelloConfig | JiraConfig;

  @IsOptional()
  @IsUUID()
  repositoryId?: string;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsObject()
  config?: Partial<TrelloConfig | JiraConfig>;

  @IsOptional()
  @IsString()
  status?: string;
}

export class TrelloConfigDto {
  @IsString()
  boardId: string;

  @IsString()
  boardName: string;

  @IsString()
  todoListId: string;

  @IsString()
  todoListName: string;

  @IsOptional()
  @IsString()
  inProgressListId?: string;

  @IsOptional()
  @IsString()
  inProgressListName?: string;

  @IsOptional()
  @IsString()
  doneListId?: string;

  @IsOptional()
  @IsString()
  doneListName?: string;

  @IsBoolean()
  syncEnabled: boolean;

  @IsBoolean()
  autoCreateCards: boolean;

  @IsBoolean()
  autoMoveCards: boolean;
}

export class SyncTasksDto {
  @IsOptional()
  @IsUUID()
  repositoryId?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean; // Force re-sync even if already synced
}
