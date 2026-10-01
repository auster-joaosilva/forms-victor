import type { CompanyBadgeLookup } from '@/server/diagnosis/domain/company-badge'
import type { WireAnswers } from '@/server/diagnosis/domain/draft-rules'
import type { ResultView } from '@/server/diagnosis/domain/result-view'

export interface DiagnosisBootstrap {
  today: string
  draft: { step: number; answers: WireAnswers; savedAt: string; protocol: string | null } | null
  invitation: { token: string; companyName: string | null; cnpj: string | null } | null
}

export type SaveDraftWireResult = { ok: true } | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

export type SubmitWireResult =
  | { ok: true; protocol: string; result: ResultView }
  | { ok: false; reason: 'no_draft' | 'no_consent' | 'not_applicable' | 'invalid' }
  | { ok: false; reason: 'rate_limited'; retryAfterSeconds: number }

export interface DiagnosisApi {
  saveDraft(input: { step: number; answers: WireAnswers; invitationToken: string | null }): Promise<SaveDraftWireResult>
  discardDraft(): Promise<void>
  lookupCnpj(input: { cnpj: string; requesterName?: string }): Promise<CompanyBadgeLookup>
  submitDiagnosis(): Promise<SubmitWireResult>
}
