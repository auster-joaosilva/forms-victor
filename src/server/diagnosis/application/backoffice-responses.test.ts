import { describe, expect, it } from 'vitest'
import { buildStoredPayload, responseProjections } from '../domain/stored-payload'
import { diagnose } from '../domain/diagnose'
import { applicableFill } from '../domain/testing/applicable-fill'
import { PAGE_SIZE, makeResponseBackoffice } from './backoffice-responses'
import { fakeClock, memoryResponses } from './testing/fakes'

const answers = applicableFill(13)
const payload = buildStoredPayload(answers, diagnose(answers, new Date('2026-09-15T12:00:00Z')), true)
const actor = { id: 'u-bia', username: 'bia' }

async function setup(count = 3) {
  const responses = memoryResponses({ usernames: { 'u-maria': 'maria', 'u-bia': 'bia' } })
  for (let i = 0; i < count; i++) {
    await responses.repository.create({ ...responseProjections(payload), payload, protocol: `DS-260915-A${String(i).padStart(3, '0')}`, invitationToken: i === 0 ? 'ABCDEFGHJK' : null, receivedAt: new Date(Date.UTC(2026, 8, 15, 12, i)) })
  }
  const audits: { action: string; reference: string; detail: Record<string, unknown> }[] = []
  const clock = fakeClock('2026-10-01T02:00:00Z')
  const backoffice = makeResponseBackoffice({ responses: responses.repository, clock, recordAudit: async (entry) => void audits.push(entry) })
  return { responses, audits, backoffice }
}

describe('response back office', () => {
  it('pages by 50, newest first, with the counters', async () => {
    const { backoffice } = await setup(120)
    const third = await backoffice.listResponses({ page: 3 })
    expect(PAGE_SIZE).toBe(50)
    expect(third).toMatchObject({ total: 120, page: 3, pageCount: 3, counts: { total: 120, new: 120, in_review: 0 } })
    expect(third.items).toHaveLength(20)
    const first = await backoffice.listResponses({})
    expect(first.items[0]?.protocol).toBe('DS-260915-A119')
    expect(first.items.at(-1)?.viaInvitation).toBe(false)
  })

  it('records who handled it, and saving only the note keeps the last handler', async () => {
    const { backoffice, responses, audits } = await setup()
    await backoffice.handleResponse({ id: 'u-maria', username: 'maria' }, { id: 1, status: 'in_review', note: 'conferir CNPJ' })
    await backoffice.handleResponse(actor, { id: 1, status: null, note: 'CNPJ conferido' })
    const detail = await backoffice.getResponse(1)
    expect(detail).toMatchObject({ status: 'in_review', internalNote: 'CNPJ conferido', handledBy: 'maria', handledAt: '2026-10-01T02:00:00.000Z' })
    expect(responses.rows.get(1)?.handledByUsername).toBe('maria')
    expect(audits.map((a) => [a.action, a.detail.noteOnly])).toEqual([['response_handled', false], ['response_handled', true]])
  })

  it('warns when the client changed the response after the last handling', async () => {
    const { backoffice, responses } = await setup()
    await backoffice.handleResponse(actor, { id: 2, status: 'validated', note: '' })
    await responses.repository.update(2, { ...responseProjections(payload), payload, updatedAt: new Date('2026-10-02T12:00:00Z') })
    expect((await backoffice.getResponse(2))?.changedAfterHandling).toBe(true)
    expect((await backoffice.getResponse(3))?.changedAfterHandling).toBe(false)
    expect(await backoffice.getResponse(99)).toBeNull()
  })

  it('exports what the screen filters, audits it and names the file by the Brasília date', async () => {
    const { backoffice, audits } = await setup()
    await backoffice.handleResponse(actor, { id: 1, status: 'discarded', note: '' })
    const file = await backoffice.exportResponses(actor, { status: 'discarded' })
    expect(file.fileName).toBe('respostas-simples-2026-09-30.csv')
    expect(file.count).toBe(1)
    expect(file.body.startsWith('\uFEFFprotocolo;')).toBe(true)
    expect(file.body.split('\r\n')).toHaveLength(3)
    expect(audits.at(-1)).toMatchObject({ action: 'spreadsheet_exported', reference: '1', detail: { kind: 'responses', status: 'discarded' } })
  })

  it('refuses to handle a response that does not exist', async () => {
    const { backoffice } = await setup()
    expect(await backoffice.handleResponse(actor, { id: 99, status: 'validated', note: '' })).toEqual({ ok: false, message: 'Resposta não encontrada.' })
  })
})
