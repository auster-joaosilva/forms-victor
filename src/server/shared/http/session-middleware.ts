import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '../auth/auth'

export class AuthorizationError extends Error {
  constructor(readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason)
  }
}

export const sessionMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session || session.user.banned) throw new AuthorizationError('unauthenticated')
  const user = {
    id: session.user.id,
    username: session.user.username ?? '',
    name: session.user.name,
    role: session.user.role === 'admin' ? ('admin' as const) : ('team' as const),
  }
  return next({ context: { session: { user } } })
})

export const adminMiddleware = createMiddleware({ type: 'function' })
  .middleware([sessionMiddleware])
  .server(async ({ next, context }) => {
    if (context.session.user.role !== 'admin') throw new AuthorizationError('forbidden')
    return next()
  })
