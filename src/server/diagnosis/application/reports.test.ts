import { describe, expect, it } from 'vitest'
import { buildStoredPayload } from '../domain/stored-payload'
import { diagnose } from '../domain/diagnose'
import { applicableFill } from '../domain/testing/applicable-fill'
import { makeReports } from './reports'
import { fakeClock, memoryDrafts, memoryResponses } from './testing/fakes'

const answers = applicableFill(11)

describe('reports', () => {
  it('builds the report of the submitted version, not of later unsent edits', async () => {
    const drafts = memoryDrafts()
    const responses = memoryResponses()
    const clock = fakeClock('2026-09-20T12:00:00Z')
    const payload = buildStoredPayload(answers, diagnose(answers, clock.now()), null)
    const created = await responses.repository.create({ protocol: 'DS-260920-AB12', invitationToken: null, receivedAt: clock.now(), payload, companyName: null, cnpj: null, cnpjDigits: null, requester: null, email: null, phone: null, formVersion: null, outcome: null, position: null, certainty: null, urgency: null, confidence: null, requesterInQsa: null })
    const draft = drafts.seed({ ...answers, nomeEmpresa: 'Editado e não enviado' }, { responseId: created.id })
    const reports = makeReports({ drafts: drafts.repository, responses: responses.repository, clock })
    const sheets = await reports.submittedReport(draft.id)
    expect(sheets?.cover.protocol).toBe('DS-260920-AB12')
    expect(sheets?.cover.company).toBe(String(answers.nomeEmpresa))
    expect(await reports.submittedReport(drafts.seed(answers).id)).toBeNull()
    expect((await reports.responseReport(created.id))?.fileName).toMatch(/^Plano-De-Acao-SN-/)
    expect(await reports.responseReport(999)).toBeNull()
  })
})
