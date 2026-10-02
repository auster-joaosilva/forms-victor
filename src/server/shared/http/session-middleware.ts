import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { can, type Capability } from '../domain/permissions'
import type { SessionUser } from './session'

export const ACCESS_RESTRICTED = 'Acesso restrito.'
export const ROLE_CANNOT_REACH = 'o seu papel não alcança esta área'

export class AuthorizationError extends Error {
  constructor(readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason === 'unauthenticated' ? ACCESS_RESTRICTED : ROLE_CANNOT_REACH)
  }
}

// Os módulos do servidor (sessão, auditoria, banco) entram por import dinâmico: este arquivo também chega ao
// navegador pelo .middleware() das server functions, e uma importação estática arrastaria o Prisma para o bundle.
// A recusa vale mesmo sem a trilha: o erro do banco não pode virar 500 nem chegar ao navegador.
async function recordRefusal({ id, username, role }: SessionUser, capability: Capability, path?: string): Promise<void> {
  try {
    const { recordAccessDenied } = await import('../auth/access-audit')
    await recordAccessDenied({ id, username, role }, capability, path)
  } catch (error) {
    console.error(error)
  }
}

// A única porta para a sessão no backoffice: função que não declara capacidade não alcança context.session.
export function requireCapability(capability: Capability) {
  return createMiddleware({ type: 'function' }).server(async ({ next }) => {
    const { getSessionUser } = await import('./session')
    const user = await getSessionUser(getRequest().headers)
    if (!user) throw new AuthorizationError('unauthenticated')
    if (!can(user.role, capability)) {
      await recordRefusal(user, capability)
      throw new AuthorizationError('forbidden')
    }
    return next({ context: { session: { user } } })
  })
}

const plain = (text: string, status: number) => new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

// Handlers de rota (CSV) não passam por middleware de função, e o beforeLoad de /backoffice não roda para eles.
export async function ensureCapability(request: Request, capability: Capability): Promise<SessionUser | Response> {
  const { getSessionUser } = await import('./session')
  const user = await getSessionUser(request.headers)
  if (!user) return plain(ACCESS_RESTRICTED, 401)
  if (!can(user.role, capability)) {
    await recordRefusal(user, capability, new URL(request.url).pathname)
    return plain(ROLE_CANNOT_REACH, 403)
  }
  return user
}
