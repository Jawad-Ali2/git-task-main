import { IsString, IsOptional, IsBoolean, IsObject, IsUUID } from 'class-validator';

export class CreateIntegrationDto {
  @IsString()
  provider: string; // 'trello'

  @IsString()
  accessToken: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsObject()
  config?: {
    boardId?: string;
    boardName?: string;
    todoListId?: string;
    todoListName?: string;
    inProgressListId?: string;
    inProgressListName?: string;
    doneListId?: string;
    doneListName?: string;
    syncEnabled?: boolean;
    autoCreateCards?: boolean;
    autoMoveCards?: boolean;
  };

  @IsOptional()
  @IsUUID()
  repositoryId?: string;
}

export class UpdateIntegrationDto {
  @IsOptional()
  @IsObject()
  config?: {
    boardId?: string;
    boardName?: string;
    todoListId?: string;
    todoListName?: string;
    inProgressListId?: string;
    inProgressListName?: string;
    doneListId?: string;
    doneListName?: string;
    syncEnabled?: boolean;
    autoCreateCards?: boolean;
    autoMoveCards?: boolean;
  };

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
