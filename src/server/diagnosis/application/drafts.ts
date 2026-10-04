import { DRAFT_ID_PATTERN, clampStep, draftExpiry, isDraftExpired, stripInternalKeys } from '../domain/draft-rules'
import type { Answers } from '../domain/question-types'
import type { Clock } from '../ports/clock'
import type { CompanyGateway } from '../ports/company-gateway'
import type { DraftRecord, DraftRepository } from '../ports/draft-repository'
import type { InvitationGateway } from '../ports/invitation-gateway'
import type { RateLimiter } from '../ports/rate-limiter'
import type { ResponseRepository } from '../ports/response-repository'

export type LoadedDraft = { draft: DraftRecord; protocol: string | null }
export type SaveDraftResult = { ok: true; draftId: string } | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

export async function currentDraft(drafts: DraftRepository, clock: Clock, draftId: string | null): Promise<DraftRecord | null> {
  if (!draftId || !DRAFT_ID_PATTERN.test(draftId)) return null
  const draft = await drafts.find(draftId)
  if (!draft) return null
  if (isDraftExpired(draft.expiresAt, clock.now())) {
    await drafts.delete(draft.id)
    return null
  }
  return draft
}

export function makeDraftUseCases({ drafts, responses, clock, rateLimiter, invitations, companies }: {
  drafts: DraftRepository
  responses: ResponseRepository
  clock: Clock
  rateLimiter: RateLimiter
  invitations: InvitationGateway
  companies: CompanyGateway
}) {
  return {
    async loadDraft(draftId: string | null): Promise<LoadedDraft | null> {
      const draft = await currentDraft(drafts, clock, draftId)
      if (!draft) return null
      const response = draft.responseId ? await responses.findById(draft.responseId) : null
      return { draft, protocol: response?.protocol ?? null }
    },

    async saveDraft(input: { draftId: string | null; step: number; answers: Answers; invitationToken: string | null; origin: string | null }): Promise<SaveDraftResult> {
      const answers = stripInternalKeys(input.answers)
      const step = clampStep(input.step)
      const expiresAt = draftExpiry(clock.now())
      const existing = await currentDraft(drafts, clock, input.draftId)
      let draftId: string
      if (existing) {
        await drafts.save(existing.id, { step, answers, expiresAt })
        draftId = existing.id
      } else {
        const decision = await rateLimiter.check('diagnosis-draft', input.origin)
        if (!decision.allowed) return { ok: false, reason: 'rate_limited', retryAfterSeconds: decision.retryAfterSeconds }
        draftId = (await drafts.create({ step, answers, expiresAt })).id
      }
      if (input.invitationToken && !existing?.invitationToken) await invitations.open(input.invitationToken, draftId)
      return { ok: true, draftId }
    },

    async discardDraft(draftId: string | null): Promise<void> {
      if (draftId && DRAFT_ID_PATTERN.test(draftId)) await drafts.delete(draftId)
    },

    async lookupCompanyForDraft(input: { draftId: string | null; cnpj: string; requesterName?: string; origin: string | null }) {
      const result = await companies.lookup({ cnpj: input.cnpj, requesterName: input.requesterName, origin: input.origin })
      const draft = await currentDraft(drafts, clock, input.draftId)
      if (draft) await drafts.setRequesterInQsa(draft.id, result.ok ? result.requesterInQsa : null)
      return result
    },
  }
}
