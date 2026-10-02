import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { recordAccessDenied } from '../auth/access-audit'
import { can, type Capability } from '../domain/permissions'
import { ACCESS_RESTRICTED, ROLE_CANNOT_REACH } from './access-messages'
import { getSessionUser } from './session'

export class AuthorizationError extends Error {
  constructor(readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason === 'unauthenticated' ? ACCESS_RESTRICTED : ROLE_CANNOT_REACH)
  }
}

// A única porta para a sessão no backoffice: função que não declara capacidade não alcança context.session.
// Sessão e auditoria só são usadas dentro do .server(), que o build do navegador descarta junto com as importações.
export function requireCapability(capability: Capability) {
  return createMiddleware({ type: 'function' }).server(async ({ next }) => {
    const user = await getSessionUser(getRequest().headers)
    if (!user) throw new AuthorizationError('unauthenticated')
    if (!can(user.role, capability)) {
      // A recusa vale mesmo sem a trilha: o erro do banco não pode virar 500 nem chegar ao navegador.
      try {
        await recordAccessDenied({ id: user.id, username: user.username, role: user.role }, capability)
      } catch (error) {
        console.error(error)
      }
      throw new AuthorizationError('forbidden')
    }
    return next({ context: { session: { user } } })
  })
}
