import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaPasswordResetTokens } from './prisma-password-reset-tokens'

async function createUser(username: string) {
  return prisma.user.create({ data: { id: username, name: username, email: `${username}@users.invalid`, username } })
}

describe('prisma password reset tokens', () => {
  beforeEach(resetDatabase)

  it('issues a token and finds it by hash', async () => {
    const user = await createUser('bia')
    await prismaPasswordResetTokens.issue({ userId: user.id, tokenHash: 'hash-1', expiresAt: new Date('2026-10-12T13:00:00Z') })
    const stored = await prismaPasswordResetTokens.findByHash('hash-1')
    expect(stored).toMatchObject({ userId: user.id, usedAt: null })
    expect(stored?.expiresAt).toEqual(new Date('2026-10-12T13:00:00Z'))
  })

  it('invalidates the previous token of the same user when a new one is issued', async () => {
    const user = await createUser('bia')
    await prismaPasswordResetTokens.issue({ userId: user.id, tokenHash: 'hash-1', expiresAt: new Date('2026-10-12T13:00:00Z') })
    await prismaPasswordResetTokens.issue({ userId: user.id, tokenHash: 'hash-2', expiresAt: new Date('2026-10-12T14:00:00Z') })
    expect((await prismaPasswordResetTokens.findByHash('hash-1'))?.usedAt).not.toBeNull()
    expect(await prismaPasswordResetTokens.findByHash('hash-2')).toMatchObject({ userId: user.id, usedAt: null })
  })

  it('tells when the most recent token of the user was issued, used or not', async () => {
    const bia = await createUser('bia')
    const caio = await createUser('caio')
    expect(await prismaPasswordResetTokens.lastIssuedAt(bia.id)).toBeNull()
    await prismaPasswordResetTokens.issue({ userId: bia.id, tokenHash: 'hash-1', expiresAt: new Date('2026-10-12T13:00:00Z') })
    await prismaPasswordResetTokens.issue({ userId: bia.id, tokenHash: 'hash-2', expiresAt: new Date('2026-10-12T14:00:00Z') })
    const newest = await prisma.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: 'hash-2' } })
    expect(await prismaPasswordResetTokens.lastIssuedAt(bia.id)).toEqual(newest.createdAt)
    expect(await prismaPasswordResetTokens.lastIssuedAt(caio.id)).toBeNull()
  })

  it('marks a token used', async () => {
    const user = await createUser('bia')
    await prismaPasswordResetTokens.issue({ userId: user.id, tokenHash: 'hash-1', expiresAt: new Date('2026-10-12T13:00:00Z') })
    const stored = await prismaPasswordResetTokens.findByHash('hash-1')
    if (!stored) throw new Error('token não encontrado')
    await prismaPasswordResetTokens.markUsed(stored.id, new Date('2026-10-12T12:30:00Z'))
    expect((await prismaPasswordResetTokens.findByHash('hash-1'))?.usedAt).toEqual(new Date('2026-10-12T12:30:00Z'))
  })

  it('cascades when the user is deleted', async () => {
    const user = await createUser('bia')
    await prismaPasswordResetTokens.issue({ userId: user.id, tokenHash: 'hash-1', expiresAt: new Date('2026-10-12T13:00:00Z') })
    await prisma.user.delete({ where: { id: user.id } })
    expect(await prisma.passwordResetToken.count()).toBe(0)
  })
})
