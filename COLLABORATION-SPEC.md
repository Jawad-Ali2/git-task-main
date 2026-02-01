# 🤝 GitTask Collaboration System - Technical Specification

## 📋 Overview

This document outlines the technical implementation plan for transforming GitTask into a **Developer-PM Collaboration Platform**.

**Core Vision:** Developers stay in code, PMs see real-time progress on dashboard - no interruptions needed.

---

## 🗓️ Implementation Timeline

### Phase 1: Team & Role System (February 2026)
- Week 1-2: Backend - Team entities, APIs
- Week 3-4: Frontend - Team UI, invites, role selection

### Phase 2: Task Assignment + PM Dashboard (March 2026)  
- Week 1-2: Backend - Assignment system, team stats APIs
- Week 3-4: Frontend - PM dashboard, assignment UI, activity feed

### Phase 3: Auto-Assignment AI + Analytics (April 2026)
- Week 1-2: Backend - Developer profiling, AI suggestions
- Week 3-4: Frontend - Analytics charts, AI assignment UI

### Phase 4: Polish & Demo Prep (May 2026)
- Week 1-2: Bug fixes, performance optimization
- Week 3-4: Documentation, demo preparation, presentation

---

## 🏗️ Phase 1: Team & Role System

### Database Schema

#### 1. Team Entity
```typescript
// api/src/teams/entities/team.entity.ts

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ unique: true, length: 8 })
  inviteCode: string;  // Random 8-char code for joining

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'owner_id' })
  ownerId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => TeamMember, member => member.team)
  members: TeamMember[];

  @OneToMany(() => TeamRepository, tr => tr.team)
  repositories: TeamRepository[];
}
```

#### 2. TeamMember Entity
```typescript
// api/src/teams/entities/team-member.entity.ts

export enum TeamRole {
  OWNER = 'owner',
  PM = 'pm',           // Project Manager / Team Lead
  DEVELOPER = 'developer',
  VIEWER = 'viewer'    // Read-only access
}

@Entity('team_members')
export class TeamMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Team, team => team.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'team_id' })
  teamId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({
    type: 'enum',
    enum: TeamRole,
    default: TeamRole.DEVELOPER
  })
  role: TeamRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  // Unique constraint: user can only be in a team once
  @Index(['teamId', 'userId'], { unique: true })
}
```

#### 3. TeamRepository Entity (Link teams to repos)
```typescript
// api/src/teams/entities/team-repository.entity.ts

@Entity('team_repositories')
export class TeamRepository {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Team, team => team.repositories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'team_id' })
  teamId: string;

  @ManyToOne(() => Repository, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository: Repository;

  @Column({ name: 'repository_id' })
  repositoryId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'added_by' })
  addedBy: User;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;

  @Index(['teamId', 'repositoryId'], { unique: true })
}
```

### API Endpoints

#### Teams Controller
```typescript
// api/src/teams/teams.controller.ts

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {

  // ============ TEAM CRUD ============
  
  @Post()
  // Create a new team (user becomes owner)
  // Body: { name: string, description?: string }
  // Returns: Team with invite code
  createTeam(@Body() dto: CreateTeamDto, @GetUser() user: User)

  @Get()
  // Get all teams user belongs to
  // Returns: Team[] with role info
  getMyTeams(@GetUser() user: User)

  @Get(':teamId')
  // Get team details (must be member)
  // Returns: Team with members and repositories
  getTeam(@Param('teamId') teamId: string, @GetUser() user: User)

  @Patch(':teamId')
  // Update team (owner/PM only)
  // Body: { name?: string, description?: string }
  updateTeam(@Param('teamId') teamId: string, @Body() dto: UpdateTeamDto, @GetUser() user: User)

  @Delete(':teamId')
  // Delete team (owner only)
  deleteTeam(@Param('teamId') teamId: string, @GetUser() user: User)

  // ============ INVITES & JOINING ============

  @Post(':teamId/regenerate-invite')
  // Generate new invite code (owner/PM only)
  // Returns: { inviteCode: string }
  regenerateInviteCode(@Param('teamId') teamId: string, @GetUser() user: User)

  @Post('join/:inviteCode')
  // Join team via invite code
  // Body: { role?: 'developer' | 'pm' } - defaults to developer
  // Returns: TeamMember
  joinTeam(@Param('inviteCode') code: string, @Body() dto: JoinTeamDto, @GetUser() user: User)

  @Delete(':teamId/leave')
  // Leave a team (cannot leave if owner)
  leaveTeam(@Param('teamId') teamId: string, @GetUser() user: User)

  // ============ MEMBER MANAGEMENT ============

  @Get(':teamId/members')
  // Get all team members
  // Returns: TeamMember[] with user info
  getMembers(@Param('teamId') teamId: string, @GetUser() user: User)

  @Patch(':teamId/members/:userId/role')
  // Change member's role (owner only)
  // Body: { role: TeamRole }
  updateMemberRole(
    @Param('teamId') teamId: string,
    @Param('userId') userId: number,
    @Body() dto: UpdateRoleDto,
    @GetUser() user: User
  )

  @Delete(':teamId/members/:userId')
  // Remove member from team (owner/PM only)
  removeMember(
    @Param('teamId') teamId: string,
    @Param('userId') userId: number,
    @GetUser() user: User
  )

  // ============ REPOSITORY MANAGEMENT ============

  @Get(':teamId/repositories')
  // Get all repositories shared with team
  // Returns: Repository[] with tasks count
  getTeamRepositories(@Param('teamId') teamId: string, @GetUser() user: User)

  @Post(':teamId/repositories/:repoId')
  // Share a repository with team (must own the repo)
  shareRepository(
    @Param('teamId') teamId: string,
    @Param('repoId') repoId: number,
    @GetUser() user: User
  )

  @Delete(':teamId/repositories/:repoId')
  // Unshare repository from team
  unshareRepository(
    @Param('teamId') teamId: string,
    @Param('repoId') repoId: number,
    @GetUser() user: User
  )
}
```

### DTOs

```typescript
// api/src/teams/dto/create-team.dto.ts
export class CreateTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

// api/src/teams/dto/join-team.dto.ts
export class JoinTeamDto {
  @IsOptional()
  @IsEnum(['developer', 'pm'])
  role?: 'developer' | 'pm' = 'developer';
}

// api/src/teams/dto/update-role.dto.ts
export class UpdateRoleDto {
  @IsEnum(TeamRole)
  role: TeamRole;
}
```

### Database Migration

```typescript
// api/src/migrations/TIMESTAMP-CreateTeamEntities.ts

export class CreateTeamEntities implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create teams table
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" VARCHAR(100) NOT NULL,
        "description" VARCHAR(500),
        "invite_code" VARCHAR(8) UNIQUE NOT NULL,
        "owner_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create team_members table
    await queryRunner.query(`
      CREATE TYPE "team_role_enum" AS ENUM ('owner', 'pm', 'developer', 'viewer');
      
      CREATE TABLE "team_members" (
        "id" SERIAL PRIMARY KEY,
        "team_id" UUID NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role" team_role_enum DEFAULT 'developer',
        "joined_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("team_id", "user_id")
      )
    `);

    // Create team_repositories table
    await queryRunner.query(`
      CREATE TABLE "team_repositories" (
        "id" SERIAL PRIMARY KEY,
        "team_id" UUID NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
        "repository_id" INTEGER NOT NULL REFERENCES "repositories"("id") ON DELETE CASCADE,
        "added_by" INTEGER REFERENCES "users"("id"),
        "added_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("team_id", "repository_id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "idx_team_members_team" ON "team_members"("team_id")`);
    await queryRunner.query(`CREATE INDEX "idx_team_members_user" ON "team_members"("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_team_repos_team" ON "team_repositories"("team_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "team_repositories"`);
    await queryRunner.query(`DROP TABLE "team_members"`);
    await queryRunner.query(`DROP TYPE "team_role_enum"`);
    await queryRunner.query(`DROP TABLE "teams"`);
  }
}
```

---

## 🏗️ Phase 2: Task Assignment + PM Dashboard

### Database Changes

#### Add to Task Entity
```typescript
// Additions to api/src/tasks/entities/tasks.entity.ts

@ManyToOne(() => User, { nullable: true })
@JoinColumn({ name: 'assigned_to' })
assignedTo: User;

@Column({ name: 'assigned_to', nullable: true })
assignedToId: number;

@ManyToOne(() => User, { nullable: true })
@JoinColumn({ name: 'assigned_by' })
assignedBy: User;

@Column({ name: 'assigned_by', nullable: true })
assignedById: number;

@Column({ name: 'assigned_at', nullable: true })
assignedAt: Date;

@Column({ name: 'due_date', nullable: true })
dueDate: Date;
```

#### Activity Log Entity
```typescript
// api/src/teams/entities/activity-log.entity.ts

export enum ActivityType {
  TASK_CREATED = 'task_created',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  TASK_STATUS_CHANGED = 'task_status_changed',
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
  REPO_SHARED = 'repo_shared',
  REPO_SCANNED = 'repo_scanned'
}

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'team_id' })
  teamId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;  // Who performed the action

  @Column({ name: 'user_id' })
  userId: number;

  @Column({
    type: 'enum',
    enum: ActivityType
  })
  type: ActivityType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    taskId?: number;
    taskTitle?: string;
    repositoryId?: number;
    repositoryName?: string;
    assigneeId?: number;
    assigneeName?: string;
    oldStatus?: string;
    newStatus?: string;
    [key: string]: any;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### New API Endpoints

#### Task Assignment
```typescript
// Additions to tasks.controller.ts

@Patch(':taskId/assign')
// Assign task to a team member
// Body: { userId: number, dueDate?: Date }
assignTask(
  @Param('taskId') taskId: number,
  @Body() dto: AssignTaskDto,
  @GetUser() user: User
)

@Patch(':taskId/unassign')
// Remove assignment
unassignTask(@Param('taskId') taskId: number, @GetUser() user: User)

@Get('assigned/me')
// Get tasks assigned to current user
getMyAssignedTasks(@GetUser() user: User)

@Get('team/:teamId')
// Get all tasks for a team (from shared repos)
getTeamTasks(@Param('teamId') teamId: string, @GetUser() user: User)
```

#### PM Dashboard Endpoints
```typescript
// api/src/teams/teams.controller.ts - additions

@Get(':teamId/dashboard')
// PM Dashboard data - aggregated stats
// Returns: { overview, memberProgress, recentActivity, taskDistribution }
getTeamDashboard(@Param('teamId') teamId: string, @GetUser() user: User)

@Get(':teamId/stats')
// Team statistics
// Returns: { totalTasks, byStatus, byPriority, byMember, completionRate }
getTeamStats(@Param('teamId') teamId: string, @GetUser() user: User)

@Get(':teamId/activity')
// Activity feed with pagination
// Query: { page, limit, type? }
// Returns: ActivityLog[]
getTeamActivity(
  @Param('teamId') teamId: string,
  @Query() query: ActivityQueryDto,
  @GetUser() user: User
)

@Get(':teamId/members/:userId/progress')
// Individual member progress
// Returns: { user, tasksAssigned, tasksCompleted, inProgress, completionRate }
getMemberProgress(
  @Param('teamId') teamId: string,
  @Param('userId') userId: number,
  @GetUser() user: User
)
```

### Dashboard Response Structure
```typescript
interface TeamDashboard {
  overview: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    completionRate: number;  // percentage
    tasksCompletedThisWeek: number;
    tasksAddedThisWeek: number;
  };
  
  memberProgress: {
    userId: number;
    name: string;
    avatarUrl: string;
    role: TeamRole;
    assigned: number;
    completed: number;
    inProgress: number;
    completionRate: number;
  }[];
  
  recentActivity: ActivityLog[];  // Last 10 activities
  
  taskDistribution: {
    byType: { TODO: number; FIXME: number; HACK: number; BUG: number };
    byPriority: { high: number; medium: number; low: number };
    byRepository: { repoName: string; count: number }[];
  };
  
  trends: {
    date: string;
    completed: number;
    added: number;
  }[];  // Last 30 days
}
```

---

## 🏗️ Phase 3: Auto-Assignment AI

### Developer Profile Entity
```typescript
// api/src/teams/entities/developer-profile.entity.ts

@Entity('developer_profiles')
export class DeveloperProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', unique: true })
  userId: number;

  @Column({ type: 'jsonb', default: {} })
  expertise: {
    // File patterns the developer frequently works on
    filePatterns: string[];  // e.g., ['*.tsx', 'api/*.ts']
    
    // Directories they're familiar with
    directories: string[];   // e.g., ['src/auth', 'src/tasks']
    
    // Languages/frameworks
    technologies: string[];  // e.g., ['typescript', 'react', 'nestjs']
  };

  @Column({ type: 'jsonb', default: {} })
  stats: {
    totalTasksCompleted: number;
    averageCompletionTime: number;  // in hours
    tasksByType: { [type: string]: number };
    tasksByPriority: { [priority: string]: number };
    completionRate: number;
  };

  @Column({ name: 'current_workload', default: 0 })
  currentWorkload: number;  // Number of active tasks

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### Auto-Assignment Algorithm
```typescript
// api/src/teams/services/task-assignment-ai.service.ts

@Injectable()
export class TaskAssignmentAIService {
  
  async suggestAssignees(taskId: number, teamId: string): Promise<AssigneeSuggestion[]> {
    const task = await this.taskRepo.findOne({ where: { id: taskId }});
    const members = await this.teamMemberRepo.find({ 
      where: { teamId, role: TeamRole.DEVELOPER },
      relations: ['user', 'user.developerProfile']
    });

    const suggestions = members.map(member => {
      const profile = member.user.developerProfile;
      const score = this.calculateScore(task, profile);
      return {
        userId: member.userId,
        user: member.user,
        score,
        reasons: this.getReasons(task, profile)
      };
    });

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  private calculateScore(task: Task, profile: DeveloperProfile): number {
    let score = 0;
    
    // 1. Expertise Match (40%)
    const expertiseScore = this.calculateExpertiseMatch(task, profile);
    score += expertiseScore * 0.4;
    
    // 2. Workload Capacity (30%)
    const workloadScore = this.calculateWorkloadScore(profile);
    score += workloadScore * 0.3;
    
    // 3. Past Performance (30%)
    const performanceScore = this.calculatePerformanceScore(profile, task);
    score += performanceScore * 0.3;
    
    return Math.round(score * 100);
  }

  private calculateExpertiseMatch(task: Task, profile: DeveloperProfile): number {
    // Check if task's file path matches developer's expertise
    const taskPath = task.filePath;
    const expertise = profile?.expertise || {};
    
    // Match file patterns
    const patternMatch = expertise.filePatterns?.some(pattern => 
      minimatch(taskPath, pattern)
    ) ? 1 : 0;
    
    // Match directories
    const dirMatch = expertise.directories?.some(dir => 
      taskPath.startsWith(dir)
    ) ? 1 : 0;
    
    return (patternMatch + dirMatch) / 2;
  }

  private calculateWorkloadScore(profile: DeveloperProfile): number {
    const workload = profile?.currentWorkload || 0;
    // Lower workload = higher score
    if (workload === 0) return 1;
    if (workload <= 3) return 0.8;
    if (workload <= 5) return 0.5;
    return 0.2;
  }

  private calculatePerformanceScore(profile: DeveloperProfile, task: Task): number {
    const stats = profile?.stats || {};
    const completionRate = stats.completionRate || 0.5;
    
    // Bonus if they've completed similar task types
    const typeBonus = stats.tasksByType?.[task.type] ? 0.2 : 0;
    
    return Math.min(completionRate + typeBonus, 1);
  }

  private getReasons(task: Task, profile: DeveloperProfile): string[] {
    const reasons: string[] = [];
    
    if (profile?.expertise?.directories?.some(d => task.filePath.startsWith(d))) {
      reasons.push('Has worked on this directory before');
    }
    
    if (profile?.stats?.tasksByType?.[task.type]) {
      reasons.push(`Completed ${profile.stats.tasksByType[task.type]} ${task.type} tasks`);
    }
    
    if ((profile?.currentWorkload || 0) <= 2) {
      reasons.push('Has available capacity');
    }
    
    if ((profile?.stats?.completionRate || 0) > 0.8) {
      reasons.push('High completion rate');
    }
    
    return reasons;
  }
}

interface AssigneeSuggestion {
  userId: number;
  user: User;
  score: number;  // 0-100
  reasons: string[];
}
```

### Update Developer Profile on Task Events
```typescript
// Automatically update when tasks are completed
@OnEvent('task.completed')
async handleTaskCompleted(payload: TaskCompletedEvent) {
  const { task, userId } = payload;
  
  await this.updateDeveloperProfile(userId, {
    incrementCompleted: true,
    taskType: task.type,
    taskPriority: task.priority,
    filePath: task.filePath,
    completionTime: Date.now() - task.assignedAt.getTime()
  });
}
```

---

## 🎨 Frontend Structure

### New Pages
```
client/app/
├── teams/
│   ├── page.tsx                    # List of user's teams
│   ├── create/page.tsx             # Create new team
│   ├── join/[code]/page.tsx        # Join team via invite
│   └── [teamId]/
│       ├── page.tsx                # Team overview
│       ├── dashboard/page.tsx      # PM Dashboard
│       ├── members/page.tsx        # Member management
│       ├── repositories/page.tsx   # Team repositories
│       ├── tasks/page.tsx          # Team tasks (assignable)
│       └── settings/page.tsx       # Team settings
```

### New Redux Slices
```typescript
// client/redux/teamsSlice.ts
interface TeamsState {
  teams: Team[];
  currentTeam: Team | null;
  members: TeamMember[];
  loading: boolean;
  error: string | null;
}

// client/redux/teamDashboardSlice.ts  
interface TeamDashboardState {
  overview: DashboardOverview | null;
  memberProgress: MemberProgress[];
  activity: ActivityLog[];
  loading: boolean;
}
```

### Key Components
```
client/components/
├── teams/
│   ├── TeamCard.tsx              # Team card for list
│   ├── TeamSelector.tsx          # Dropdown to switch teams
│   ├── InviteModal.tsx           # Share invite code
│   ├── MemberList.tsx            # List members with roles
│   ├── MemberCard.tsx            # Member with progress
│   └── RoleSelector.tsx          # Change member role
├── dashboard/
│   ├── PMDashboard.tsx           # PM's main dashboard
│   ├── ProgressCards.tsx         # Overview stats
│   ├── MemberProgressGrid.tsx    # All members' progress
│   ├── ActivityFeed.tsx          # Recent activity
│   ├── TaskDistributionChart.tsx # Pie/bar charts
│   └── TrendChart.tsx            # Line chart over time
├── tasks/
│   ├── AssigneeSelector.tsx      # Dropdown to assign
│   ├── AssignmentSuggestions.tsx # AI suggestions
│   ├── TaskAssignModal.tsx       # Assign with details
│   └── MyTasksList.tsx           # Developer's assigned tasks
```

---

## 🔐 Permission Matrix

| Action | Owner | PM | Developer | Viewer |
|--------|-------|-----|-----------|--------|
| View team | ✅ | ✅ | ✅ | ✅ |
| View dashboard | ✅ | ✅ | ✅ | ✅ |
| Edit team settings | ✅ | ✅ | ❌ | ❌ |
| Delete team | ✅ | ❌ | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Change roles | ✅ | ❌ | ❌ | ❌ |
| Share repositories | ✅ | ✅ | ✅ | ❌ |
| Assign tasks | ✅ | ✅ | ❌ | ❌ |
| Claim tasks | ✅ | ✅ | ✅ | ❌ |
| Update task status | ✅ | ✅ | ✅ | ❌ |
| Scan repositories | ✅ | ✅ | ✅ | ❌ |

---

## 📝 Implementation Checklist

### Phase 1: Team & Role System
- [ ] Create Team entity and migration
- [ ] Create TeamMember entity and migration
- [ ] Create TeamRepository entity and migration
- [ ] Implement TeamsService
- [ ] Implement TeamsController
- [ ] Add team guards for authorization
- [ ] Frontend: Teams list page
- [ ] Frontend: Create team page
- [ ] Frontend: Join team page
- [ ] Frontend: Team settings page
- [ ] Frontend: Member management
- [ ] Redux: teamsSlice
- [ ] Test all endpoints

### Phase 2: Task Assignment + PM Dashboard
- [ ] Add assignment fields to Task entity
- [ ] Create ActivityLog entity
- [ ] Implement assignment endpoints
- [ ] Implement dashboard stats endpoint
- [ ] Implement activity feed endpoint
- [ ] Frontend: PM Dashboard page
- [ ] Frontend: Task assignment UI
- [ ] Frontend: Activity feed component
- [ ] Frontend: Progress charts
- [ ] Redux: teamDashboardSlice
- [ ] Test assignment flow

### Phase 3: Auto-Assignment AI
- [ ] Create DeveloperProfile entity
- [ ] Implement profile tracking service
- [ ] Implement suggestion algorithm
- [ ] Add suggestion endpoint
- [ ] Frontend: AI suggestions component
- [ ] Frontend: Assignment modal with suggestions
- [ ] Test AI suggestions

### Phase 4: Polish
- [ ] Error handling improvements
- [ ] Loading states
- [ ] Empty states
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Documentation
- [ ] Demo preparation

---

## 🚀 Getting Started

### Step 1: Create the teams module
```bash
cd api
nest g module teams
nest g controller teams
nest g service teams
```

### Step 2: Create entities
Create files in `api/src/teams/entities/`:
- team.entity.ts
- team-member.entity.ts
- team-repository.entity.ts

### Step 3: Create migration
```bash
npm run migration:generate -- src/migrations/CreateTeamEntities
npm run migration:run
```

### Step 4: Implement service and controller
Follow the specifications above.

### Step 5: Test with Postman/curl
```bash
# Create team
curl -X POST http://localhost:5000/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Team"}'

# Join team
curl -X POST http://localhost:5000/teams/join/ABC12345 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📚 Resources

- [NestJS Guards](https://docs.nestjs.com/guards)
- [TypeORM Relations](https://typeorm.io/relations)
- [Chart.js for React](https://react-chartjs-2.js.org/)
- [Recharts (alternative)](https://recharts.org/)

---

*Document created: January 31, 2026*
*Last updated: January 31, 2026*
