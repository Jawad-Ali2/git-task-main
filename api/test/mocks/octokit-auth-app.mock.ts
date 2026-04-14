export function createAppAuth(..._args: unknown[]) {
  return async () => ({
    token: 'test-token',
  });
}
