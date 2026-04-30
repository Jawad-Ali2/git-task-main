# Plan: E2E Test Suite for Git Task Management System

## TL;DR
Build comprehensive E2E test coverage (Playwright frontend + backend API integration tests) across all 7 critical user journeys: OAuth authentication, repository onboarding, task scanning, task management, integrations (Trello/Jira), dashboard analytics, and AI insights. Include happy paths, error scenarios (401/403/404, token expiry, rate limits), and edge cases. Test across desktop and mobile viewports. Organize into 3 implementation phases: Phase 1 (core auth + repo + scanning), Phase 2 (integrations + filters + errors), Phase 3 (edge cases + analytics + accessibility).

## Test Scope Overview

### User Journeys to Cover (7 Total)
1. **GitHub OAuth Authentication** - Login, token refresh, logout, session persistence
2. **Repository Selection & Onboarding** - Browse repos, search, pagination, select multiple, save, limits
3. **Task Scanning & Extraction** - Queue scans, monitor progress, view extracted tasks, webhook triggers
4. **Task Management & Filtering** - View tasks, filter by status/repo/priority, update status, details view
5. **External Integrations** - Connect Trello/Jira, configure sync, manage integrations
6. **Dashboard Analytics** - View stats, charts, activity feed
7. **AI Insights** (Premium) - Query codebase, view analysis results, save insights

### Coverage Levels
- **Happy Path**: Primary successful workflow for each journey
- **Error Scenarios**: 401/403 (expired token, invalid auth), 404 (deleted repo), 500 (server error), rate limits
- **Edge Cases**: 20-repo limit enforcement, duplicate repo handling, token rotation, webhook retry logic
- **Viewports**: Desktop (1280px), Tablet (768px), Mobile (375px)

## Steps

### Phase 1: Authentication + Core Workflows (Foundation)
*Weeks 1-2*

1. **Setup Test Infrastructure**
   - Install dependencies: `npm install --save-dev @playwright/test dotenv`
   - Create `client/playwright/fixtures.ts` for auth fixture (login once, reuse session)
   - Create `client/playwright/api-helpers.ts` for API request utilities (JWT headers, cookies)
   - Create `client/e2e/helpers/database.ts` for DB cleanup between tests
   - Create `.env.test` with test-specific API URLs and credentials
   - Configure `playwright.config.ts` to use test database/Redis
   - Create test data factory: `client/e2e/fixtures/test-data.ts` (user profiles, repos, tasks)

2. **GitHub OAuth Flow Tests** (Happy path + errors)
   - ✅ REUSE: Existing `auth.setup.ts` for session initialization
   - Test: Complete OAuth flow → redirect to dashboard → session persists on reload
   - Test: Logout clears tokens and redirects to login
   - Test: Invalid/expired GitHub token returns 401 → redirect to login
   - Test: Token refresh automatically when access token expires
   - Test: Malformed cookie/header returns 401
   - Test: GitHub API rate limit (429) handled gracefully

3. **Repository Discovery & Selection Tests** (Happy path + errors + edge cases)
   - Test: Repositories page loads → fetches GitHub repos with pagination (first 20)
   - Test: Search filters repos by name/language
   - Test: Pagination navigation (next/prev/go to page)
   - Test: Select/deselect multiple repos → enable save button
   - Test: Save 1-20 repos successfully → database persists
   - **Edge**: Attempt to save 21+ repos → error + limit enforced
   - **Edge**: Duplicate repo selection → deduplicated
   - **Error**: No GitHub repos available → empty state message
   - **Error**: GitHub API returns 403 (token expired) → 401 redirect

4. **Task Scanning Initiation Tests** (Happy path + errors)
   - Test: From repositories page, click "Scan" → scan queued, status modal appears
   - Test: Scan progress visible (0% → 100%)
   - Test: Scan completes → task list auto-populates
   - Test: Multiple repos can scan simultaneously
   - **Error**: Scan fails mid-way (500) → retry option appears
   - **Error**: Cancel scan → stop job, mark as cancelled
   - **Error**: Webhook trigger with malformed payload → logged but no crash

5. **Task Viewing & Basic Filters Tests** (Happy path + errors)
   - Test: Completed scan shows tasks list with TODOs extracted
   - Test: Display: file path, line number, priority, description, status
   - Test: Filter by status (Pending/In Progress/Completed)
   - Test: Filter by repository (dropdown)
   - Test: Sort by priority/date/file
   - Test: Task count updated after status change
   - **Error**: No tasks extracted → empty state (e.g., "No TODOs found")

6. **Database Cleanup & Teardown**
   - Create test helper to delete test user, repos, tasks after each test
   - Use API endpoint (if exists) or direct DB delete via TypeORM
   - Ensure no cross-test contamination

**Verification**:
- Run Phase 1 tests → all pass on clean database
- Coverage: ~30 test cases covering authentication, repo selection, scanning, basic filtering
- No flaky tests (can run 5x in a row reliably)

---

### Phase 2: Integrations + Advanced Filters + Error Handling
*Weeks 3-4*

7. **Task Status Update Tests** (Happy path + errors)
   - Test: Click task → toggle status (pending → in progress → completed)
   - Test: Status persists in database
   - Test: Task count in header updates
   - Test: Bulk update multiple tasks to same status
   - **Error**: Update fails (500) → undo/retry option
   - **Error**: Task deleted while editing → 404 error

8. **Trello Integration Tests** (Happy path + errors)
   - Test: Navigate to Integrations → click "Connect Trello"
   - Test: Trello OAuth flow → authorize → redirect back with token stored
   - Test: Select repository → assign Trello board
   - Test: Enable "Auto-sync Tasks" → new tasks sync to Trello
   - Test: View synced tasks in task list (Trello icon indicator)
   - **Error**: Trello OAuth cancelled → stay on integrations page
   - **Error**: Invalid Trello board (deleted) → sync fails, error notification
   - **Edge**: Disconnect Trello → existing synced tasks retain data, no new syncs

9. **Jira Integration Tests** (Similar to Trello)
   - Test: Connect Jira OAuth flow → select project
   - Test: Task sync to Jira → verify Jira issue created
   - Test: Update task status → Jira issue status updated
   - **Error**: Jira API returns 401 (invalid token) → disconnect + reconnect prompt

10. **Advanced Task Filtering Tests**
    - Test: Filter by repository + status + priority (combined)
    - Test: Search tasks by keyword in description
    - Test: Clear all filters → reset to default view
    - Test: Save filter preferences (localStorage/Redux)
    - Test: Pagination for large task lists (100+ tasks)
    - Test: Filters work correctly on mobile viewport (375px)

11. **Error Scenarios - Token & Auth** (Across all endpoints)
    - Test: Access token expires → automatic refresh using refresh token
    - Test: Refresh token expired → logout + redirect to login
    - Test: Tampered JWT → 401 error
    - Test: Cookie removed → all endpoints return 401
    - Test: CORS origin mismatch → request blocked
    - Test: API unavailable (500) → retry with exponential backoff
    - Test: Network offline → graceful fallback (if offline support needed)

12. **Error Scenarios - Data Constraints**
    - Test: Repo limit (20) enforced → cannot save 21st
    - Test: Task creation with missing fields → validation error
    - Test: Duplicate task detection (fuzzy match 0.8 threshold)
    - Test: File size limit (5MB) enforced during scan
    - Test: Commit limit (50 commits) enforced during scan

13. **Responsive Design Tests** (Desktop, Tablet, Mobile)
    - Test: Dashboard layout on mobile (375px) → responsive menu, stacked layout
    - Test: Repo selection modal on tablet (768px) → readable checkboxes
    - Test: Task list on mobile → vertical scroll, compact view
    - Test: Integration modals responsive on all viewports
    - Test: Forms and buttons clickable on mobile (min 44px touch targets)

**Verification**:
- Phase 1 + 2 tests pass (~60 test cases total)
- All error scenarios return appropriate HTTP status and UI feedback
- Responsive tests pass on 3 viewports
- No console errors or warnings

---

### Phase 3: Edge Cases + Analytics + Accessibility
*Week 5*

14. **Webhook Processing Tests** (GitHub push events)
    - Test: Push webhook triggers → scan queued (if repo monitored)
    - Test: Multiple pushes batched → one scan job
    - Test: Pull webhook ignored (no action)
    - **Error**: Malformed webhook payload → logged, no crash
    - **Error**: Invalid GitHub signature → rejected

15. **Dashboard Analytics Tests**
    - Test: Dashboard loads → stats card shows total tasks/repos/% complete
    - Test: Task distribution chart renders (by repo/status)
    - Test: Activity feed shows recent task updates
    - Test: Stats update in real-time after task status change
    - Test: Loading skeleton visible while fetching stats
    - **Error**: Analytics API fails → fallback UI (no chart, just text stats)

16. **AI Insights Tests** (Premium feature)
    - Test: AI Insights page loads (if premium user)
    - Test: Enter query → send to OpenAI → display results
    - Test: Save insights → stored in Redux/localStorage
    - Test: Delete insight → removed from list
    - **Error**: OpenAI API fails (rate limit, 500) → friendly error message
    - **Error**: User not premium → paywall shown

17. **Edge Cases & Rare Scenarios**
    - Test: User has 0 repos → onboarding message
    - Test: User has 0 tasks across all repos → empty state
    - Test: Repo deleted on GitHub → handling in app (still shows in DB)
    - Test: Task line number changed → still display correctly
    - Test: Very long file paths (>256 chars) → truncate with tooltip
    - Test: Task description with special chars/unicode → render correctly
    - Test: Concurrent edits (two tabs, same task) → last-write-wins or lock

18. **Accessibility (a11y) Tests**
    - Test: All buttons/links have keyboard focus visible
    - Test: Form labels associated with inputs
    - Test: Error messages announce with ARIA
    - Test: Modal dialogs trap focus (Tab within modal)
    - Test: Page headings semantic (H1 → H2 → H3)
    - Test: Images have alt text
    - Test: Color contrast ≥ 4.5:1 for text
    - Test: Screen reader navigation (using Playwright's a11y scanner)

19. **Performance & Load Tests** (Optional)
    - Test: Dashboard with 1000 tasks loads in <3s
    - Test: Repo list pagination with 100+ repos
    - Test: Scroll performance on large task lists (smooth scrolling)
    - Test: No memory leaks after opening/closing modals

**Verification**:
- All Phase 1 + 2 + 3 tests pass (~80-100 test cases total)
- Accessibility audit passes (WCAG 2.1 AA standard)
- No flaky tests after 10 consecutive runs
- Coverage report shows >80% critical path coverage

---

## Relevant Files

### Test Files to Create
- `client/e2e/auth.spec.ts` — Expand existing, add token refresh, logout, session tests
- `client/e2e/repositories.spec.ts` — Repository discovery, search, selection, save
- `client/e2e/scanning.spec.ts` — Scan queuing, progress, completion, webhook triggers
- `client/e2e/tasks.spec.ts` — Task viewing, filtering, status updates, sorting
- `client/e2e/integrations.spec.ts` — Trello/Jira OAuth, setup, sync, disconnection
- `client/e2e/dashboard.spec.ts` — Analytics, stats, activity feed
- `client/e2e/ai-insights.spec.ts` — Query, results, save, premium gating
- `client/e2e/errors.spec.ts` — 401/403/404/500 scenarios, token refresh, rate limits
- `client/e2e/responsive.spec.ts` — Mobile/tablet layout tests (or per-file viewport config)
- `client/e2e/accessibility.spec.ts` — a11y testing
- `client/playwright/fixtures.ts` — Auth fixture, test user setup
- `client/playwright/api-helpers.ts` — HTTP utilities for API calls with proper headers
- `client/e2e/helpers/database.ts` — DB cleanup, reset between tests
- `client/e2e/fixtures/test-data.ts` — Factory functions for repos, tasks, users
- `client/.env.test` — Test environment variables

### Existing Files to Extend/Modify
- `playwright.config.ts` — Add test database config, viewport settings, retry logic, reporter
- `package.json` — Add E2E test script, coverage tool (if needed)
- `api/.env.test` — Test database (separate from dev), test Redis
- `api/src/auth/auth.service.ts` — Ensure refresh endpoint functional
- `api/src/tasks/tasks.service.ts` — Ensure status update endpoint exists for testing

## Verification

### Pre-Implementation
- [ ] Review existing auth.setup.ts and auth.spec.ts, understand current structure
- [ ] Verify `playwright.config.ts` has test DB configuration
- [ ] Check that API has DELETE endpoints for tests to cleanup (or create seed/teardown endpoints)
- [ ] Confirm environment variables are test-safe (isolation from dev/prod)

### During Implementation (Per Phase)
- [ ] Run tests locally → all pass
- [ ] Run tests 5x consecutively → no flakiness
- [ ] Check for console errors/warnings → clean output
- [ ] Verify database cleanup works → no cross-test contamination
- [ ] Test on CI pipeline → passes on first run

### Post-Implementation
- [ ] Generate coverage report → >80% critical paths
- [ ] Run full suite on clean database → all pass
- [ ] Measure test suite duration → target <15 min total
- [ ] Accessibility audit → WCAG 2.1 AA pass
- [ ] Code review test structure → follow Playwright best practices

## Decisions (FINAL)
- **Framework**: Playwright (already in use, supports all requirements)
- **Test Database**: Separate test DB for isolation (separate from dev)
- **Auth Strategy**: Keep existing real OAuth with automated OTP (GitHub) — NOT hardcoded. For Trello/Jira: use real test app credentials OR mock Playwright requests if test apps unavailable
- **No Hardcoding**: Your existing `auth.setup.ts` with automated OTP is the right approach — reuse it
- **Mocking**: Use real API + test database for all tests (integration tests). For Trello/Jira, optionally mock if needed for speed
- **Scope**: Phases 1-3 as planned; exclude load/performance testing (add later if needed)
- **Accessibility**: Manual a11y tests using Playwright built-ins
- **Mobile Testing**: Playwright viewport settings (not real devices)

## Implementation Approach
- **Shared Test User**: One test user per test run (reused across test files, cleared between test suites)
- **Database Cleanup**: Truncate tables between test file suites (not per individual test — faster)
- **CI Database**: Use Docker Compose with PostgreSQL (same as local dev)
