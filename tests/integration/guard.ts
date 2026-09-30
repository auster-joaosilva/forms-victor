export function assertTestDatabase(env: NodeJS.ProcessEnv = process.env): void {
  const name = env.DATABASE_URL ? new URL(env.DATABASE_URL).pathname.replace(/^\//, '') : ''
  if (env.NODE_ENV !== 'test' || !name.endsWith('_test')) {
    throw new Error(`Testes de integração só rodam com NODE_ENV=test contra um banco *_test (recebido: NODE_ENV=${env.NODE_ENV ?? ''}, banco=${name || '?'}).`)
  }
}
