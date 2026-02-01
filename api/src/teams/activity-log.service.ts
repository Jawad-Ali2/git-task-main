import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ActivityLog, ActivityType, ActivityMetadata } from './entities/activity-log.entity';

export interface LogActivityParams {
  teamId: string;
  userId?: string;
  type: ActivityType;
  metadata?: ActivityMetadata;
}

export interface ActivityQueryParams {
  page?: number;
  limit?: number;
  type?: ActivityType;
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  /**
   * Log an activity event
   */
  async logActivity(params: LogActivityParams): Promise<ActivityLog> {
    try {
      const activity = this.activityLogRepository.create({
        teamId: params.teamId,
        userId: params.userId,
        type: params.type,
        metadata: params.metadata,
      });

      const saved = await this.activityLogRepository.save(activity);
      this.logger.debug(`Activity logged: ${params.type} for team ${params.teamId}`);
      return saved;
    } catch (error) {
      this.logger.error(`Failed to log activity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get activity feed for a team with pagination
   */
  async getTeamActivity(
    teamId: string,
    params: ActivityQueryParams = {},
  ): Promise<{ activities: ActivityLog[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 20, type } = params;
    const skip = (page - 1) * limit;

    const queryBuilder = this.activityLogRepository
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .where('activity.teamId = :teamId', { teamId })
      .orderBy('activity.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (type) {
      queryBuilder.andWhere('activity.type = :type', { type });
    }

    const [activities, total] = await queryBuilder.getManyAndCount();

    return {
      activities,
      total,
      hasMore: skip + activities.length < total,
    };
  }

  /**
   * Get recent activity (last N items)
   */
  async getRecentActivity(teamId: string, count: number = 10): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: { teamId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: count,
    });
  }

  /**
   * Get activity for a specific user in a team
   */
  async getUserActivity(
    teamId: string,
    userId: string,
    limit: number = 20,
  ): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: { teamId, userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get activity related to a specific user (as performer or target)
   */
  async getActivityRelatedToUser(
    teamId: string,
    userId: string,
    limit: number = 20,
  ): Promise<ActivityLog[]> {
    return this.activityLogRepository
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .where('activity.teamId = :teamId', { teamId })
      .andWhere(
        '(activity.userId = :userId OR activity.metadata->>\'assigneeId\' = :userId)',
        { userId },
      )
      .orderBy('activity.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Clean up old activity logs (older than specified days)
   */
  async cleanupOldActivity(teamId: string, daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.activityLogRepository.delete({
      teamId,
      createdAt: LessThan(cutoffDate),
    });

    return result.affected || 0;
  }

  // ============ Helper Methods for Common Activities ============

  async logTaskAssigned(
    teamId: string,
    assignerId: string,
    taskId: string,
    taskDescription: string,
    taskType: string,
    assigneeId: string,
    assigneeName: string,
    assigneeAvatarUrl?: string,
    repositoryName?: string,
  ): Promise<ActivityLog> {
    return this.logActivity({
      teamId,
      userId: assignerId,
      type: ActivityType.TASK_ASSIGNED,
      metadata: {
        taskId,
        taskDescription,
        taskType,
        assigneeId,
        assigneeName,
        assigneeAvatarUrl,
        repositoryName,
      },
    });
  }

  async logTaskUnassigned(
    teamId: string,
    userId: string,
    taskId: string,
    taskDescription: string,
    previousAssigneeName?: string,
  ): Promise<ActivityLog> {
    return this.logActivity({
      teamId,
      userId,
      type: ActivityType.TASK_UNASSIGNED,
      metadata: {
        taskId,
        taskDescription,
        assigneeName: previousAssigneeName,
      },
    });
  }

  async logTaskStatusChanged(
    teamId: string,
    userId: string,
    taskId: string,
    taskDescription: string,
    oldStatus: string,
    newStatus: string,
    repositoryName?: string,
  ): Promise<ActivityLog> {
    return this.logActivity({
      teamId,
      userId,
      type: newStatus === 'done' ? ActivityType.TASK_COMPLETED : ActivityType.TASK_STATUS_CHANGED,
      metadata: {
        taskId,
        taskDescription,
        oldStatus,
        newStatus,
        repositoryName,
      },
    });
  }

  async logMemberJoined(
    teamId: string,
    userId: string,
    memberName: string,
    memberAvatarUrl?: string,
    role?: string,
  ): Promise<ActivityLog> {
    return this.logActivity({
      teamId,
      userId,
      type: ActivityType.MEMBER_JOINED,
      metadata: {
        memberName,
        memberAvatarUrl,
        newRole: role,
      },
    });
  }

  async logMemberLeft(
    teamId: string,
    userId: string,
    memberName: string,
  ): Promise<ActivityLog> {
    return this.logActivity({
      teamId,
      userId,
      type: ActivityType.MEMBER_LEFT,
      metadata: {
        memberName,
      },
    });
  }

  async logMemberRoleChanged(
    teamId: string,
    changerId: string,
    memberId: string,
    memberName: string,
    oldRole: string,
    newRole: string,
  ): Promise<ActivityLog> {
    return this.logActivity({
      teamId,
      userId: changerId,
      type: ActivityType.MEMBER_ROLE_CHANGED,
      metadata: {
        assigneeId: memberId,
        memberName,
        oldRole,
        newRole,
      },
    });
  }

  async logRepoShared(
    teamId: string,
    userId: string,
    repositoryId: string,
    repositoryName: string,
  ): Promise<ActivityLog> {
    return this.logActivity({
      teamId,
      userId,
      type: ActivityType.REPO_SHARED,
      metadata: {
        repositoryId,
        repositoryName,
      },
    });
  }

  async logRepoScanned(
    teamId: string,
    userId: string,
    repositoryId: string,
    repositoryName: string,
    tasksFound: number,
  ): Promise<ActivityLog> {
    return this.logActivity({
      teamId,
      userId,
      type: ActivityType.REPO_SCANNED,
      metadata: {
        repositoryId,
        repositoryName,
        tasksFound,
      },
    });
  }
}
