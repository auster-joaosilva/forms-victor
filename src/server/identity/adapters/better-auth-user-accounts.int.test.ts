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

describe('betterAuthUserAccounts.setEmail', () => {
  beforeEach(resetDatabase)

  it('sets a real email', async () => {
    await betterAuthUserAccounts.create(input)
    const user = await betterAuthUserAccounts.findByUsername('bia')
    if (!user) throw new Error('usuário não criado')
    await betterAuthUserAccounts.setEmail(user.id, 'bia@austercontabil.com.br')
    expect((await betterAuthUserAccounts.findByUsername('bia'))?.email).toBe('bia@austercontabil.com.br')
  })

  it('refuses an email already used by another account', async () => {
    await betterAuthUserAccounts.create(input)
    await betterAuthUserAccounts.create({ ...input, username: 'caio' })
    const bia = await betterAuthUserAccounts.findByUsername('bia')
    if (!bia) throw new Error('usuário não criado')
    await betterAuthUserAccounts.setEmail(bia.id, 'bia@austercontabil.com.br')
    const caio = await betterAuthUserAccounts.findByUsername('caio')
    if (!caio) throw new Error('usuário não criado')
    await expect(betterAuthUserAccounts.setEmail(caio.id, 'bia@austercontabil.com.br')).rejects.toMatchObject({ reason: 'email_taken' })
  })
})

describe('betterAuthUserAccounts.setEmails', () => {
  beforeEach(resetDatabase)

  const createBoth = async () => {
    await betterAuthUserAccounts.create(input)
    await betterAuthUserAccounts.create({ ...input, username: 'caio' })
    const bia = await betterAuthUserAccounts.findByUsername('bia')
    const caio = await betterAuthUserAccounts.findByUsername('caio')
    if (!bia || !caio) throw new Error('usuário não criado')
    return { bia, caio }
  }

  it('sets every email at once', async () => {
    const { bia, caio } = await createBoth()
    await betterAuthUserAccounts.setEmails([{ id: bia.id, email: 'bia@austercontabil.com.br' }, { id: caio.id, email: 'caio@austercontabil.com.br' }])
    expect((await betterAuthUserAccounts.findByUsername('bia'))?.email).toBe('bia@austercontabil.com.br')
    expect((await betterAuthUserAccounts.findByUsername('caio'))?.email).toBe('caio@austercontabil.com.br')
  })

  it('writes nothing when one of the emails already belongs to someone else', async () => {
    const { bia, caio } = await createBoth()
    const davi = await betterAuthUserAccounts.create({ ...input, username: 'davi' })
    await betterAuthUserAccounts.setEmail(davi.id, 'davi@austercontabil.com.br')
    const pairs = [{ id: bia.id, email: 'bia@austercontabil.com.br' }, { id: caio.id, email: 'davi@austercontabil.com.br' }]
    await expect(betterAuthUserAccounts.setEmails(pairs)).rejects.toMatchObject({ reason: 'email_taken' })
    expect((await betterAuthUserAccounts.findByUsername('bia'))?.email).toBe('bia@users.invalid')
  })
})
