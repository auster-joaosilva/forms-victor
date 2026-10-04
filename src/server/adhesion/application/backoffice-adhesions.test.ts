import { describe, expect, it } from 'vitest'
import type { AdhesionCompany, Modality, WithoutManifestationChoice } from '../domain/adhesion'
import type { NewAdhesion } from '../ports/adhesion-repository'
import { EXPORT_LIMIT, PAGE_SIZE, makeAdhesionBackoffice } from './backoffice-adhesions'
import { auditSpy, fakeClock, memoryAdhesions } from './testing/fakes'

const empresa = (nomeEmpresa: string): AdhesionCompany => ({
  nomeEmpresa, cnpj: '11.222.333/0001-81', representante: 'Ana', cpf: '529.982.247-25', cargo: 'Sócio', email: 'ana@padaria.com', telefone: '',
})

const adhesion = (
  n: number,
  over: { nome?: string; modalidade?: Modality; semManifestacao?: WithoutManifestationChoice | null; termVersion?: string } = {},
): NewAdhesion => ({
  protocol: `ADS-20260925-AAAA${n}`,
  receiptToken: String(n).padStart(64, '0'),
  acceptedAt: new Date(Date.UTC(2026, 8, 25, 13, n)),
  submission: {
    empresa: empresa(over.nome ?? 'Padaria Boa'),
    modalidade: over.modalidade ?? 'hibrido',
    semManifestacao: over.semManifestacao === undefined ? 'cancelar' : over.semManifestacao,
    querProposta: false,
    vinculo: null,
  },
  cnpjDigits: '11222333000181',
  responseId: null,
  invitationToken: null,
  termVersion: over.termVersion ?? 'V5',
  termHash: 'h'.repeat(64),
  originIp: '203.0.113.7',
  originSource: 'x-real-ip',
  forwardedChain: null,
  userAgent: null,
  payload: {},
})

async function setup(seed: NewAdhesion[], now = '2026-10-01T02:00:00Z') {
  const store = memoryAdhesions({ usernames: { 'u-maria': 'maria' } })
  for (const row of seed) await store.repository.create(row)
  const audit = auditSpy()
  const backoffice = makeAdhesionBackoffice({ adhesions: store.repository, clock: fakeClock(now), recordAudit: audit.record })
  return { backoffice, store, audits: audit.entries }
}

const actor = { id: 'u-regina', username: 'regina' }

describe('adhesion back office', () => {
  it('lists by pages of 50 with the counters, the window and no CPF on the wire', async () => {
    const seed = Array.from({ length: 120 }, (_, i) => adhesion(i % 60 + 1, { nome: `Empresa ${i}` })).map((row, i) => ({ ...row, protocol: `ADS-20260925-${String(i).padStart(5, '0')}` }))
    const { backoffice, store } = await setup(seed)
    const handled = store.rows.get(1)
    if (handled) store.rows.set(1, { ...handled, handledById: 'u-maria', handledAt: new Date('2026-09-26T12:00:00Z') })
    const list = await backoffice.list({ page: 3 })
    expect(PAGE_SIZE).toBe(50)
    expect(list).toMatchObject({ total: 120, page: 3, pageCount: 3, counts: { toFile: 120, filed: 0 }, window: { state: 'open', end: '2026-10-30' } })
    expect(list.items).toHaveLength(20)
    expect(JSON.stringify(list)).not.toContain('529.982.247-25')
    const first = await backoffice.list({ search: '  Empresa 0  ', modality: 'hibrido' })
    expect(first.items.find((item) => item.id === 1)).toEqual({
      id: 1, protocol: 'ADS-20260925-00000', acceptedAt: '2026-09-25T13:01:00.000Z', companyName: 'Empresa 0', cnpj: '11.222.333/0001-81',
      representative: 'Ana', role: 'Sócio', email: 'ana@padaria.com', modalidade: 'hibrido', semManifestacao: 'cancelar', querProposta: false,
      status: 'received', handledBy: 'maria', handledAt: '2026-09-26T12:00:00.000Z',
    })
  })

  it('reports the window closed from 31/10 at midnight in Brasília', async () => {
    const { backoffice } = await setup([], '2026-10-31T03:00:00Z')
    expect((await backoffice.list({})).window).toEqual({ state: 'closed', end: '2026-10-30' })
  })

  it('files only the hybrid option, records who did it and audits from/to', async () => {
    const { backoffice, store, audits } = await setup([adhesion(1, { modalidade: 'padrao', semManifestacao: null }), adhesion(2)])
    expect(await backoffice.handle(actor, { id: 1, status: 'filed' })).toEqual({ ok: false, error: 'só a opção pelo híbrido é protocolada' })
    expect(store.rows.get(1)?.status).toBe('received')
    expect(audits).toEqual([])
    expect(await backoffice.handle(actor, { id: 2, status: 'filed' })).toEqual({ ok: true })
    expect(store.rows.get(2)).toMatchObject({ status: 'filed', handledById: 'u-regina', handledAt: new Date('2026-10-01T02:00:00Z') })
    expect(audits).toEqual([{ action: 'adhesion_handled', actorId: 'u-regina', actorUsername: 'regina', reference: '2', detail: { from: 'received', to: 'filed' } }])
    expect(await backoffice.handle(actor, { id: 1, status: 'cancelled' })).toEqual({ ok: true })
  })

  it('refuses a status it does not know before touching anything', async () => {
    const { backoffice, store, audits } = await setup([adhesion(1)])
    expect(await backoffice.handle(actor, { id: 1, status: 'archived' })).toEqual({ ok: false, error: 'situação inválida' })
    expect(store.rows.get(1)?.status).toBe('received')
    expect(audits).toEqual([])
  })

  it('refuses an adhesion that does not exist', async () => {
    const { backoffice, audits } = await setup([])
    expect(await backoffice.handle(actor, { id: 99, status: 'cancelled' })).toEqual({ ok: false, error: 'adesão não encontrada' })
    expect(audits).toEqual([])
  })

  it('exports with the screen filter, named by the Brasília date, and audits it', async () => {
    const { backoffice, audits } = await setup([adhesion(1), adhesion(2, { nome: '=HYPERLINK("x")' }), adhesion(3, { modalidade: 'padrao', semManifestacao: null })])
    const file = await backoffice.exportCsv(actor, { modality: 'hibrido', search: ' padaria ' })
    expect(EXPORT_LIMIT).toBe(5000)
    expect(file.fileName).toBe('adesoes-simples-2026-09-30.csv')
    expect(file.body.startsWith('\uFEFFprotocolo;')).toBe(true)
    expect(file.body).not.toContain('HYPERLINK')
    expect(file.body).not.toContain('ADS-20260925-AAAA3')
    expect(audits.at(-1)).toEqual({
      action: 'spreadsheet_exported', actorId: 'u-regina', actorUsername: 'regina', reference: '1',
      detail: { kind: 'adhesions', count: 1, status: null, modality: 'hibrido', search: 'padaria' },
    })
    const all = await backoffice.exportCsv(actor, {})
    expect(all.body).toContain(`'=HYPERLINK`)
  })

  it('gives the copy with the text of the accepted version, or says why it cannot', async () => {
    const { backoffice } = await setup([adhesion(1, { termVersion: 'V4' }), adhesion(2, { termVersion: 'V3' })])
    const v4 = await backoffice.termCopy(1)
    expect(v4.ok && v4.term.versao).toBe('V4')
    expect(await backoffice.termCopy(2)).toEqual({
      ok: false, reason: 'unknown_version',
      message: 'Esta adesão foi aceita na versão V3 do termo, cujo texto não está mais no sistema. A via não pode ser tirada sem ele.',
    })
    expect(await backoffice.termCopy(99)).toEqual({ ok: false, reason: 'not_found', message: 'Adesão não encontrada.' })
  })
})
