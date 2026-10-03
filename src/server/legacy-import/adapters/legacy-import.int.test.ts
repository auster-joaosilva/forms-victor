import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { buildLegacyDatabase } from '../../../../tests/integration/legacy-portal'
import { importLegacyFile } from '../composition'

const path = join(tmpdir(), `portal-${randomUUID()}.db`)

describe('legacy import against a SQLite copy', () => {
  beforeAll(async () => {
    await resetDatabase()
    buildLegacyDatabase(path)
    await prisma.user.create({ data: { id: 'victor-novo', name: 'Victor', email: 'victor@users.invalid', username: 'victor', role: 'admin' } })
  })
  afterAll(() => rmSync(path, { force: true }))

  it('dry run counts and writes nothing', async () => {
    const report = await importLegacyFile(path, { dryRun: true })
    expect(report).toMatchObject({
      users: { found: 6, imported: 5, skipped: 1 }, invitations: { imported: 1 }, responses: { found: 4, imported: 4 },
      adhesions: { found: 3, imported: 3, skipped: 0 }, audit: { imported: 4 }, conflicts: [],
    })
    expect(report.notes).toEqual(expect.arrayContaining([
      'usuário chico: papel chefe sem equivalente; entra como operador',
      'adesão 2: diagnóstico 99 não existe; fica sem diagnóstico',
      'adesão 2: versão do termo V3 não está no sistema; a via vai responder que o texto não existe',
    ]))
    expect(await prisma.adhesion.count()).toBe(0)
    expect(await prisma.response.count()).toBe(0)
  })

  it('imports everything once, twice in a row, with ids, protocols, links and the sequence', async () => {
    const reports = []
    for (let run = 0; run < 2; run++) {
      reports.push(await importLegacyFile(path, { dryRun: false }))
    }
    expect(reports[1]?.adhesions).toEqual({ found: 3, imported: 0, skipped: 3 })
    const maria = await prisma.user.findUniqueOrThrow({ where: { username: 'maria' } })
    expect(maria).toMatchObject({ email: 'maria@users.invalid', role: 'operator', banned: true, lastLoginAt: new Date('2026-09-10T12:00:00.000Z') })
    expect((await prisma.user.findUniqueOrThrow({ where: { username: 'victor' } })).name).toBe('Victor')
    expect(await prisma.account.count({ where: { userId: maria.id } })).toBe(0)
    expect(await prisma.invitation.findUniqueOrThrow({ where: { token: 'ABCDEFGHJK' } })).toMatchObject({ createdById: maria.id, openCount: 3 })

    const responses = await prisma.response.findMany({ orderBy: { id: 'asc' } })
    expect(responses.map((r) => [r.id, r.protocol])).toEqual([[1, 'DS-260915-ABCD'], [2, 'DS-260915-ABCD-2'], [3, 'SEM-3'], [7, 'DS-260916-WXYZ']])
    expect(responses[0]).toMatchObject({ status: 'validated', handledById: maria.id, invitationToken: 'ABCDEFGHJK', requesterInQsa: true, cnpjDigits: '11222333000181' })
    expect(responses[1]).toMatchObject({ status: 'in_review', handledById: null, invitationToken: null, requesterInQsa: false })
    expect(responses[3]?.payload).toMatchObject({ respostas: { nomeEmpresa: 'Loja' } })
    expect((await prisma.response.create({ data: { protocol: 'DS-261001-NOVA', payload: {} } })).id).toBe(8)

    const roles = Object.fromEntries((await prisma.user.findMany({ select: { username: true, role: true } })).map((u) => [u.username, u.role]))
    expect(roles).toMatchObject({ victor: 'admin', maria: 'operator', gestora: 'manager', regina: 'regularization', otavio: 'operator', chico: 'operator' })
    const regina = await prisma.user.findUniqueOrThrow({ where: { username: 'regina' } })

    const adhesions = await prisma.adhesion.findMany({ orderBy: { id: 'asc' } })
    expect(adhesions.map((a) => [a.id, a.protocol])).toEqual([[1, 'ADS-20260925-AAAAA'], [2, 'ADS-20260925-AAAAA-2'], [4, 'ADS-20260926-BBBBB']])
    expect(adhesions[0]).toMatchObject({
      responseId: 1, invitationToken: 'ABCDEFGHJK', modality: 'hybrid', withoutManifestation: 'cancel', wantsProposal: true, status: 'filed',
      termVersion: 'V4', termHash: '94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441', cnpjDigits: '11222333000181',
      originIp: '203.0.113.7', originSource: 'cf-connecting-ip', forwardedChain: '203.0.113.7, 10.0.0.1', userAgent: 'Mozilla/5.0',
      handledById: regina.id, receiptToken: null, acceptedAt: new Date('2026-09-25T13:00:00.000Z'),
    })
    expect(adhesions[1]).toMatchObject({ responseId: null, invitationToken: null, modality: 'standard', withoutManifestation: null, cnpj: '', cpf: '', representativeRole: '', termVersion: 'V3', phone: null })
    expect(adhesions[2]).toMatchObject({ status: 'cancelled', withoutManifestation: 'keep', internalNote: 'desistiu', handledById: null, termHash: '27bfd24bb5f55bf12b0dd3935769cb51bf434f6a63c515aed1e5254399f8f004' })
    const next = await prisma.adhesion.create({ data: {
      protocol: 'ADS-20261001-NOVAA', acceptedAt: new Date(), companyName: 'x', cnpj: 'x', cnpjDigits: 'x', representative: 'x', cpf: 'x',
      representativeRole: 'x', email: 'x', modality: 'standard', termVersion: 'V5', termHash: 'x', payload: {},
    } })
    expect(next.id).toBe(5)

    const audit = await prisma.auditLog.findMany({ orderBy: { id: 'asc' } })
    const legacy = audit.filter((entry) => (entry.detail as { legacyEventId?: number } | null)?.legacyEventId)
    expect(legacy.map((entry) => entry.action)).toEqual(['access_denied', 'spreadsheet_exported', 'response_received', 'legacy_imported'])
    expect(legacy[0]).toMatchObject({ actorId: maria.id, actorUsername: 'maria', occurredAt: new Date('2026-09-10T12:00:00.000Z') })
    expect(legacy[1]?.detail).toMatchObject({ kind: 'responses' })
    expect(legacy[3]?.detail).toMatchObject({ legacyAction: 'coisa_estranha' })
    expect(audit.filter((entry) => entry.action === 'legacy_imported' && !(entry.detail as { legacyEventId?: number } | null)?.legacyEventId)).toHaveLength(2)
  })
})
