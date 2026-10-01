import { describe, expect, it } from 'vitest'
import { buildActionPlan } from '../domain/action-plan'
import { diagnose } from '../domain/diagnose'
import { readStoredPayload } from '../domain/stored-payload'
import { applicableFill } from '../domain/testing/applicable-fill'
import { makeSubmitDiagnosis } from './submit-diagnosis'
import { fakeClock, fakeRateLimiter, memoryDrafts, memoryResponses } from './testing/fakes'

const answers = applicableFill(7)

function setup(decisions: Parameters<typeof fakeRateLimiter>[0] = []) {
  const drafts = memoryDrafts()
  const responses = memoryResponses()
  const clock = fakeClock('2026-10-01T02:30:00Z')
  const rate = fakeRateLimiter(decisions)
  const audits: { action: string; reference: string }[] = []
  const suffixes = ['AAAA', 'AAAA', 'BBBB']
  const submit = makeSubmitDiagnosis({
    drafts: drafts.repository,
    responses: responses.repository,
    protocols: { next: (now) => `DS-${now.toISOString().slice(2, 4)}0930-${suffixes.shift() ?? 'ZZZZ'}` },
    clock,
    rateLimiter: rate.limiter,
    recordAudit: async (entry) => void audits.push(entry),
  })
  return { drafts, responses, clock, rate, audits, submit }
}

describe('submitDiagnosis', () => {
  it('recalculates on the server from the stored draft, creates once and links the draft', async () => {
    const { submit, drafts, responses, audits, clock } = setup()
    const draft = drafts.seed(answers, { invitationToken: 'ABCDEFGHJK', requesterInQsa: false })
    const result = await submit({ draftId: draft.id, origin: '1.1.1.1' })
    expect(result).toMatchObject({ ok: true, created: true, updated: false })
    const [stored] = [...responses.rows.values()]
    const expected = diagnose(answers, clock.now())
    expect(readStoredPayload(stored?.payload).engine).toMatchObject({ outcome: expected.outcome.code, position: expected.position.label, triggers: expected.triggers })
    expect(stored).toMatchObject({ invitationToken: 'ABCDEFGHJK', requesterInQsa: false, outcome: expected.outcome.code })
    expect(drafts.rows.get(draft.id)?.responseId).toBe(stored?.id)
    expect(audits.map((a) => a.action)).toEqual(['response_received'])
    expect(result.ok && result.result.plan.clientNow).toEqual(buildActionPlan(answers, expected).clientNow)
  })

  it('skips a protocol that already exists', async () => {
    const { submit, drafts } = setup()
    const first = await submit({ draftId: drafts.seed(answers).id, origin: null })
    const second = await submit({ draftId: drafts.seed(answers).id, origin: null })
    expect([first.ok && first.protocol, second.ok && second.protocol]).toEqual(['DS-260930-AAAA', 'DS-260930-BBBB'])
  })

  it('does nothing when the answers did not change (F5 on the result)', async () => {
    const { submit, drafts, responses, audits, rate } = setup()
    const draft = drafts.seed(answers)
    await submit({ draftId: draft.id, origin: null })
    const again = await submit({ draftId: draft.id, origin: null })
    expect(again).toMatchObject({ ok: true, created: false, updated: false })
    expect(responses.rows.size).toBe(1)
    expect(audits).toHaveLength(1)
    expect(rate.calls).toEqual(['diagnosis-submit'])
  })

  it('updates the same response, keeping protocol and receivedAt', async () => {
    const { submit, drafts, responses, audits, clock } = setup()
    const draft = drafts.seed(answers)
    const first = await submit({ draftId: draft.id, origin: null })
    const receivedAt = [...responses.rows.values()][0]?.receivedAt
    clock.set('2026-10-02T15:00:00Z')
    drafts.patch(draft.id, { answers: { ...answers, telefone: '(34) 98888-7777' } })
    const second = await submit({ draftId: draft.id, origin: null })
    expect(second).toMatchObject({ ok: true, created: false, updated: true, protocol: first.ok ? first.protocol : '' })
    const [stored] = [...responses.rows.values()]
    expect(responses.rows.size).toBe(1)
    expect(stored?.receivedAt).toEqual(receivedAt)
    expect(stored?.updatedAt).toEqual(new Date('2026-10-02T15:00:00Z'))
    expect(stored?.phone).toBe('(34) 98888-7777')
    expect(audits.map((a) => a.action)).toEqual(['response_received', 'response_updated'])
  })

  it('refuses without consent, outside the scope, with invalid answers or without a draft', async () => {
    const { submit, drafts, responses } = setup()
    expect(await submit({ draftId: drafts.seed({ ...answers, aceiteLgpd: '' }).id, origin: null })).toEqual({ ok: false, reason: 'no_consent' })
    expect(await submit({ draftId: drafts.seed({ ...answers, ehSimei: 'sim' }).id, origin: null })).toEqual({ ok: false, reason: 'not_applicable' })
    expect(await submit({ draftId: drafts.seed({ ...answers, email: 'x' }).id, origin: null })).toMatchObject({ ok: false, reason: 'invalid', problems: { email: 'E-mail inválido.' } })
    expect(await submit({ draftId: null, origin: null })).toEqual({ ok: false, reason: 'no_draft' })
    expect(await submit({ draftId: drafts.seed(answers, { expiresAt: new Date('2026-09-01T00:00:00Z') }).id, origin: null })).toEqual({ ok: false, reason: 'no_draft' })
    expect(responses.rows.size).toBe(0)
  })

  it('answers 429 data when the origin is over the limit', async () => {
    const { submit, drafts, responses } = setup([{ allowed: false, retryAfterSeconds: 30 }])
    expect(await submit({ draftId: drafts.seed(answers).id, origin: '1.1.1.1' })).toEqual({ ok: false, reason: 'rate_limited', retryAfterSeconds: 30 })
    expect(responses.rows.size).toBe(0)
  })
})
