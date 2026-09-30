import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './client'
import { resetDatabase } from '../../../../tests/integration/db'

describe('database rules', () => {
  beforeEach(resetDatabase)

  it('refuses to update an audit entry', async () => {
    const entry = await prisma.auditLog.create({ data: { action: 'probe' } })
    await expect(prisma.auditLog.update({ where: { id: entry.id }, data: { action: 'changed' } })).rejects.toThrow(
      /só inserção/,
    )
  })

  it('refuses a second active registration with the same e-mail in a session', async () => {
    const event = await prisma.event.create({ data: { slug: 'probe', title: 'Probe', content: {} } })
    const session = await prisma.eventSession.create({
      data: { eventId: event.id, date: new Date('2026-10-20'), time: '19:00', title: 'Encontro' },
    })
    const base = { eventId: event.id, sessionId: session.id, name: 'Ana', payload: {} }
    await prisma.registration.create({ data: { ...base, protocol: 'INS-1', email: 'ana@x.com' } })
    await expect(
      prisma.registration.create({ data: { ...base, protocol: 'INS-2', email: 'ANA@x.com' } }),
    ).rejects.toThrow()
    await prisma.registration.update({ where: { protocol: 'INS-1' }, data: { status: 'cancelled' } })
    await expect(
      prisma.registration.create({ data: { ...base, protocol: 'INS-3', email: 'ana@x.com' } }),
    ).resolves.toBeTruthy()
  })
})
