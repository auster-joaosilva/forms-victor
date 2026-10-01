import { describe, expect, it } from 'vitest'
import { toCompanyBadgeLookup } from './company-badge'

describe('toCompanyBadgeLookup', () => {
  it('never lets the partners out, keeping only the requester check', () => {
    const registry = {
      ok: true as const,
      requesterInQsa: true,
      partners: [{ name: 'MARIA SOCIA' }],
      company: { legalName: 'X', city: null, state: null, simplesOptant: true, meiOptant: false, active: true, registrationStatus: null, partners: [{ name: 'MARIA SOCIA' }], qsa: ['MARIA SOCIA'] },
    }
    const lookup = toCompanyBadgeLookup(registry)
    expect(lookup).toEqual({
      ok: true,
      requesterInQsa: true,
      company: { legalName: 'X', city: '', state: '', simplesOptant: true, meiOptant: false, active: true, registrationStatus: '' },
    })
    expect(JSON.stringify(lookup)).not.toMatch(/MARIA|partners|"qsa"/)
  })

  it('passes a failure through as just the reason', () => {
    expect(toCompanyBadgeLookup({ ok: false, reason: 'tempo esgotado' })).toEqual({ ok: false, reason: 'tempo esgotado' })
  })
})
