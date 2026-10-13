import { recordAudit } from '@/server/audit/composition'
import { mailSender } from '@/server/mail/composition'
import { checkRateLimit } from '@/server/rate-limit/composition'
import { getEnv } from '@/server/shared/env'
import { betterAuthUserAccounts } from './adapters/better-auth-user-accounts'
import { resetMailerOf } from './adapters/mail-reset-mailer'
import { prismaPasswordResetTokens } from './adapters/prisma-password-reset-tokens'
import { prismaSessionEnder } from './adapters/prisma-session-ender'
import { createRandomTokenGenerator, hashToken } from './adapters/random-token-generator'
import { systemClock } from './adapters/system-clock'
import { makeCompletePasswordReset } from './application/complete-password-reset'
import { makeManageUsers } from './application/manage-users'
import { makeRequestPasswordReset } from './application/request-password-reset'
import { makeSendResetLinks } from './application/send-reset-links'
import { makeSetUserEmail } from './application/set-user-email'
import type { RateLimiter } from './ports/rate-limiter'

const manageUsers = makeManageUsers({ accounts: betterAuthUserAccounts, recordAudit })

export const listUsers = manageUsers.listUsers
export const createUser = manageUsers.createUser
export const updateUser = manageUsers.updateUser
export { IdentityError } from './domain/user'
export type { Actor, Role, UserAccount, UserChanges } from './domain/user'

const rateLimiter: RateLimiter = { check: (route, origin) => checkRateLimit({ route, origin }) }

export const requestPasswordReset = makeRequestPasswordReset({
  accounts: betterAuthUserAccounts,
  tokens: prismaPasswordResetTokens,
  tokenGenerator: createRandomTokenGenerator(),
  mailer: resetMailerOf(mailSender),
  clock: systemClock,
  rateLimiter,
  recordAudit,
  baseUrl: getEnv().APP_PUBLIC_URL,
})

export const completePasswordReset = makeCompletePasswordReset({
  tokens: prismaPasswordResetTokens,
  accounts: betterAuthUserAccounts,
  sessions: prismaSessionEnder,
  tokenHasher: { hash: hashToken },
  clock: systemClock,
  recordAudit,
})

export const setUserEmail = makeSetUserEmail({ accounts: betterAuthUserAccounts, recordAudit })

export const sendResetLinks = makeSendResetLinks({
  accounts: betterAuthUserAccounts,
  tokens: prismaPasswordResetTokens,
  tokenGenerator: createRandomTokenGenerator(),
  mailer: resetMailerOf(mailSender),
  clock: systemClock,
  recordAudit,
  baseUrl: getEnv().APP_PUBLIC_URL,
})

export type { RequestPasswordResetResult } from './application/request-password-reset'
export type { CompletePasswordResetResult } from './application/complete-password-reset'
