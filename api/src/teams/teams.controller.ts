import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { TeamsService } from './teams.service';
import { ActivityLogService } from './activity-log.service';
import { CreateTeamDto, UpdateTeamDto, JoinTeamDto, UpdateRoleDto } from './dto';
import { AssignTaskDto } from '../tasks/dto/assign-task.dto';
import { ActivityType } from './entities/activity-log.entity';

@ApiTags('teams')
@Controller('teams')
@UseGuards(AuthGuard('jwt'))
@ApiCookieAuth('access_token')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  // ============ TEAM CRUD ============

  @Post()
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createTeam(@Body() dto: CreateTeamDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.createTeam(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all teams user belongs to' })
  @ApiResponse({ status: 200, description: 'Returns list of teams with role info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyTeams(@Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.getMyTeams(user.userId);
  }

  @Get(':teamId')
  @ApiOperation({ summary: 'Get team details' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiResponse({ status: 200, description: 'Returns team with members and repositories' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member of this team' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getTeam(@Param('teamId') teamId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.getTeam(teamId, user.userId);
  }

  @Patch(':teamId')
  @ApiOperation({ summary: 'Update team (PM only)' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiResponse({ status: 200, description: 'Team updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only PMs can update' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async updateTeam(
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.teamsService.updateTeam(teamId, user.userId, dto);
  }

  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete team (PM only)' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiResponse({ status: 204, description: 'Team deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only PM can delete' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async deleteTeam(@Param('teamId') teamId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.deleteTeam(teamId, user.userId);
  }

  // ============ INVITES & JOINING ============

  @Post(':teamId/regenerate-invite')
  @ApiOperation({ summary: 'Generate new invite code (PM/TL only)' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiResponse({ status: 200, description: 'Returns new invite code' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only PMs and TLs can regenerate' })
  async regenerateInviteCode(@Param('teamId') teamId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.regenerateInviteCode(teamId, user.userId);
  }

  @Get('invite/:inviteCode')
  @ApiOperation({ summary: 'Get team preview by invite code (for join confirmation)' })
  @ApiParam({ name: 'inviteCode', description: '8-character invite code' })
  @ApiResponse({ status: 200, description: 'Returns team name and member count' })
  @ApiResponse({ status: 404, description: 'Invalid invite code' })
  async getTeamByInviteCode(@Param('inviteCode') inviteCode: string) {
    return this.teamsService.getTeamByInviteCode(inviteCode);
  }

  @Post('join/:inviteCode')
  @ApiOperation({ summary: 'Join team via invite code' })
  @ApiParam({ name: 'inviteCode', description: '8-character invite code' })
  @ApiResponse({ status: 201, description: 'Successfully joined team' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Invalid invite code' })
  @ApiResponse({ status: 409, description: 'Already a member' })
  async joinTeam(
    @Param('inviteCode') inviteCode: string,
    @Body() dto: JoinTeamDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.teamsService.joinTeam(inviteCode, user.userId, dto);
  }

  @Delete(':teamId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a team (cannot leave if creator)' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiResponse({ status: 204, description: 'Successfully left team' })
  @ApiResponse({ status: 400, description: 'Team creator cannot leave' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async leaveTeam(@Param('teamId') teamId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.leaveTeam(teamId, user.userId);
  }

  // ============ MEMBER MANAGEMENT ============

  @Get(':teamId/members')
  @ApiOperation({ summary: 'Get all team members' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of team members' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member of this team' })
  async getMembers(@Param('teamId') teamId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.getMembers(teamId, user.userId);
  }

  @Patch(':teamId/members/:userId/role')
  @ApiOperation({ summary: "Change member's role (owner only)" })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID to update' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot change owner role' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only owner can change roles' })
  async updateMemberRole(
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.teamsService.updateMemberRole(teamId, userId, user.userId, dto);
  }

  @Delete(':teamId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from team (owner/PM only)' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiParam({ name: 'userId', description: 'User UUID to remove' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot remove owner' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only owners and PMs can remove members' })
  async removeMember(
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.teamsService.removeMember(teamId, userId, user.userId);
  }

  // ============ REPOSITORY MANAGEMENT ============

  @Get(':teamId/repositories')
  @ApiOperation({ summary: 'Get all repositories shared with team' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of team repositories' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member of this team' })
  async getTeamRepositories(@Param('teamId') teamId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.getTeamRepositories(teamId, user.userId);
  }

  @Post(':teamId/repositories/:repoId')
  @ApiOperation({ summary: 'Share a repository with team (must own the repo)' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiParam({ name: 'repoId', description: 'Repository UUID' })
  @ApiResponse({ status: 201, description: 'Repository shared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Can only share repositories you own' })
  @ApiResponse({ status: 409, description: 'Repository already shared' })
  async shareRepository(
    @Param('teamId') teamId: string,
    @Param('repoId') repoId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.teamsService.shareRepository(teamId, repoId, user.userId);
  }

  @Delete(':teamId/repositories/:repoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unshare repository from team' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiParam({ name: 'repoId', description: 'Repository UUID' })
  @ApiResponse({ status: 204, description: 'Repository unshared successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only owners and PMs can unshare' })
  async unshareRepository(
    @Param('teamId') teamId: string,
    @Param('repoId') repoId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.teamsService.unshareRepository(teamId, repoId, user.userId);
  }

  // ============ TASK MANAGEMENT (Phase 2) ============

  @Get(':teamId/tasks')
  @ApiOperation({ summary: 'Get all tasks from repositories shared with team' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (open, in-progress, done)' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter by priority (low, medium, high)' })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by type (TODO, FIXME, HACK, BUG)' })
  @ApiQuery({ name: 'assignedTo', required: false, description: 'Filter by assigned user ID or "unassigned"' })
  @ApiQuery({ name: 'repositoryId', required: false, description: 'Filter by repository ID' })
  @ApiResponse({ status: 200, description: 'Returns list of tasks from shared repositories' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member of this team' })
  async getTeamTasks(
    @Param('teamId') teamId: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('type') type?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('repositoryId') repositoryId?: string,
    @Req() req?: Request,
  ) {
    const user = (req as any).user;
    return this.teamsService.getTeamTasks(teamId, user.userId, {
      status,
      priority,
      type,
      assignedTo,
      repositoryId,
    });
  }

  @Get(':teamId/members/assignable')
  @ApiOperation({ summary: 'Get team members who can be assigned tasks' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiResponse({ status: 200, description: 'Returns list of assignable members' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a member of this team' })
  async getAssignableMembers(@Param('teamId') teamId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.getTeamMembersForAssignment(teamId, user.userId);
  }

  @Post(':teamId/tasks/:taskId/assign')
  @ApiOperation({ summary: 'Assign a task to a team member' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task assigned successfully' })
  @ApiResponse({ status: 400, description: 'User is not a member of this team' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or task not in team' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async assignTask(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Body() dto: AssignTaskDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    return this.teamsService.assignTask(taskId, dto.userId, user.userId, teamId, dueDate);
  }

  @Delete(':teamId/tasks/:taskId/assign')
  @ApiOperation({ summary: 'Unassign a task' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'Task unassigned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async unassignTask(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.teamsService.unassignTask(taskId, user.userId, teamId);
  }

  @Get('my/assigned-tasks')
  @ApiOperation({ summary: 'Get all tasks assigned to current user across all teams' })
  @ApiResponse({ status: 200, description: 'Returns list of assigned tasks' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyAssignedTasks(@Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.getMyAssignedTasks(user.userId);
  }

  // ============ PM DASHBOARD ============

  @Get(':teamId/analytics')
  @ApiOperation({ summary: 'Get team analytics for PM Dashboard (PM/TL only)' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiResponse({ status: 200, description: 'Returns team analytics data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only PMs and TLs can access analytics' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  async getTeamAnalytics(@Param('teamId') teamId: string, @Req() req: Request) {
    const user = (req as any).user;
    return this.teamsService.getTeamAnalytics(teamId, user.userId);
  }

  // ============ ACTIVITY FEED ============

  @Get(':teamId/activity')
  @ApiOperation({ summary: 'Get team activity feed with pagination' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 20, max: 50)' })
  @ApiQuery({ name: 'type', required: false, enum: ActivityType, description: 'Filter by activity type' })
  @ApiResponse({ status: 200, description: 'Returns activity feed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  async getTeamActivity(
    @Param('teamId') teamId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: ActivityType,
    @Req() req?: Request,
  ) {
    const user = (req as any).user;
    // Verify membership
    await this.teamsService.getTeam(teamId, user.userId);
    
    return this.activityLogService.getTeamActivity(teamId, {
      page: page ? parseInt(page, 10) : 1,
      limit: Math.min(limit ? parseInt(limit, 10) : 20, 50),
      type,
    });
  }

  // ============ MEMBER PROGRESS ============

  @Get(':teamId/members/:memberId/progress')
  @ApiOperation({ summary: 'Get individual member progress and stats' })
  @ApiParam({ name: 'teamId', description: 'Team UUID' })
  @ApiParam({ name: 'memberId', description: 'Member User UUID' })
  @ApiResponse({ status: 200, description: 'Returns member progress data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a team member' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getMemberProgress(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    return this.teamsService.getMemberProgress(teamId, memberId, user.userId);
  }
}
