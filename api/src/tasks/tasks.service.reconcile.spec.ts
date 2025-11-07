import { TasksService } from './tasks.service';
import { Task } from './entities/tasks.entity';

describe('TasksService reconciliation', () => {
  function makeServiceWithMocks() {
    const repoEntity: any = {};

    const saved: any[] = [];
    const taskRepo: any = {
      create: (obj: any) => ({ id: 'new-' + Math.random().toString(36).slice(2), ...obj }),
      save: jest.fn(async (t: any) => {
        // clone to decouple
        const copy = JSON.parse(JSON.stringify(t));
        saved.push(copy);
        return t;
      }),
      find: jest.fn(),
    };

    const redis: any = {};
    const notificationsService: any = { emit: jest.fn(), acquireLock: jest.fn().mockResolvedValue(true), releaseLock: jest.fn() };
    const aiService: any = { isAvailable: () => false };

    // Prevent background worker from starting by overriding the private method at runtime
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (TasksService.prototype as any).startWorker = async () => {};

    // @ts-ignore
    const svc = new TasksService(repoEntity, taskRepo, redis, notificationsService, aiService);
    return { svc, taskRepo, saved };
  }

  test('shifted tasks: removes earlier task and updates line numbers for shifted tasks', async () => {
    const { svc, saved } = makeServiceWithMocks();

    // Existing tasks: A at line 1, B at line 2
    const existingTasks: Task[] = [
      {
        id: '1',
        description: 'Task A',
        type: 'TODO',
        status: 'open',
        priority: 'medium',
        filePath: 'src/file.ts',
        lineNumber: 1,
        repository: undefined as any,
        ai_summary: null as any,
        debt_score: null as any,
      } as any,
      {
        id: '2',
        description: 'Task B',
        type: 'TODO',
        status: 'open',
        priority: 'medium',
        filePath: 'src/file.ts',
        lineNumber: 2,
        repository: undefined as any,
        ai_summary: null as any,
        debt_score: null as any,
      } as any,
    ];

    // After commit: Task A removed, Task B shifted to line 1
    const currentTasks = [
      {
        description: 'Task B',
        type: 'TODO',
        priority: 'medium',
        filePath: 'src/file.ts',
        lineNumber: 1,
        status: 'open',
      },
    ];

    const commit = { id: 'c1', message: 'remove A', author: { name: 'jane', username: 'jane' }, timestamp: new Date().toISOString() };

    const res = await (svc as any).reconcileFileTasks('src/file.ts', existingTasks, currentTasks, commit, { id: 'repo' });

    // Expect one modified (B), one completed (A)
    expect(res.modified).toBe(1);
    expect(res.completed).toBe(1);
    // Check saved updates: one for modified task, one for completed
    const modifiedSaved = saved.find(s => s.id === '2' || s.description === 'Task B');
    expect(modifiedSaved).toBeDefined();
    expect(modifiedSaved.lineNumber).toBe(1);

    const completedSaved = saved.find(s => s.id === '1' || s.description === 'Task A');
    expect(completedSaved).toBeDefined();
    expect(completedSaved.status).toBe('done');
    expect(completedSaved.completedBy).toBe('jane');
  });

  test('minor edit: normalized descriptions still match and update line', async () => {
    const { svc, saved } = makeServiceWithMocks();

    const existingTasks: Task[] = [
      {
        id: '10',
        description: 'Fix bug in parser',
        type: 'TODO',
        status: 'open',
        priority: 'medium',
        filePath: 'src/parser.ts',
        lineNumber: 5,
        repository: undefined as any,
        ai_summary: null as any,
        debt_score: null as any,
      } as any,
    ];

    // Current task has minor punctuation change
    const currentTasks = [
      {
        description: 'Fix bug in parser.', // note trailing period
        type: 'TODO',
        priority: 'medium',
        filePath: 'src/parser.ts',
        lineNumber: 4,
        status: 'open',
      },
    ];

    const commit = { id: 'c2', message: 'shift and punctuate', author: { name: 'joe', username: 'joe' }, timestamp: new Date().toISOString() };

    const res = await (svc as any).reconcileFileTasks('src/parser.ts', existingTasks, currentTasks, commit, { id: 'repo' });

    expect(res.modified).toBe(1);
    expect(res.added).toBe(0);
    expect(res.completed).toBe(0);

    const mod = saved.find(s => s.description && s.description.includes('Fix bug'));
    expect(mod).toBeDefined();
    expect(mod.lineNumber).toBe(4);
    expect(mod.lastModifiedBy).toBe('joe');
  });
});
