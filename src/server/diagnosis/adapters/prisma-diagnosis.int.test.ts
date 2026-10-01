import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/server/shared/prisma/client'
import { resetDatabase } from '../../../../tests/integration/db'
import { makeDraftUseCases } from '../application/drafts'
import { makeSubmitDiagnosis } from '../application/submit-diagnosis'
import { applicableFill } from '../domain/testing/applicable-fill'
import { prismaDraftRepository } from './prisma-draft-repository'
import { prismaResponseRepository } from './prisma-response-repository'
import { createRandomProtocolGenerator } from './random-protocol-generator'

const engine = { outcome: 'B', position: 'Simples híbrido', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA', gaps: [], triggers: [], openPoints: [] }
const projections = { companyName: 'Empresa', cnpj: '11.222.333/0001-81', cnpjDigits: '11222333000181', requester: 'Maria', email: 'a@b.com', phone: null, formVersion: 'sintetico', outcome: 'B', position: 'Simples híbrido', certainty: 'aberta', urgency: 'ALTA', confidence: 'MÉDIA', requesterInQsa: true }

describe('diagnosis persistence', () => {
  beforeEach(resetDatabase)

  it('creates, saves, links and deletes drafts', async () => {
    const draft = await prismaDraftRepository.create({ step: 1, answers: { versaoFormulario: 'sintetico' }, expiresAt: new Date(Date.now() + 86_400_000) })
    await prismaDraftRepository.setRequesterInQsa(draft.id, true)
    await prismaDraftRepository.save(draft.id, { step: 3, answers: { versaoFormulario: 'completo' }, expiresAt: new Date(Date.now() + 2 * 86_400_000) })
    expect(await prismaDraftRepository.find(draft.id)).toMatchObject({ step: 3, answers: { versaoFormulario: 'completo' }, requesterInQsa: true, responseId: null })
    await prismaDraftRepository.delete(draft.id)
    await prismaDraftRepository.delete(draft.id)
    expect(await prismaDraftRepository.find(draft.id)).toBeNull()
  })

  it('sets the QSA check without touching the saved answers, and clears it with null', async () => {
    const draft = await prismaDraftRepository.create({ step: 1, answers: { versaoFormulario: 'sintetico' }, expiresAt: new Date(Date.now() + 86_400_000) })
    await prismaDraftRepository.setRequesterInQsa(draft.id, false)
    expect(await prismaDraftRepository.find(draft.id)).toMatchObject({ answers: { versaoFormulario: 'sintetico' }, requesterInQsa: false })
    await prismaDraftRepository.setRequesterInQsa(draft.id, null)
    expect(await prismaDraftRepository.find(draft.id)).toMatchObject({ answers: { versaoFormulario: 'sintetico' }, requesterInQsa: null })
    await prismaDraftRepository.setRequesterInQsa('1b4e28ba-2fa1-11d2-883f-0016d3cca427', true)
  })

  it('keeps the QSA check when answers are saved afterwards', async () => {
    const draft = await prismaDraftRepository.create({ step: 1, answers: {}, expiresAt: new Date(Date.now() + 86_400_000) })
    await prismaDraftRepository.setRequesterInQsa(draft.id, true)
    await prismaDraftRepository.save(draft.id, { step: 4, answers: { versaoFormulario: 'completo' }, expiresAt: new Date(Date.now() + 86_400_000) })
    expect(await prismaDraftRepository.find(draft.id)).toMatchObject({ step: 4, answers: { versaoFormulario: 'completo' }, requesterInQsa: true })
  })

  it('creates a single response when the same draft is submitted twice at once', async () => {
    const audits: string[] = []
    const submit = makeSubmitDiagnosis({
      drafts: prismaDraftRepository,
      responses: prismaResponseRepository,
      protocols: createRandomProtocolGenerator(),
      clock: { now: () => new Date() },
      rateLimiter: { check: async () => ({ allowed: true }) },
      recordAudit: async (entry) => void audits.push(entry.action),
    })
    const draft = await prismaDraftRepository.create({ step: 7, answers: applicableFill(7), expiresAt: new Date(Date.now() + 86_400_000) })
    const results = await Promise.all([submit({ draftId: draft.id, origin: null }), submit({ draftId: draft.id, origin: null })])
    expect(results.every((result) => result.ok)).toBe(true)
    expect(await prisma.response.count()).toBe(1)
    expect(audits).toEqual(['response_received'])
    const stored = await prisma.response.findFirstOrThrow()
    expect(results.map((result) => result.ok && result.protocol)).toEqual([stored.protocol, stored.protocol])
    expect((await prismaDraftRepository.find(draft.id))?.responseId).toBe(stored.id)
  })

  it('deletes an expired draft on access and treats a cookie without row as no draft', async () => {
    const useCases = makeDraftUseCases({
      drafts: prismaDraftRepository,
      responses: prismaResponseRepository,
      clock: { now: () => new Date() },
      rateLimiter: { check: async () => ({ allowed: true }) },
      invitations: { open: async () => false },
      companies: { lookup: async () => ({ ok: false, reason: 'indisponível' }) },
    })
    const expired = await prismaDraftRepository.create({ step: 1, answers: {}, expiresAt: new Date(Date.now() - 1000) })
    expect(await useCases.loadDraft(expired.id)).toBeNull()
    expect(await prisma.diagnosisDraft.count()).toBe(0)
    expect(await useCases.loadDraft('1b4e28ba-2fa1-11d2-883f-0016d3cca427')).toBeNull()
  })

  it('creates and updates a response, dropping an invitation token that does not exist', async () => {
    const payload = { answers: { nomeEmpresa: 'Empresa' }, engine, requesterInQsa: true, formVersion: 'sintetico' }
    const created = await prismaResponseRepository.create({ ...projections, payload, protocol: 'DS-260920-AB12', invitationToken: 'QQQQQQQQQQ', receivedAt: new Date('2026-09-20T12:00:00Z') })
    expect(created).toMatchObject({ protocol: 'DS-260920-AB12', invitationToken: null, status: 'new', updatedAt: null })
    expect(await prismaResponseRepository.protocolExists('DS-260920-AB12')).toBe(true)
    await prismaResponseRepository.update(created.id, { ...projections, phone: '(34) 98888-7777', payload, updatedAt: new Date('2026-09-21T12:00:00Z') })
    expect(await prismaResponseRepository.findById(created.id)).toMatchObject({ phone: '(34) 98888-7777', updatedAt: new Date('2026-09-21T12:00:00Z'), receivedAt: new Date('2026-09-20T12:00:00Z') })
  })

  it('keeps an invitation token that still exists', async () => {
    await prisma.invitation.create({ data: { token: 'ABCDEFGHJK', companyName: 'Empresa', cnpj: '11.222.333/0001-81' } })
    const payload = { answers: {}, engine, requesterInQsa: null, formVersion: null }
    const created = await prismaResponseRepository.create({ ...projections, payload, protocol: 'DS-260920-AB13', invitationToken: 'ABCDEFGHJK', receivedAt: new Date('2026-09-20T12:00:00Z') })
    expect(created.invitationToken).toBe('ABCDEFGHJK')
  })

  it('generates protocols in the DS-AAMMDD-XXXX format', () => {
    const generator = createRandomProtocolGenerator()
    expect(generator.next(new Date('2026-10-01T02:30:00Z'))).toMatch(/^DS-260930-[A-Z0-9]{4}$/)
  })
})
