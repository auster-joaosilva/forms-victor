import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'

const tomorrow = () => new Date(Date.now() + 86_400_000)

describe('stage 1 schema', () => {
  beforeEach(resetDatabase)

  it('links one draft to one response and keeps the invitation fields', async () => {
    const response = await prisma.response.create({ data: { protocol: 'DS-260930-AAAA', payload: {} } })
    expect(response.updatedAt).toBeNull()
    const draft = await prisma.diagnosisDraft.create({
      data: { payload: {}, expiresAt: tomorrow(), responseId: response.id, invitationToken: 'ABCDEFGHJK' },
    })
    expect(draft.invitationOpened).toBe(false)
    await expect(
      prisma.diagnosisDraft.create({ data: { payload: {}, expiresAt: tomorrow(), responseId: response.id } }),
    ).rejects.toThrow()
  })

  it('keeps the draft when its response is deleted', async () => {
    const response = await prisma.response.create({ data: { protocol: 'DS-260930-BBBB', payload: {} } })
    const draft = await prisma.diagnosisDraft.create({ data: { payload: {}, expiresAt: tomorrow(), responseId: response.id } })
    await prisma.response.delete({ where: { id: response.id } })
    expect((await prisma.diagnosisDraft.findUniqueOrThrow({ where: { id: draft.id } })).responseId).toBeNull()
  })

  it('stores the time the client last changed a response', async () => {
    const changedAt = new Date('2026-09-20T15:00:00Z')
    const response = await prisma.response.create({ data: { protocol: 'DS-260930-CCCC', payload: {}, updatedAt: changedAt } })
    expect(response.updatedAt).toEqual(changedAt)
  })
})
