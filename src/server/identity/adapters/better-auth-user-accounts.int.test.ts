import { beforeEach, describe, expect, it } from 'vitest'
import { resetDatabase } from '../../../../tests/integration/db'
import { auth } from '@/server/shared/auth/auth'
import { prisma } from '@/server/shared/prisma/client'
import { IdentityError } from '../domain/user'
import { betterAuthUserAccounts } from './better-auth-user-accounts'

const input = { username: 'bia', name: 'Bia', password: 'x'.repeat(12), role: 'operator' as const }

describe('betterAuthUserAccounts.create', () => {
  beforeEach(resetDatabase)

  it('creates each of the four roles', async () => {
    for (const [username, role] of [['gil', 'manager'], ['rui', 'regularization'], ['ivo', 'operator'], ['ana', 'admin']] as const) {
      expect((await betterAuthUserAccounts.create({ ...input, username, role })).role).toBe(role)
    }
    expect(await betterAuthUserAccounts.countActiveAdmins()).toBe(1)
  })

  it('maps a duplicate username to username_taken', async () => {
    await betterAuthUserAccounts.create(input)
    await expect(betterAuthUserAccounts.create(input)).rejects.toMatchObject({ reason: 'username_taken' })
    await expect(betterAuthUserAccounts.create(input)).rejects.toBeInstanceOf(IdentityError)
  })

  it('maps a concurrent duplicate to username_taken', async () => {
    const results = await Promise.allSettled([betterAuthUserAccounts.create(input), betterAuthUserAccounts.create(input)])
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({ reason: { reason: 'username_taken' } })
  })
})

describe('betterAuthUserAccounts.setPassword', () => {
  beforeEach(resetDatabase)

  it('creates the credential of a migrated user that never had a password', async () => {
    await prisma.user.create({ data: { id: 'legado-1', name: 'Legado', email: 'legado@users.invalid', username: 'legado' } })
    await betterAuthUserAccounts.setPassword('legado-1', 'senha-nova-123')
    const account = await prisma.account.findFirst({ where: { userId: 'legado-1', providerId: 'credential' } })
    expect(account?.accountId).toBe('legado-1')
    const context = await auth.$context
    expect(await context.password.verify({ hash: account?.password ?? '', password: 'senha-nova-123' })).toBe(true)
  })
})
