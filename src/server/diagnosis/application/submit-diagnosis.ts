import { buildActionPlan } from '../domain/action-plan'
import { diagnose } from '../domain/diagnose'
import { sameAnswers, triageReason } from '../domain/draft-rules'
import { resultView, type ResultView } from '../domain/result-view'
import { buildStoredPayload, readStoredPayload, responseProjections } from '../domain/stored-payload'
import { validateAnswers, type AnswerProblems } from '../domain/validate-answers'
import type { DiagnosisAuditRecorder } from '../ports/audit-recorder'
import type { Clock } from '../ports/clock'
import type { DraftRepository } from '../ports/draft-repository'
import type { ProtocolGenerator } from '../ports/protocol-generator'
import type { RateLimiter } from '../ports/rate-limiter'
import type { ResponseRepository } from '../ports/response-repository'
import { currentDraft } from './drafts'

export type SubmitResult =
  | { ok: true; protocol: string; result: ResultView; created: boolean; updated: boolean }
  | { ok: false; reason: 'no_draft' | 'no_consent' | 'not_applicable' }
  | { ok: false; reason: 'invalid'; problems: AnswerProblems }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

export function makeSubmitDiagnosis(deps: {
  drafts: DraftRepository
  responses: ResponseRepository
  protocols: ProtocolGenerator
  clock: Clock
  rateLimiter: RateLimiter
  recordAudit: DiagnosisAuditRecorder
}) {
  async function uniqueProtocol(now: Date): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const protocol = deps.protocols.next(now)
      if (!(await deps.responses.protocolExists(protocol))) return protocol
    }
    throw new Error('não foi possível sortear um protocolo livre')
  }

  return async function submitDiagnosis({ draftId, origin }: { draftId: string | null; origin: string | null }): Promise<SubmitResult> {
    const draft = await currentDraft(deps.drafts, deps.clock, draftId)
    if (!draft) return { ok: false, reason: 'no_draft' }
    const { answers } = draft
    if (answers.aceiteLgpd !== 'sim') return { ok: false, reason: 'no_consent' }
    if (triageReason(answers)) return { ok: false, reason: 'not_applicable' }
    const problems = validateAnswers(answers)
    if (Object.keys(problems).length) return { ok: false, reason: 'invalid', problems }

    const now = deps.clock.now()
    const diagnosis = diagnose(answers, now)
    const result = resultView(diagnosis, buildActionPlan(answers, diagnosis))
    const existing = draft.responseId ? await deps.responses.findById(draft.responseId) : null
    if (existing && sameAnswers(readStoredPayload(existing.payload).answers, answers)) {
      return { ok: true, protocol: existing.protocol, result, created: false, updated: false }
    }

    const decision = await deps.rateLimiter.check('diagnosis-submit', origin)
    if (!decision.allowed) return { ok: false, reason: 'rate_limited', retryAfterSeconds: decision.retryAfterSeconds }

    const payload = buildStoredPayload(answers, diagnosis, draft.requesterInQsa)
    const write = { ...responseProjections(payload), payload }
    const company = payload.answers.nomeEmpresa ?? null
    if (existing) {
      await deps.responses.update(existing.id, { ...write, updatedAt: now })
      await deps.recordAudit({ action: 'response_updated', reference: existing.protocol, detail: { id: existing.id, company } })
      return { ok: true, protocol: existing.protocol, result, created: false, updated: true }
    }
    const protocol = await uniqueProtocol(now)
    const created = await deps.responses.create({ ...write, protocol, invitationToken: draft.invitationToken, receivedAt: now })
    await deps.drafts.linkResponse(draft.id, created.id)
    await deps.recordAudit({ action: 'response_received', reference: protocol, detail: { id: created.id, company } })
    return { ok: true, protocol, result, created: true, updated: false }
  }
}
