import { describe, expect, it } from 'vitest'
import { makeLookupCompany } from './lookup-company'

describe('lookupCompany', () => {
  it('returns company data and the QSA check, never the partner list', async () => {
    const lookup = makeLookupCompany({
      find: async () => ({ ok: true, company: { legalName: 'X' } as never, partners: [{ name: 'MARIA SOUZA' }] }),
    })
    const result = await lookup({ cnpj: '11.222.333/0001-81', requesterName: 'Maria Souza' })
    expect(result).toEqual({ ok: true, company: { legalName: 'X' }, requesterInQsa: true })
    expect(JSON.stringify(result)).not.toContain('partners')
  })
  it('refuses an incomplete cnpj without calling the registry', async () => {
    let called = false
    const lookup = makeLookupCompany({ find: async () => ((called = true), { ok: false, reason: 'indisponível' }) })
    expect(await lookup({ cnpj: '11.222' })).toEqual({ ok: false, reason: 'cnpj incompleto' })
    expect(called).toBe(false)
  })
})
