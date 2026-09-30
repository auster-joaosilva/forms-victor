import { serve } from 'srvx'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { prisma } from '../prisma/client'
import { authHandler } from '../http/session'
import { auditableUsername, auth } from './auth'

const signIn = (username: string, password: string, ip = '9.9.9.9') =>
  authHandler(
    new Request('http://localhost:3000/api/auth/sign-in/username', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-real-ip': ip },
      body: JSON.stringify({ username, password }),
    }),
  )

const CLOUDFLARE_EDGE = '172.68.10.20'

const signInThroughHandler = (password: string, headers: Record<string, string>) =>
  authHandler(
    new Request('http://localhost:3000/api/auth/sign-in/username', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', ...headers },
      body: JSON.stringify({ username: 'ana', password }),
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

  it('refuses over HTTP every endpoint outside the allowlist', async () => {
    const requests = [
      ['GET', '/is-username-available?username=ana'],
      ['POST', '/is-username-available'],
      ['POST', '/unlink-account'],
      ['GET', '/list-accounts'],
      ['GET', '/list-sessions'],
      ['POST', '/revoke-sessions'],
      ['POST', '/sign-up/email'],
    ] as const
    for (const [method, path] of requests) {
      const response = await auth.handler(
        new Request(`http://localhost:3000/api/auth${path}`, {
          method,
          headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
          ...(method === 'POST' ? { body: JSON.stringify({ username: 'ana', providerId: 'credential' }) } : {}),
        }),
      )
      expect(response.status, `${method} ${path}`).toBe(404)
    }
  })

  it('keeps the allowlisted endpoints open over HTTP', async () => {
    const signed = await signIn('ana', 'senha-bem-longa-1')
    const cookie = (signed.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    const headers = { origin: 'http://localhost:3000', cookie }
    const session = await auth.handler(new Request('http://localhost:3000/api/auth/get-session', { headers }))
    expect(session.status).toBe(200)
    expect(((await session.json()) as { user?: { username?: string } } | null)?.user?.username).toBe('ana')
    expect((await auth.handler(new Request('http://localhost:3000/api/auth/ok', { headers }))).status).toBe(200)
    const out = await auth.handler(new Request('http://localhost:3000/api/auth/sign-out', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' }))
    expect(out.status).toBe(200)
    expect(await prisma.session.count()).toBe(0)
  })

  it('keeps the server-side user management API', async () => {
    const created = await auth.api.createUser({
      body: { email: 'bia@users.invalid', password: 'senha-bem-longa-2', name: 'Bia', data: { username: 'bia' } },
    })
    expect(created.user.id).toBeTruthy()
    const signed = await auth.api.signInEmail({ body: { email: 'bia@users.invalid', password: 'senha-bem-longa-2' }, asResponse: true })
    const cookie = (signed.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(session?.user.email).toBe('bia@users.invalid')
    await auth.api.signOut({ headers: new Headers({ cookie }) })
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull()
  })

  it('stores only a well-formed attempted username in the audit', async () => {
    expect(auditableUsername('  Ana.Souza ')).toBe('ana.souza')
    expect(auditableUsername('x'.repeat(5000))).toBeNull()
    expect(auditableUsername('1ana')).toBeNull()
    expect(auditableUsername(42)).toBeNull()
    const response = await signIn('<script>'.repeat(200), 'errada-errada-errada')
    expect(response.status).toBeGreaterThanOrEqual(400)
    const denied = await prisma.auditLog.findMany({ where: { action: 'access_denied' } })
    expect(denied).toHaveLength(1)
    expect(denied[0]?.actorUsername).toBeNull()
    expect(denied[0]?.reference).toBeNull()
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

  it('keys the sign-in rate limit by the client behind Cloudflare', async () => {
    const behind = (client: string) => ({ 'x-real-ip': CLOUDFLARE_EDGE, 'cf-connecting-ip': client })
    for (let attempt = 0; attempt < 5; attempt++) expect((await signInThroughHandler('errada-errada-errada', behind('200.1.1.1'))).status).toBe(401)
    expect((await signInThroughHandler('errada-errada-errada', behind('200.1.1.1'))).status).toBe(429)
    expect((await signInThroughHandler('errada-errada-errada', behind('200.2.2.2'))).status).toBe(401)
    const keys = (await prisma.rateLimit.findMany()).map((row) => row.key)
    expect(keys).toEqual(expect.arrayContaining(['200.1.1.1|/sign-in/username', '200.2.2.2|/sign-in/username']))
    expect(keys.some((key) => key.startsWith(CLOUDFLARE_EDGE))).toBe(false)
  })

  it('keys a forged CF-Connecting-IP from outside Cloudflare by the real peer', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const forged = { 'x-real-ip': '86.1.1.1', 'cf-connecting-ip': `200.3.3.${attempt}`, 'x-client-ip': `200.4.4.${attempt}` }
      expect((await signInThroughHandler('errada-errada-errada', forged)).status).toBe(401)
    }
    expect((await signInThroughHandler('errada-errada-errada', { 'x-real-ip': '86.1.1.1', 'cf-connecting-ip': '200.9.9.9' })).status).toBe(429)
    const keys = (await prisma.rateLimit.findMany()).map((row) => row.key)
    expect(keys).toEqual(['86.1.1.1|/sign-in/username'])
  })

  it('resolves the client through the production HTTP server', async () => {
    const server = serve({ port: 0, hostname: '127.0.0.1', silent: true, fetch: authHandler })
    await server.ready()
    try {
      const response = await fetch(new URL('/api/auth/sign-in/username', server.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000', 'x-real-ip': CLOUDFLARE_EDGE, 'cf-connecting-ip': '200.5.5.5', 'x-client-ip': '6.6.6.6' },
        body: JSON.stringify({ username: 'ana', password: 'senha-bem-longa-1' }),
      })
      expect(response.status).toBe(200)
      expect((await prisma.session.findFirst())?.ipAddress).toBe('200.5.5.5')
      expect((await prisma.rateLimit.findMany()).map((row) => row.key)).toEqual(['200.5.5.5|/sign-in/username'])
    } finally {
      await server.close(true)
    }
  })
})
