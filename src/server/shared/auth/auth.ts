import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin, username } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { prisma } from '../prisma/client'
import { getEnv } from '../env'
import { recordAudit } from '@/server/audit/composition'
import { CLIENT_IP_HEADER, requestOrigin } from '../http/request-origin'

export const USERNAME_RULE = /^[a-z][a-z0-9._-]{2,31}$/
export const MINIMUM_PASSWORD = 12
const SIGN_IN_PATH = '/sign-in/username'
const HTTP_ALLOWED_PATHS = new Set([SIGN_IN_PATH, '/get-session', '/sign-out', '/ok', '/error'])

export function auditableUsername(raw: unknown): string | null {
  const username = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return USERNAME_RULE.test(username) ? username : null
}

const env = getEnv()

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: MINIMUM_PASSWORD, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 60 },
  rateLimit: {
    enabled: true,
    storage: 'database',
    modelName: 'rateLimit',
    window: 60,
    max: 60,
    customRules: { [SIGN_IN_PATH]: { window: 60, max: 5 } },
  },
  advanced: {
    cookiePrefix: 'forms',
    useSecureCookies: env.NODE_ENV === 'production',
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
  },
  plugins: [
    username({ minUsernameLength: 3, maxUsernameLength: 32, usernameValidator: (value) => USERNAME_RULE.test(value) }),
    admin({ defaultRole: 'operator', adminRoles: ['admin'] }),
    tanstackStartCookies(),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!ctx.request) return
      if (ctx.path.startsWith('/admin/')) throw new APIError('FORBIDDEN')
      if (!HTTP_ALLOWED_PATHS.has(ctx.path)) throw new APIError('NOT_FOUND')
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return
      const attempted = auditableUsername((ctx.body as { username?: unknown } | undefined)?.username)
      const origin = ctx.request ? requestOrigin(ctx.request.headers) : null
      const returned = ctx.context.returned
      if (returned instanceof APIError) {
        await recordAudit({ action: 'access_denied', actorUsername: attempted, reference: attempted, detail: { reason: returned.message, ...origin } })
        return
      }
      const user = ctx.context.newSession?.user
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        await recordAudit({ action: 'login', actorId: user.id, actorUsername: attempted, detail: { ...origin } })
      }
    }),
  },
})
