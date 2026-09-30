import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { prisma } from '../prisma/client'
import { auth } from './auth'

const signIn = (username: string, password: string, ip = '9.9.9.9') =>
  auth.handler(
    new Request('http://localhost:3000/api/auth/sign-in/username', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-real-ip': ip },
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

  it('closes the native account endpoints and e-mail sign-in to HTTP calls', async () => {
    const paths = ['/sign-in/email', '/update-user', '/change-password', '/change-email', '/delete-user', '/delete-user/callback']
    for (const path of paths) {
      const response = await auth.handler(
        new Request(`http://localhost:3000/api/auth${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
          body: JSON.stringify({ email: 'ana@users.invalid', password: 'senha-bem-longa-1' }),
        }),
      )
      expect(response.status, path).toBe(404)
    }
    expect(await prisma.auditLog.count({ where: { action: 'login' } })).toBe(0)
  })

  it('keeps the server-side API the bootstrap relies on', async () => {
    const context = await auth.$context
    const hash = await context.password.hash('outra-senha-longa-2')
    expect(await context.password.verify({ hash, password: 'outra-senha-longa-2' })).toBe(true)
    const signed = await auth.api.signInEmail({ body: { email: 'ana@users.invalid', password: 'senha-bem-longa-1' } })
    expect(signed.token).toBeTruthy()
  })

  it('keys the sign-in rate limit by X-Real-IP', async () => {
    for (let attempt = 0; attempt < 5; attempt++) expect((await signIn('ana', 'errada-errada-errada', '7.7.7.7')).status).toBe(401)
    expect((await signIn('ana', 'errada-errada-errada', '7.7.7.7')).status).toBe(429)
    expect((await signIn('ana', 'errada-errada-errada', '8.8.8.8')).status).toBe(401)
    const keys = (await prisma.rateLimit.findMany()).map((row) => row.key)
    expect(keys).toEqual(expect.arrayContaining(['7.7.7.7|/sign-in/username', '8.8.8.8|/sign-in/username']))
  })
})
