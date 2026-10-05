import { createServerFn } from '@tanstack/react-start'
import { diagnosisDrafts, diagnosisReports, submitDiagnosis as submitDraft, todayIso } from '@/server/diagnosis/composition'
import { toWireAnswers } from '@/server/diagnosis/domain/draft-rules'
import { invitationPrefill } from '@/server/invitations/composition'
import { clearDraftCookie, readDraftCookie, requestClientIp, writeDraftCookie } from '@/server/shared/http/draft-cookie'
import type { DiagnosisBootstrap, SaveDraftWireResult, SubmitWireResult } from '../types/diagnosis'
import { loadDraftInput, lookupCnpjInput, saveDraftInput } from './schemas'

export const loadDraft = createServerFn({ method: 'GET' })
  .inputValidator(loadDraftInput)
  .handler(async ({ data }): Promise<DiagnosisBootstrap> => {
    const cookie = readDraftCookie()
    const loaded = await diagnosisDrafts.loadDraft(cookie)
    if (cookie && !loaded) clearDraftCookie()
    return {
      today: todayIso(),
      draft: loaded
        ? { step: loaded.draft.step, answers: toWireAnswers(loaded.draft.answers), savedAt: loaded.draft.updatedAt.toISOString(), protocol: loaded.protocol }
        : null,
      invitation: data.invite ? await invitationPrefill(data.invite) : null,
    }
  })

export const saveDraft = createServerFn({ method: 'POST' })
  .inputValidator(saveDraftInput)
  .handler(async ({ data }): Promise<SaveDraftWireResult> => {
    const result = await diagnosisDrafts.saveDraft({ draftId: readDraftCookie(), ...data, origin: requestClientIp() })
    if (!result.ok) return result
    writeDraftCookie(result.draftId)
    return { ok: true }
  })

export const discardDraft = createServerFn({ method: 'POST' }).handler(async () => {
  await diagnosisDrafts.discardDraft(readDraftCookie())
  clearDraftCookie()
})

export const lookupCnpj = createServerFn({ method: 'POST' })
  .inputValidator(lookupCnpjInput)
  .handler(({ data }) => diagnosisDrafts.lookupCompanyForDraft({ draftId: readDraftCookie(), ...data, origin: requestClientIp() }))

export const submitDiagnosis = createServerFn({ method: 'POST' }).handler(async (): Promise<SubmitWireResult> => {
  const result = await submitDraft({ draftId: readDraftCookie(), origin: requestClientIp() })
  if (!result.ok) return result.reason === 'invalid' ? { ok: false, reason: 'invalid' } : result
  return { ok: true, protocol: result.protocol, result: result.result }
})

export const getSubmittedReport = createServerFn({ method: 'GET' }).handler(() => diagnosisReports.submittedReport(readDraftCookie()))
