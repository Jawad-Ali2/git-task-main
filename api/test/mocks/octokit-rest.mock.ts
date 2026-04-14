export class Octokit {
  rest: Record<string, unknown>;

  constructor(..._args: unknown[]) {
    this.rest = {
      repos: {},
      pulls: {},
      issues: {},
      users: {},
      apps: {},
    };
  }
}
