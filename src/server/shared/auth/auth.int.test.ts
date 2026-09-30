import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { prisma } from '../prisma/client'
import { auth } from './auth'

const signIn = (username: string, password: string) =>
  auth.handler(
    new Request('http://localhost:3000/api/auth/sign-in/username', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-real-ip': '9.9.9.9' },
      body: JSON.stringify({ username, password }),
    }),
  )

describe('auth', () => {
  beforeEach(async () => {
    await resetDatabase()
    await auth.api.createUser({
      body: { email: 'ana@users.invalid', password: 'senha-bem-longa-1', name: 'Ana', role: 'admin', data: { username: 'ana' } },
    })
  })

  it('signs in by username and records the login', async () => {
    const response = await signIn('ana', 'senha-bem-longa-1')
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toMatch(/forms\.session_token=/)
    const entries = await prisma.auditLog.findMany()
    expect(entries.map((e) => e.action)).toContain('login')
    expect((await prisma.user.findUnique({ where: { username: 'ana' } }))?.lastLoginAt).not.toBeNull()
  })

  it('records a denied access', async () => {
    const response = await signIn('ana', 'errada-errada-errada')
    expect(response.status).toBe(401)
    const denied = await prisma.auditLog.findFirst({ where: { action: 'access_denied' } })
    expect(denied?.reference).toBe('ana')
  })

  it('refuses public sign-up', async () => {
    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ email: 'x@y.com', password: 'senha-bem-longa-1', name: 'X', username: 'xavier' }),
      }),
    )
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(await prisma.user.count()).toBe(1)
  })

  it('closes admin endpoints to HTTP calls', async () => {
    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/admin/list-users', { headers: { origin: 'http://localhost:3000' } }),
    )
    expect(response.status).toBe(403)
  })
})
