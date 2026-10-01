import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { prismaResponseBackofficeRepository } from './prisma-response-repository'

const base = { payload: {}, status: 'new' as const }

describe('prismaResponseBackofficeRepository', () => {
  beforeEach(async () => {
    await resetDatabase()
    await prisma.user.create({ data: { id: 'u1', name: 'Maria', email: 'maria@users.invalid', username: 'maria' } })
    await prisma.response.createMany({
      data: [
        { ...base, protocol: 'DS-260915-AAAA', companyName: 'Padaria Boa', cnpj: '11.222.333/0001-81', cnpjDigits: '11222333000181', requester: 'Ana', receivedAt: new Date('2026-09-15T12:00:00Z') },
        { ...base, protocol: 'DS-260916-BBBB', companyName: 'Oficina Nova', requester: 'Bruno', receivedAt: new Date('2026-09-16T12:00:00Z'), status: 'validated' },
      ],
    })
  })

  it('searches company, CNPJ with or without mask, protocol and requester, newest first', async () => {
    const page = { skip: 0, take: 50 }
    expect((await prismaResponseBackofficeRepository.list({}, page)).items.map((r) => r.protocol)).toEqual(['DS-260916-BBBB', 'DS-260915-AAAA'])
    for (const search of ['padaria', '11222333', '11.222.333', 'bbbb', 'bruno']) {
      expect((await prismaResponseBackofficeRepository.list({ search }, page)).total).toBe(1)
    }
    expect((await prismaResponseBackofficeRepository.list({ status: 'validated' }, page)).items[0]?.companyName).toBe('Oficina Nova')
    expect(await prismaResponseBackofficeRepository.countByStatus()).toEqual({ new: 1, in_review: 0, validated: 1, discarded: 0 })
  })

  it('sets status with handler, and the note alone without touching the handler', async () => {
    const [first] = (await prismaResponseBackofficeRepository.list({ search: 'padaria' }, { skip: 0, take: 1 })).items
    if (!first) throw new Error('sem resposta')
    const at = new Date('2026-09-20T12:00:00Z')
    expect(await prismaResponseBackofficeRepository.setStatus(first.id, { status: 'in_review', note: 'a', handledById: 'u1', handledAt: at })).toBe(true)
    expect(await prismaResponseBackofficeRepository.setNote(first.id, 'b')).toBe(true)
    expect(await prismaResponseBackofficeRepository.findById(first.id)).toMatchObject({ status: 'in_review', internalNote: 'b', handledByUsername: 'maria', handledAt: at })
    expect(await prismaResponseBackofficeRepository.setNote(999, 'x')).toBe(false)
  })
})
