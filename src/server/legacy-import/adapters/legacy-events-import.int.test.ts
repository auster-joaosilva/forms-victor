import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { ensureBucket, readFile, storeFile } from '@/server/storage/composition'
import { resetDatabase } from '../../../../tests/integration/db'
import { TINY_JPEG_BASE64, addLegacyAgenda, buildLegacyDatabase } from '../../../../tests/integration/legacy-portal'
import { importLegacyFile } from '../composition'

const path = join(tmpdir(), `portal-agenda-${randomUUID()}.db`)

describe('legacy import of the agenda against a SQLite copy and MinIO', () => {
  beforeAll(async () => {
    await resetDatabase()
    await ensureBucket()
    buildLegacyDatabase(path)
    addLegacyAgenda(path)
    await storeFile({ kind: 'house_photo', contentType: 'image/jpeg', bytes: Buffer.from(TINY_JPEG_BASE64, 'base64'), originalName: 'palestrante.jpg' })
  })
  afterAll(() => rmSync(path, { force: true }))

  it('dry run counts the agenda and stores no image', async () => {
    const report = await importLegacyFile(path, { dryRun: true })
    expect(report).toMatchObject({
      events: { found: 2, imported: 2 }, sessions: { found: 2, imported: 2 }, registrations: { found: 2, imported: 2 }, images: { found: 1, imported: 1 }, conflicts: [],
    })
    expect(report.notes).toContain('inscrição 21: protocolo INS-20261001-AAAAA gravado como INS-20261001-AAAAA-2')
    expect(await prisma.storedFile.count({ where: { kind: 'event_cover' } })).toBe(0)
  })

  it('imports twice without duplicating rows or images, with the file readable and the sequences reset', async () => {
    await importLegacyFile(path, { dryRun: false })
    const second = await importLegacyFile(path, { dryRun: false })
    expect(second).toMatchObject({ events: { imported: 0, skipped: 2 }, registrations: { imported: 0, skipped: 2 }, images: { imported: 0, skipped: 1 } })
    expect(await prisma.storedFile.count({ where: { kind: 'event_cover' } })).toBe(1)

    const event = await prisma.event.findUniqueOrThrow({ where: { id: 4 }, include: { sessions: { orderBy: { order: 'asc' } } } })
    const victor = await prisma.user.findUniqueOrThrow({ where: { username: 'victor' } })
    expect(event).toMatchObject({ slug: 'conexao-tributaria', status: 'published', registrations: 'open', createdById: victor.id })
    const content = event.content as { capa: { fileId: string }; palestrante: { foto: { fileId: string } } }
    const cover = await readFile(content.capa.fileId)
    expect(cover?.file).toMatchObject({ kind: 'event_cover', contentType: 'image/jpeg', originalName: 'legacy-agenda-4-capa' })
    const house = await prisma.storedFile.findFirstOrThrow({ where: { kind: 'house_photo', originalName: 'palestrante.jpg' } })
    expect(content.palestrante.foto.fileId).toBe(house.id)
    expect(event.sessions.map((s) => [s.id, s.format, s.seats, s.description])).toEqual([[10, 'in_person', 30, 'Abertura'], [11, 'online', null, null]])
    expect((await prisma.event.findUniqueOrThrow({ where: { id: 5 } })).status).toBe('draft')

    const registrations = await prisma.registration.findMany({ orderBy: { id: 'asc' } })
    expect(registrations.map((r) => [r.id, r.protocol, r.status, r.responseId])).toEqual([[20, 'INS-20261001-AAAAA', 'present', 1], [21, 'INS-20261001-AAAAA-2', 'cancelled', null]])
    expect(registrations[0]).toMatchObject({ cnpjDigits: '11222333000181', privacyConsent: true, originIp: '203.0.113.7' })

    const next = await prisma.event.create({ data: { slug: 'novo', title: 'Novo', content: {} } })
    expect(next.id).toBe(6)
    const nextSession = await prisma.eventSession.create({ data: { eventId: 6, date: new Date('2026-12-01T00:00:00.000Z'), time: '10:00', title: 'x' } })
    expect(nextSession.id).toBe(12)
  })
})
