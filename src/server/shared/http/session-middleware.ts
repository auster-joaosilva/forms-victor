import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { can, type Capability } from '../domain/permissions'
import { recordAccessDenied } from '../auth/access-audit'
import { getSessionUser, type SessionUser } from './session'

export const ACCESS_RESTRICTED = 'Acesso restrito.'
export const ROLE_CANNOT_REACH = 'o seu papel não alcança esta área'

export class AuthorizationError extends Error {
  constructor(readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason === 'unauthenticated' ? ACCESS_RESTRICTED : ROLE_CANNOT_REACH)
  }
}

const actorOf = ({ id, username, role }: SessionUser) => ({ id, username, role })

// A única porta para a sessão no backoffice: função que não declara capacidade não alcança context.session.
export function requireCapability(capability: Capability) {
  return createMiddleware({ type: 'function' }).server(async ({ next }) => {
    const user = await getSessionUser(getRequest().headers)
    if (!user) throw new AuthorizationError('unauthenticated')
    if (!can(user.role, capability)) {
      await recordAccessDenied(actorOf(user), capability)
      throw new AuthorizationError('forbidden')
    }
    return next({ context: { session: { user } } })
  })
}

const plain = (text: string, status: number) => new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

// Handlers de rota (CSV) não passam por middleware de função, e o beforeLoad de /backoffice não roda para eles.
export async function ensureCapability(request: Request, capability: Capability): Promise<SessionUser | Response> {
  const user = await getSessionUser(request.headers)
  if (!user) return plain(ACCESS_RESTRICTED, 401)
  if (!can(user.role, capability)) {
    await recordAccessDenied(actorOf(user), capability, new URL(request.url).pathname)
    return plain(ROLE_CANNOT_REACH, 403)
  }
  return user
}
