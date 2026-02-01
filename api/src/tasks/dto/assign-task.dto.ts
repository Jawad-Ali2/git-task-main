import { IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignTaskDto {
  @ApiProperty({ description: 'User ID to assign the task to' })
  @IsUUID()
  @IsString()
  userId: string;

  @ApiPropertyOptional({ description: 'Due date for the task' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateTaskAssignmentDto {
  @ApiPropertyOptional({ description: 'Due date for the task' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
