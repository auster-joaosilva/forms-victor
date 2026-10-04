import { describe, expect, it } from 'vitest'
import { makeDraftUseCases } from './drafts'
import { fakeClock, fakeRateLimiter, memoryDrafts, memoryResponses } from './testing/fakes'

function setup(decisions: Parameters<typeof fakeRateLimiter>[0] = []) {
  const drafts = memoryDrafts()
  const responses = memoryResponses()
  const clock = fakeClock('2026-09-20T12:00:00Z')
  const rate = fakeRateLimiter(decisions)
  const opened: [string, string][] = []
  const lookups: { cnpj: string; requesterName?: string; origin: string | null }[] = []
  const useCases = makeDraftUseCases({
    drafts: drafts.repository,
    responses: responses.repository,
    clock,
    rateLimiter: rate.limiter,
    invitations: { open: async (token, draftId) => (opened.push([token, draftId]), token === 'ABCDEFGHJK') },
    companies: {
      lookup: async (input) => {
        lookups.push(input)
        return { ok: true, company: { legalName: 'X', city: '', state: '', simplesOptant: true, meiOptant: false, active: true, registrationStatus: 'ATIVA' }, requesterInQsa: input.requesterName ? true : null }
      },
    },
  })
  return { drafts, responses, clock, rate, opened, lookups, useCases }
}

describe('draft use cases', () => {
  it('creates the draft on the first save only, under the rate limit, without internal keys', async () => {
    const { useCases, drafts, rate } = setup()
    const first = await useCases.saveDraft({ draftId: null, step: 1, answers: { versaoFormulario: 'sintetico', _cadastro: 'x' }, invitationToken: null, origin: '1.1.1.1' })
    expect(first.ok).toBe(true)
    const id = first.ok ? first.draftId : ''
    expect(drafts.rows.get(id)?.answers).toEqual({ versaoFormulario: 'sintetico' })
    const second = await useCases.saveDraft({ draftId: id, step: 2, answers: { versaoFormulario: 'completo' }, invitationToken: null, origin: '1.1.1.1' })
    expect(second).toEqual({ ok: true, draftId: id })
    expect(drafts.rows.size).toBe(1)
    expect(drafts.rows.get(id)?.step).toBe(2)
    expect(rate.calls).toEqual(['diagnosis-draft'])
  })

  it('refuses to create a draft when the origin is over the limit', async () => {
    const { useCases, drafts } = setup([{ allowed: false, retryAfterSeconds: 42 }])
    expect(await useCases.saveDraft({ draftId: null, step: 1, answers: { a: 'b' }, invitationToken: null, origin: null }))
      .toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 42 })
    expect(drafts.rows.size).toBe(0)
  })

  it('opens the invitation through the gateway until the draft carries a token', async () => {
    const { useCases, opened, drafts } = setup()
    const saved = await useCases.saveDraft({ draftId: null, step: 1, answers: { a: 'b' }, invitationToken: 'ABCDEFGHJK', origin: null })
    const id = saved.ok ? saved.draftId : ''
    expect(opened).toEqual([['ABCDEFGHJK', id]])
    drafts.patch(id, { invitationToken: 'ABCDEFGHJK', invitationOpened: true })
    await useCases.saveDraft({ draftId: id, step: 1, answers: { a: 'c' }, invitationToken: 'ABCDEFGHJK', origin: null })
    expect(opened).toHaveLength(1)
  })

  it('deletes an expired draft when it is accessed and ignores ids that are not uuids', async () => {
    const { useCases, drafts, clock } = setup()
    const record = drafts.seed({ a: 'b' }, { expiresAt: new Date('2026-09-21T00:00:00Z') })
    expect(await useCases.loadDraft(record.id)).toMatchObject({ draft: { id: record.id }, protocol: null })
    clock.set('2026-09-21T00:00:01Z')
    expect(await useCases.loadDraft(record.id)).toBeNull()
    expect(drafts.rows.has(record.id)).toBe(false)
    expect(await useCases.loadDraft('nao-e-uuid')).toBeNull()
    expect(await useCases.loadDraft(crypto.randomUUID())).toBeNull()
  })

  it('returns the protocol of a draft already submitted', async () => {
    const { useCases, drafts, responses } = setup()
    const response = await responses.repository.create({ protocol: 'DS-260920-AB12', invitationToken: null, receivedAt: new Date(), payload: { answers: {}, engine: { outcome: '', position: '', certainty: '', urgency: '', confidence: '', gaps: [], triggers: [], openPoints: [] }, requesterInQsa: null, formVersion: null }, companyName: null, cnpj: null, cnpjDigits: null, requester: null, email: null, phone: null, formVersion: null, outcome: null, position: null, certainty: null, urgency: null, confidence: null, requesterInQsa: null })
    const record = drafts.seed({ a: 'b' }, { responseId: response.id })
    expect((await useCases.loadDraft(record.id))?.protocol).toBe('DS-260920-AB12')
  })

  it('discards the draft', async () => {
    const { useCases, drafts } = setup()
    const record = drafts.seed({ a: 'b' })
    await useCases.discardDraft(record.id)
    expect(drafts.rows.size).toBe(0)
  })

  it('stores only the QSA check on the draft and passes the origin to the lookup', async () => {
    const { useCases, drafts, lookups } = setup()
    const record = drafts.seed({ a: 'b' })
    const result = await useCases.lookupCompanyForDraft({ draftId: record.id, cnpj: '11222333000181', requesterName: 'Maria', origin: '1.1.1.1' })
    expect(result.ok).toBe(true)
    expect(drafts.rows.get(record.id)?.requesterInQsa).toBe(true)
    expect(lookups).toEqual([{ cnpj: '11222333000181', requesterName: 'Maria', origin: '1.1.1.1' }])
  })
})
