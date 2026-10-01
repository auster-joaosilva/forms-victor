import { buildActionPlan } from '../domain/action-plan'
import { diagnose } from '../domain/diagnose'
import { reportSheets, type ReportSheets } from '../domain/report-sheets'
import { readStoredPayload } from '../domain/stored-payload'
import type { Clock } from '../ports/clock'
import type { DraftRepository } from '../ports/draft-repository'
import type { ResponseRecord, ResponseRepository } from '../ports/response-repository'
import { currentDraft } from './drafts'

export function makeReports({ drafts, responses, clock }: { drafts: DraftRepository; responses: ResponseRepository; clock: Clock }) {
  function sheets(response: ResponseRecord, diagnosisDate: Date): ReportSheets {
    const { answers } = readStoredPayload(response.payload)
    const diagnosis = diagnose(answers, diagnosisDate)
    return reportSheets({ answers, protocol: response.protocol, issuedOn: clock.now() }, diagnosis, buildActionPlan(answers, diagnosis))
  }

  return {
    async submittedReport(draftId: string | null): Promise<ReportSheets | null> {
      const draft = await currentDraft(drafts, clock, draftId)
      const response = draft?.responseId ? await responses.findById(draft.responseId) : null
      return response ? sheets(response, clock.now()) : null
    },

    // The back office re-emits with the current engine on the date of the last submission, as the legacy portal did.
    async responseReport(id: number): Promise<ReportSheets | null> {
      const response = await responses.findById(id)
      return response ? sheets(response, response.updatedAt ?? response.receivedAt) : null
    },
  }
}
