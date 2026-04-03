import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository, In } from 'typeorm';
import { Team } from './entities/team.entity';
import { TeamMember, TeamRole } from './entities/team-member.entity';
import { TeamRepository } from './entities/team-repository.entity';
import { Repository } from '../repositories/entities/repository.entity';
import { Task } from '../tasks/entities/tasks.entity';
import { User } from '../users/entities/user.entity';
import { CreateTeamDto, UpdateTeamDto, JoinTeamDto, UpdateRoleDto } from './dto';
import { ActivityLogService } from './activity-log.service';
import * as crypto from 'crypto';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamRepository: TypeOrmRepository<Team>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: TypeOrmRepository<TeamMember>,
    @InjectRepository(TeamRepository)
    private teamRepoRepository: TypeOrmRepository<TeamRepository>,
    @InjectRepository(Repository)
    private repositoryRepository: TypeOrmRepository<Repository>,
    @InjectRepository(Task)
    private taskRepository: TypeOrmRepository<Task>,
    @InjectRepository(User)
    private userRepository: TypeOrmRepository<User>,
    private activityLogService: ActivityLogService,
  ) {}

  private toCanonicalStatus(status: string): string {
    if (status === 'pending') return 'open';
    if (status === 'completed') return 'done';
    return status;
  }

  /**
   * Generate a random 8-character invite code
   */
  private generateInviteCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Create a new team
   */
  async createTeam(userId: string, dto: CreateTeamDto): Promise<Team> {
    const inviteCode = this.generateInviteCode();

    const team = this.teamRepository.create({
      name: dto.name,
      description: dto.description,
      inviteCode,
      createdById: userId,
    });

    const savedTeam = await this.teamRepository.save(team);

    // Add creator as team member with PM role (highest authority)
    const pmMember = this.teamMemberRepository.create({
      teamId: savedTeam.id,
      userId,
      role: TeamRole.PM,
    });
    await this.teamMemberRepository.save(pmMember);

    return this.getTeam(savedTeam.id, userId);
  }

  /**
   * Get all teams user belongs to
   */
  async getMyTeams(userId: string): Promise<any[]> {
    const memberships = await this.teamMemberRepository.find({
      where: { userId },
      relations: ['team', 'team.createdBy', 'team.members', 'team.repositories'],
    });
    
    return memberships.map((m) => ({
      ...m.team,
      role: m.role,
      memberCount: m.team.members?.length || 0,
    }));
  }

  /**
   * Get team details (must be member)
   */
  async getTeam(teamId: string, userId: string): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['createdBy', 'members', 'members.user', 'repositories', 'repositories.repository'],
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if user is a member
    const isMember = team.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this team');
    }

    return team;
  }

  /**
   * Get team by invite code (for preview before joining)
   */
  async getTeamByInviteCode(inviteCode: string): Promise<{ id: string; name: string; memberCount: number }> {
    const team = await this.teamRepository.findOne({
      where: { inviteCode },
      relations: ['members'],
    });

    if (!team) {
      throw new NotFoundException('Invalid invite code');
    }

    return {
      id: team.id,
      name: team.name,
      memberCount: team.members.length,
    };
  }

  /**
   * Update team (owner/PM only)
   */
  async updateTeam(teamId: string, userId: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.getTeam(teamId, userId);
    const member = team.members.find((m) => m.userId === userId);

    if (!member || member.role !== TeamRole.PM) {
      throw new ForbiddenException('Only PMs can update the team');
    }

    if (dto.name) team.name = dto.name;
    if (dto.description !== undefined) team.description = dto.description;

    return this.teamRepository.save(team);
  }

  /**
   * Delete team (owner only)
   */
  async deleteTeam(teamId: string, userId: string): Promise<void> {
    const team = await this.getTeam(teamId, userId);
    const member = team.members.find((m) => m.userId === userId);

    if (!member || member.role !== TeamRole.PM) {
      throw new ForbiddenException('Only PMs can delete the team');
    }

    await this.teamRepository.remove(team);
  }

  /**
   * Regenerate invite code (owner/PM only)
   */
  async regenerateInviteCode(teamId: string, userId: string): Promise<{ inviteCode: string }> {
    const team = await this.getTeam(teamId, userId);
    const member = team.members.find((m) => m.userId === userId);

    if (!member || ![TeamRole.PM, TeamRole.TL].includes(member.role)) {
      throw new ForbiddenException('Only PMs and Team Leads can regenerate invite codes');
    }

    team.inviteCode = this.generateInviteCode();
    await this.teamRepository.save(team);

    return { inviteCode: team.inviteCode };
  }

  /**
   * Join team via invite code
   */
  async joinTeam(inviteCode: string, userId: string, dto: JoinTeamDto): Promise<TeamMember> {
    const team = await this.teamRepository.findOne({
      where: { inviteCode },
      relations: ['members'],
    });

    if (!team) {
      throw new NotFoundException('Invalid invite code');
    }

    // Check if already a member
    const existingMember = team.members.find((m) => m.userId === userId);
    if (existingMember) {
      throw new ConflictException('You are already a member of this team');
    }

    // Determine role based on invite selection
    let role = TeamRole.DEVELOPER;
    if (dto.role === 'tl') role = TeamRole.TL;

    const member = this.teamMemberRepository.create({
      teamId: team.id,
      userId,
      role,
    });

    const savedMember = await this.teamMemberRepository.save(member);

    // Get user info for activity log
    const user = await this.userRepository.findOne({ where: { id: userId } });

    // Log the activity
    await this.activityLogService.logMemberJoined(
      team.id,
      userId,
      user?.name || 'Unknown',
      user?.avatarUrl,
      role,
    );

    return savedMember;
  }

  /**
   * Leave a team (cannot leave if PM/creator)
   */
  async leaveTeam(teamId: string, userId: string): Promise<void> {
    const team = await this.getTeam(teamId, userId);

    if (team.createdById === userId) {
      throw new BadRequestException('Team creator cannot leave the team. Delete the team instead.');
    }

    const member = team.members.find((m) => m.userId === userId);
    if (member) {
      await this.teamMemberRepository.remove(member);
    }
  }

  /**
   * Get all team members
   */
  async getMembers(teamId: string, userId: string): Promise<TeamMember[]> {
    const team = await this.getTeam(teamId, userId);
    return team.members;
  }

  /**
   * Update member's role (PM only)
   */
  async updateMemberRole(
    teamId: string,
    targetUserId: string,
    currentUserId: string,
    dto: UpdateRoleDto,
  ): Promise<TeamMember> {
    const team = await this.getTeam(teamId, currentUserId);
    const currentMember = team.members.find((m) => m.userId === currentUserId);

    // Only PM can change roles
    if (!currentMember || currentMember.role !== TeamRole.PM) {
      throw new ForbiddenException('Only PMs can change member roles');
    }

    // Cannot change another PM's role (unless you're the creator)
    const targetMember = team.members.find((m) => m.userId === targetUserId);
    if (targetMember?.role === TeamRole.PM && team.createdById !== currentUserId) {
      throw new BadRequestException('Cannot change another PM\'s role');
    }

    const member = team.members.find((m) => m.userId === targetUserId);
    if (!member) {
      throw new NotFoundException('Member not found in this team');
    }

    const previousRole = member.role;
    member.role = dto.role;
    const updatedMember = await this.teamMemberRepository.save(member);

    // Log the activity
    await this.activityLogService.logMemberRoleChanged(teamId, currentUserId, targetUserId, member.user?.name || 'Unknown', previousRole, dto.role);

    return updatedMember;
  }

  /**
   * Remove member from team (PM/TL only)
   */
  async removeMember(teamId: string, targetUserId: string, currentUserId: string): Promise<void> {
    const team = await this.getTeam(teamId, currentUserId);
    const currentMember = team.members.find((m) => m.userId === currentUserId);

    if (!currentMember || ![TeamRole.PM, TeamRole.TL].includes(currentMember.role)) {
      throw new ForbiddenException('Only PMs and TLs can remove members');
    }

    // Cannot remove team creator
    if (targetUserId === team.createdById) {
      throw new BadRequestException('Cannot remove the team creator');
    }

    // TLs cannot remove PMs
    if (currentMember.role === TeamRole.TL) {
      const targetMember = team.members.find((m) => m.userId === targetUserId);
      if (targetMember && targetMember.role === TeamRole.PM) {
        throw new ForbiddenException('TLs cannot remove PMs');
      }
    }

    const member = team.members.find((m) => m.userId === targetUserId);
    if (member) {
      await this.teamMemberRepository.remove(member);
    }
  }

  /**
   * Get all repositories shared with team
   */
  async getTeamRepositories(teamId: string, userId: string): Promise<TeamRepository[]> {
    // Verify membership
    await this.getTeam(teamId, userId);

    return this.teamRepoRepository.find({
      where: { teamId },
      relations: ['repository', 'repository.tasks', 'addedBy'],
    });
  }

  /**
   * Share a repository with team (must own the repo)
   */
  async shareRepository(teamId: string, repoId: string, userId: string): Promise<TeamRepository> {
    // Verify team membership
    const team = await this.getTeam(teamId, userId);
    const member = team.members.find((m) => m.userId === userId);

    if (!member || ![TeamRole.PM, TeamRole.TL, TeamRole.DEVELOPER].includes(member.role)) {
      throw new ForbiddenException('Only team members can share repositories');
    }

    // Verify repository ownership
    const repo = await this.repositoryRepository.findOne({
      where: { id: repoId },
      relations: ['user'],
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    if (repo.user.id !== userId) {
      throw new ForbiddenException('You can only share repositories you own');
    }

    // Check if already shared
    const existing = await this.teamRepoRepository.findOne({
      where: { teamId, repositoryId: repoId },
    });

    if (existing) {
      throw new ConflictException('Repository is already shared with this team');
    }

    const teamRepo = this.teamRepoRepository.create({
      teamId,
      repositoryId: repoId,
      addedById: userId,
    });

    const savedTeamRepo = await this.teamRepoRepository.save(teamRepo);

    // Log the activity
    await this.activityLogService.logRepoShared(teamId, userId, repoId, repo.name);

    return savedTeamRepo;
  }

  /**
   * Unshare repository from team
   */
  async unshareRepository(teamId: string, repoId: string, userId: string): Promise<void> {
    const team = await this.getTeam(teamId, userId);
    const member = team.members.find((m) => m.userId === userId);

    if (!member || ![TeamRole.PM, TeamRole.TL].includes(member.role)) {
      throw new ForbiddenException('Only PMs and TLs can unshare repositories');
    }

    const teamRepo = await this.teamRepoRepository.findOne({
      where: { teamId, repositoryId: repoId },
    });

    if (!teamRepo) {
      throw new NotFoundException('Repository not shared with this team');
    }

    await this.teamRepoRepository.remove(teamRepo);
  }

  /**
   * Check if user has access to a repository through team membership
   */
  async hasTeamAccess(repoId: string, userId: string): Promise<boolean> {
    const teamRepo = await this.teamRepoRepository
      .createQueryBuilder('tr')
      .innerJoin('team_members', 'tm', 'tm.team_id = tr.team_id')
      .where('tr.repository_id = :repoId', { repoId })
      .andWhere('tm.user_id = :userId', { userId })
      .getOne();

    return !!teamRepo;
  }

  // ============ TEAM TASKS (Phase 2) ============

  /**
   * Get all tasks from repositories shared with a team
   */
  async getTeamTasks(
    teamId: string,
    userId: string,
    filters?: {
      status?: string;
      priority?: string;
      type?: string;
      assignedTo?: string;
      repositoryId?: string;
    },
  ): Promise<Task[]> {
    // Verify membership
    await this.getTeam(teamId, userId);

    // Get all repository IDs shared with this team
    const teamRepos = await this.teamRepoRepository.find({
      where: { teamId },
      select: ['repositoryId'],
    });

    if (teamRepos.length === 0) {
      return [];
    }

    const repoIds = teamRepos.map((tr) => tr.repositoryId);

    // Build query for tasks
    const queryBuilder = this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.repository', 'repository')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.assignedBy', 'assignedBy')
      .where('task.repositoryId IN (:...repoIds)', { repoIds });

    // Apply filters
    if (filters?.status) {
      queryBuilder.andWhere('task.status = :status', { status: filters.status });
    }
    if (filters?.priority) {
      queryBuilder.andWhere('task.priority = :priority', { priority: filters.priority });
    }
    if (filters?.type) {
      queryBuilder.andWhere('task.type = :type', { type: filters.type });
    }
    if (filters?.assignedTo) {
      if (filters.assignedTo === 'unassigned') {
        queryBuilder.andWhere('task.assigned_to IS NULL');
      } else {
        queryBuilder.andWhere('task.assigned_to = :assignedTo', { assignedTo: filters.assignedTo });
      }
    }
    if (filters?.repositoryId) {
      queryBuilder.andWhere('task.repositoryId = :repositoryId', { repositoryId: filters.repositoryId });
    }

    // Order by priority (high first), then by creation date
    queryBuilder.orderBy(
      `CASE task.priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
        ELSE 4 
      END`,
      'ASC',
    );
    queryBuilder.addOrderBy('task.addedAt', 'DESC', 'NULLS LAST');

    return queryBuilder.getMany();
  }

  /**
   * Assign a task to a team member
   */
  async assignTask(
    taskId: string,
    assignToUserId: string,
    assignedByUserId: string,
    teamId: string,
    dueDate?: Date,
  ): Promise<Task> {
    // Verify assigner is a team member with appropriate role
    const team = await this.getTeam(teamId, assignedByUserId);
    const assignerMember = team.members.find((m) => m.userId === assignedByUserId);

    if (!assignerMember || ![TeamRole.PM, TeamRole.TL].includes(assignerMember.role)) {
      throw new ForbiddenException('Only PMs and TLs can assign tasks');
    }

    // Verify assignee is a team member
    const assigneeMember = team.members.find((m) => m.userId === assignToUserId);
    if (!assigneeMember) {
      throw new BadRequestException('User is not a member of this team');
    }

    // Get the task and verify it belongs to a shared repository
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['repository'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Verify task's repository is shared with this team
    const teamRepo = await this.teamRepoRepository.findOne({
      where: { teamId, repositoryId: task.repository.id },
    });

    if (!teamRepo) {
      throw new ForbiddenException('This task does not belong to a repository shared with this team');
    }

    // Assign the task
    task.assignedToId = assignToUserId;
    task.assignedById = assignedByUserId;
    task.assignedAt = new Date();
    if (dueDate) {
      task.dueDate = dueDate;
    }

    const currentStatus = this.toCanonicalStatus(task.status);

    // Update status to in-progress if it was open/pending
    if (currentStatus === 'open') {
      task.status = 'in-progress';
    } else if (task.status !== currentStatus) {
      task.status = currentStatus;
    }

    await this.taskRepository.save(task);

    const savedTask = await this.taskRepository.findOne({
      where: { id: task.id },
      relations: ['repository', 'assignedTo', 'assignedBy'],
    });

    if (!savedTask) {
      throw new NotFoundException('Task not found after assignment');
    }

    // Get assignee name for activity log
    const assignee = await this.userRepository.findOne({ where: { id: assignToUserId } });
    
    // Log the activity
    await this.activityLogService.logTaskAssigned(
      teamId,
      assignedByUserId,
      taskId,
      task.description,
      task.type || 'TODO',
      assignToUserId,
      assignee?.name || 'Unknown',
      assignee?.avatarUrl,
      task.repository?.name,
    );

    return savedTask;
  }

  /**
   * Unassign a task
   */
  async unassignTask(taskId: string, userId: string, teamId: string): Promise<Task> {
    // Verify user is a team member
    const team = await this.getTeam(teamId, userId);
    const member = team.members.find((m) => m.userId === userId);

    if (!member || ![TeamRole.PM, TeamRole.TL].includes(member.role)) {
      // Developers can only unassign tasks assigned to themselves
      const task = await this.taskRepository.findOne({
        where: { id: taskId },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      if (member?.role === TeamRole.DEVELOPER && task.assignedToId !== userId) {
        throw new ForbiddenException('Developers can only unassign tasks assigned to themselves');
      }
    }

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['repository'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Verify task's repository is shared with this team
    const teamRepo = await this.teamRepoRepository.findOne({
      where: { teamId, repositoryId: task.repository.id },
    });

    if (!teamRepo) {
      throw new ForbiddenException('This task does not belong to a repository shared with this team');
    }

    // Unassign the task
    task.assignedToId = null;
    task.assignedById = null;
    task.assignedAt = null;
    task.dueDate = null;

    const currentStatus = this.toCanonicalStatus(task.status);

    // Revert status to open if it was in-progress
    if (currentStatus === 'in-progress') {
      task.status = 'open';
    } else if (task.status !== currentStatus) {
      task.status = currentStatus;
    }

    await this.taskRepository.save(task);

    const savedTask = await this.taskRepository.findOne({
      where: { id: task.id },
      relations: ['repository', 'assignedTo', 'assignedBy'],
    });

    if (!savedTask) {
      throw new NotFoundException('Task not found after unassignment');
    }

    return savedTask;
  }

  /**
   * Get tasks assigned to current user (across all teams)
   */
  async getMyAssignedTasks(userId: string): Promise<any[]> {
    const tasks = await this.taskRepository.find({
      where: { assignedToId: userId },
      relations: ['repository', 'repository.user', 'assignedBy'],
      order: {
        dueDate: 'ASC',
        assignedAt: 'DESC',
      },
    });

    if (tasks.length === 0) {
      return [];
    }

    const repositoryIds = Array.from(new Set(tasks.map((task) => task.repository?.id).filter(Boolean)));

    const teamRepos = repositoryIds.length
      ? await this.teamRepoRepository.find({
          where: { repositoryId: In(repositoryIds) },
          relations: ['team', 'team.members'],
        })
      : [];

    const teamOriginsByRepo = new Map<string, Array<{ teamId: string; teamName: string }>>();

    for (const tr of teamRepos) {
      const isUserInTeam = tr.team?.members?.some((member) => member.userId === userId);
      if (!isUserInTeam) continue;

      const existing = teamOriginsByRepo.get(tr.repositoryId) || [];
      existing.push({
        teamId: tr.team.id,
        teamName: tr.team.name,
      });
      teamOriginsByRepo.set(tr.repositoryId, existing);
    }

    return tasks.map((task) => {
      const repoId = task.repository?.id;
      const teamOrigins = repoId ? teamOriginsByRepo.get(repoId) || [] : [];
      const isRepositoryOwner = task.repository?.user?.id === userId;

      const origins: Array<
        { type: 'team'; teamId: string; teamName: string } |
        { type: 'repository' }
      > = teamOrigins.map((team): { type: 'team'; teamId: string; teamName: string } => ({
        type: 'team',
        teamId: team.teamId,
        teamName: team.teamName,
      }));

      if (isRepositoryOwner) {
        origins.push({
          type: 'repository',
        });
      }

      return {
        ...task,
        origins,
      };
    });
  }

  /**
   * Get team members for task assignment dropdown
   */
  async getTeamMembersForAssignment(teamId: string, userId: string): Promise<any[]> {
    const team = await this.getTeam(teamId, userId);

    return team.members
      .map((m) => ({
        id: m.user.id,
        name: m.user.name || m.user.email,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
      }));
  }

  /**
   * Get user's role in a team
   */
  async getUserRole(teamId: string, userId: string): Promise<TeamRole | null> {
    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });
    return member?.role || null;
  }

  // ============ PM DASHBOARD ANALYTICS ============

  /**
   * Get comprehensive team analytics for PM Dashboard
   */
  async getTeamAnalytics(teamId: string, userId: string): Promise<any> {
    // Verify membership and get team with role check
    const team = await this.getTeam(teamId, userId);
    const currentMember = team.members.find((m) => m.userId === userId);

    // Only PM and TL can access analytics
    if (!currentMember || ![TeamRole.PM, TeamRole.TL].includes(currentMember.role)) {
      throw new ForbiddenException('Only PMs and TLs can access team analytics');
    }

    // Get all repository IDs shared with this team
    const teamRepos = await this.teamRepoRepository.find({
      where: { teamId },
      select: ['repositoryId'],
    });

    if (teamRepos.length === 0) {
      return {
        overview: {
          totalTasks: 0,
          assignedTasks: 0,
          unassignedTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
        },
        byStatus: { open: 0, 'in-progress': 0, done: 0 },
        byPriority: { high: 0, medium: 0, low: 0 },
        byType: {},
        memberWorkloads: [],
        recentlyAssigned: [],
        upcomingDeadlines: [],
      };
    }

    const repoIds = teamRepos.map((tr) => tr.repositoryId);
    const now = new Date();

    // Get all tasks from shared repositories
    const tasks = await this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.repository', 'repository')
      .where('task.repositoryId IN (:...repoIds)', { repoIds })
      .getMany();

    // Calculate overview stats
    const totalTasks = tasks.length;
    const assignedTasks = tasks.filter((t) => t.assignedToId).length;
    const unassignedTasks = totalTasks - assignedTasks;
    const completedTasks = tasks.filter((t) => t.status === 'done').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
    const pendingTasks = tasks.filter((t) => t.status === 'open').length;
    const overdueTasks = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done',
    ).length;

    // Group by status
    const byStatus = {
      open: tasks.filter((t) => t.status === 'open').length,
      'in-progress': tasks.filter((t) => t.status === 'in-progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
    };

    // Group by priority
    const byPriority = {
      high: tasks.filter((t) => t.priority === 'high').length,
      medium: tasks.filter((t) => t.priority === 'medium').length,
      low: tasks.filter((t) => t.priority === 'low').length,
    };

    // Group by type
    const byType: Record<string, number> = {};
    tasks.forEach((t) => {
      byType[t.type] = (byType[t.type] || 0) + 1;
    });

    // Calculate member workloads
    const memberWorkloads = team.members.map((member) => {
      const memberTasks = tasks.filter((t) => t.assignedToId === member.userId);
      const completedByMember = memberTasks.filter((t) => t.status === 'done').length;
      const inProgressByMember = memberTasks.filter((t) => t.status === 'in-progress').length;
      const pendingByMember = memberTasks.filter((t) => t.status === 'open').length;
      const overdueByMember = memberTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done',
      ).length;

      return {
        userId: member.userId,
        userName: member.user.name || member.user.email,
        avatarUrl: member.user.avatarUrl,
        role: member.role,
        totalAssigned: memberTasks.length,
        completed: completedByMember,
        inProgress: inProgressByMember,
        pending: pendingByMember,
        overdue: overdueByMember,
      };
    });

    // Sort by total assigned (descending) to show busiest members first
    memberWorkloads.sort((a, b) => b.totalAssigned - a.totalAssigned);

    // Get recently assigned tasks (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentlyAssigned = tasks
      .filter((t) => t.assignedAt && new Date(t.assignedAt) > sevenDaysAgo)
      .sort((a, b) => new Date(b.assignedAt!).getTime() - new Date(a.assignedAt!).getTime())
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        description: t.description,
        type: t.type,
        priority: t.priority,
        status: t.status,
        assignedTo: t.assignedTo
          ? { id: t.assignedTo.id, name: t.assignedTo.name, avatarUrl: t.assignedTo.avatarUrl }
          : null,
        assignedAt: t.assignedAt,
        repository: { id: t.repository.id, name: t.repository.name },
      }));

    // Get upcoming deadlines (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const upcomingDeadlines = tasks
      .filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) >= now &&
          new Date(t.dueDate) <= sevenDaysFromNow &&
          t.status !== 'done',
      )
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        description: t.description,
        type: t.type,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        assignedTo: t.assignedTo
          ? { id: t.assignedTo.id, name: t.assignedTo.name, avatarUrl: t.assignedTo.avatarUrl }
          : null,
        repository: { id: t.repository.id, name: t.repository.name },
      }));

    // Get high priority unassigned tasks
    const highPriorityUnassigned = tasks
      .filter((t) => t.priority === 'high' && !t.assignedToId && t.status !== 'done')
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        description: t.description,
        type: t.type,
        repository: { id: t.repository.id, name: t.repository.name },
      }));

    return {
      overview: {
        totalTasks,
        assignedTasks,
        unassignedTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
      byStatus,
      byPriority,
      byType,
      memberWorkloads,
      recentlyAssigned,
      upcomingDeadlines,
      highPriorityUnassigned,
      teamInfo: {
        id: team.id,
        name: team.name,
        memberCount: team.members.length,
        repositoryCount: teamRepos.length,
      },
    };
  }

  // ============ MEMBER PROGRESS ============

  /**
   * Get detailed progress for a specific team member
   */
  async getMemberProgress(
    teamId: string,
    memberId: string,
    requestingUserId: string,
  ): Promise<any> {
    // Verify requesting user is a member
    const team = await this.getTeam(teamId, requestingUserId);

    // Find the target member
    const member = team.members.find((m) => m.userId === memberId);
    if (!member) {
      throw new NotFoundException('Member not found in this team');
    }

    // Get all repository IDs shared with this team
    const teamRepos = await this.teamRepoRepository.find({
      where: { teamId },
      select: ['repositoryId'],
    });

    if (teamRepos.length === 0) {
      return {
        member: {
          userId: member.userId,
          name: member.user.name || member.user.email,
          email: member.user.email,
          avatarUrl: member.user.avatarUrl,
          role: member.role,
          joinedAt: member.joinedAt,
        },
        stats: {
          totalAssigned: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          overdue: 0,
          completionRate: 0,
        },
        byPriority: { high: 0, medium: 0, low: 0 },
        byType: {},
        recentTasks: [],
        activitySummary: {
          tasksCompletedThisWeek: 0,
          tasksAssignedThisWeek: 0,
        },
      };
    }

    const repoIds = teamRepos.map((tr) => tr.repositoryId);
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Get all tasks assigned to this member from shared repositories
    const memberTasks = await this.taskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.repository', 'repository')
      .leftJoinAndSelect('task.assignedBy', 'assignedBy')
      .where('task.repositoryId IN (:...repoIds)', { repoIds })
      .andWhere('task.assignedToId = :memberId', { memberId })
      .orderBy('task.assignedAt', 'DESC')
      .getMany();

    // Calculate stats
    const totalAssigned = memberTasks.length;
    const completed = memberTasks.filter((t) => t.status === 'done').length;
    const inProgress = memberTasks.filter((t) => t.status === 'in-progress').length;
    const pending = memberTasks.filter((t) => t.status === 'open').length;
    const overdue = memberTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done',
    ).length;

    // Group by priority
    const byPriority = {
      high: memberTasks.filter((t) => t.priority === 'high').length,
      medium: memberTasks.filter((t) => t.priority === 'medium').length,
      low: memberTasks.filter((t) => t.priority === 'low').length,
    };

    // Group by type
    const byType: Record<string, number> = {};
    memberTasks.forEach((t) => {
      byType[t.type] = (byType[t.type] || 0) + 1;
    });

    // Recent tasks (last 10 assigned)
    const recentTasks = memberTasks.slice(0, 10).map((t) => ({
      id: t.id,
      description: t.description,
      type: t.type,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      assignedAt: t.assignedAt,
      assignedBy: t.assignedBy
        ? { id: t.assignedBy.id, name: t.assignedBy.name }
        : null,
      repository: { id: t.repository.id, name: t.repository.name },
    }));

    // Activity summary for the week
    const tasksCompletedThisWeek = memberTasks.filter(
      (t) =>
        t.status === 'done' &&
        t.completedAt &&
        new Date(t.completedAt) >= oneWeekAgo,
    ).length;

    const tasksAssignedThisWeek = memberTasks.filter(
      (t) => t.assignedAt && new Date(t.assignedAt) >= oneWeekAgo,
    ).length;

    return {
      member: {
        userId: member.userId,
        name: member.user.name || member.user.email,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
        role: member.role,
        joinedAt: member.joinedAt,
      },
      stats: {
        totalAssigned,
        completed,
        inProgress,
        pending,
        overdue,
        completionRate: totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0,
      },
      byPriority,
      byType,
      recentTasks,
      activitySummary: {
        tasksCompletedThisWeek,
        tasksAssignedThisWeek,
      },
    };
  }
}