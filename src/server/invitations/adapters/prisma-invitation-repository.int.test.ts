import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaInvitationRepository } from './prisma-invitation-repository'

describe('prismaInvitationRepository', () => {
  beforeEach(resetDatabase)

  it('creates, lists with usage counts and deletes', async () => {
    const user = await prisma.user.create({ data: { id: 'u1', name: 'Maria', email: 'maria@users.invalid', username: 'maria' } })
    await prismaInvitationRepository.create({ token: 'ABCDEFGHJK', companyName: 'Empresa', cnpj: null, email: null, createdById: user.id })
    await prisma.response.create({ data: { protocol: 'DS-260920-AAAA', payload: {}, invitationToken: 'ABCDEFGHJK' } })
    const [listed] = await prismaInvitationRepository.list()
    expect(listed).toMatchObject({ token: 'ABCDEFGHJK', createdBy: 'maria', responseCount: 1, adhesionCount: 0, openCount: 0 })
    await prisma.response.deleteMany()
    await prismaInvitationRepository.delete('ABCDEFGHJK')
    expect(await prismaInvitationRepository.exists('ABCDEFGHJK')).toBe(false)
  })

  it('counts one opening per draft and stores the token on the draft', async () => {
    await prismaInvitationRepository.create({ token: 'ABCDEFGHJK', companyName: 'Empresa', cnpj: null, email: null, createdById: null })
    const draft = await prisma.diagnosisDraft.create({ data: { payload: {}, expiresAt: new Date(Date.now() + 86_400_000) } })
    const at = new Date('2026-09-20T12:00:00Z')
    expect(await prismaInvitationRepository.registerOpening('ABCDEFGHJK', draft.id, at)).toBe(true)
    expect(await prismaInvitationRepository.registerOpening('ABCDEFGHJK', draft.id, at)).toBe(false)
    expect(await prismaInvitationRepository.registerOpening('QQQQQQQQQQ', draft.id, at)).toBe(false)
    expect(await prisma.invitation.findUniqueOrThrow({ where: { token: 'ABCDEFGHJK' } })).toMatchObject({ openCount: 1, lastOpenedAt: at })
    expect(await prisma.diagnosisDraft.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({ invitationToken: 'ABCDEFGHJK', invitationOpened: true })
  })
})
