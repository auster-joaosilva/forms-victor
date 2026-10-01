import { describe, expect, it } from 'vitest'
import { VALIDATORS } from '../../shared/domain/validation'
import { NAME_OR_CNPJ_REQUIRED, invitationLinks, isInvitationToken, normalizeInvitation, tokenFromBytes } from './invitation'

describe('invitation domain', () => {
  it('builds 10-character tokens from the legacy alphabet', () => {
    const token = tokenFromBytes(new Uint8Array([0, 1, 31, 32, 33, 255, 8, 9, 10, 11, 99]))
    expect(token).toBe('AB9AB9JKLM')
    expect(isInvitationToken(token)).toBe(true)
    expect(isInvitationToken('ABCDEFGHI1')).toBe(false)
    expect(isInvitationToken('abcdefghjk')).toBe(false)
  })

  it('requires a name or a valid CNPJ and masks the CNPJ', () => {
    expect(normalizeInvitation({ companyName: ' ', cnpj: '', email: 'a@b.com' })).toEqual({ ok: false, message: NAME_OR_CNPJ_REQUIRED })
    expect(normalizeInvitation({ companyName: '', cnpj: '11.111.111/1111-11', email: '' })).toEqual({ ok: false, message: VALIDATORS.cnpj.error })
    expect(normalizeInvitation({ companyName: '', cnpj: '11222333000181', email: '' })).toEqual({
      ok: true, value: { companyName: null, cnpj: '11.222.333/0001-81', email: null },
    })
  })

  it('links the diagnosis and the adhesion on the public address', () => {
    expect(invitationLinks('https://hml.example/', 'ABCDEFGHJK')).toEqual({
      diagnosis: 'https://hml.example/diagnosis?invite=ABCDEFGHJK',
      adhesion: 'https://hml.example/adhesion?invite=ABCDEFGHJK',
    })
  })
})
