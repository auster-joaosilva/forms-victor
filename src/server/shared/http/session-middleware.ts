import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getSessionUser } from './session'

export class AuthorizationError extends Error {
  constructor(readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason)
  }
}

export const sessionMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const user = await getSessionUser(getRequest().headers)
  if (!user) throw new AuthorizationError('unauthenticated')
  return next({ context: { session: { user } } })
})

export const adminMiddleware = createMiddleware({ type: 'function' })
  .middleware([sessionMiddleware])
  .server(async ({ next, context }) => {
    if (context.session.user.role !== 'admin') throw new AuthorizationError('forbidden')
    return next()
  })
