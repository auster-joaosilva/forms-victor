import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'

// O plugin tanstackStartCookies grava cookies pelo contexto do TanStack, que não existe fora de um pedido; aqui basta a resposta.
vi.mock('@tanstack/react-start/server', () => ({ setCookie: () => undefined, getCookie: () => undefined, getRequest: () => undefined }))

const { auth } = await import('@/server/shared/auth/auth')
const { prisma } = await import('@/server/shared/prisma/client')
const { betterAuthUserAccounts } = await import('@/server/identity/adapters/better-auth-user-accounts')
const { ensureCapability } = await import('./session-middleware')

async function signedInRequest(username: string, password: string): Promise<Request> {
  const response = await auth.api.signInUsername({ body: { username, password }, asResponse: true })
  const cookie = response.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
  return new Request('http://localhost/backoffice/adhesions.csv', { headers: { cookie } })
}

describe('capabilities against a real session', () => {
  beforeEach(resetDatabase)

  it('stops answering on the next request after the role is lowered, and records the refusal', async () => {
    await betterAuthUserAccounts.create({ username: 'rui', name: 'Rui', password: 'senha-bem-longa-1', role: 'regularization' })
    const request = await signedInRequest('rui', 'senha-bem-longa-1')

    expect(await ensureCapability(request, 'view_adhesions')).toMatchObject({ username: 'rui', role: 'regularization' })

    await prisma.user.update({ where: { username: 'rui' }, data: { role: 'operator' } })
    const refused = await ensureCapability(request, 'view_adhesions')
    expect(refused).toBeInstanceOf(Response)
    expect((refused as Response).status).toBe(403)

    const denied = await prisma.auditLog.findFirst({ where: { action: 'access_denied', reference: 'view_adhesions' } })
    expect(denied).toMatchObject({ actorUsername: 'rui', detail: { role: 'operator', required: 'view_adhesions', path: '/backoffice/adhesions.csv' } })
  })
})
