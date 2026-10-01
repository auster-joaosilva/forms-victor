import { describe, expect, it } from 'vitest'
import type { AdhesionRecord } from './adhesion'
import { TERM_V4, TERM_V5 } from './term'
import { NOT_FOUND_MESSAGE, UNKNOWN_VERSION_MESSAGE, termCopyOf, toReceipt } from './term-copy'

const record = (termVersion: string): AdhesionRecord => ({
  id: 7,
  protocol: 'ADS-20260925-AB2C9',
  acceptedAt: new Date('2026-09-25T13:30:00.000Z'),
  empresa: {
    nomeEmpresa: 'Empresa Exemplo', cnpj: '11.222.333/0001-81', representante: 'Maria Souza',
    cpf: '529.982.247-25', cargo: 'Sócio', email: 'maria@exemplo.com.br', telefone: '',
  },
  modalidade: 'hibrido',
  semManifestacao: 'manter',
  querProposta: false,
  termVersion,
  termHash: '94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441',
  originIp: null,
})

describe('term copy', () => {
  it('builds the receipt with the Brasília time for display and ISO for proof', () => {
    expect(toReceipt(record('V4'))).toEqual({
      protocol: 'ADS-20260925-AB2C9',
      acceptedAt: '2026-09-25T13:30:00.000Z',
      acceptedAtDisplay: '25/09/2026, 10:30:00',
      modalidade: 'hibrido',
      empresa: record('V4').empresa,
      semManifestacao: 'manter',
      querProposta: false,
      termVersion: 'V4',
      termHash: '94667b1747b65c3e177416ee98e63a79b10599c1a5240b3a0836c094c0788441',
      originIp: null,
    })
  })

  it('uses the text of the accepted version, not the current one', () => {
    const v4 = termCopyOf(record('V4'))
    expect(v4.ok && v4.term).toBe(TERM_V4)
    const v5 = termCopyOf(record('V5'))
    expect(v5.ok && v5.term).toBe(TERM_V5)
  })

  it('refuses an unknown version with the old 409 message', () => {
    expect(termCopyOf(record('V3'))).toEqual({
      ok: false,
      reason: 'unknown_version',
      message: 'Esta adesão foi aceita na versão V3 do termo, cujo texto não está mais no sistema. A via não pode ser tirada sem ele.',
    })
    expect(UNKNOWN_VERSION_MESSAGE('V9')).toContain('versão V9')
  })

  it('reports a missing adhesion', () => {
    expect(termCopyOf(null)).toEqual({ ok: false, reason: 'not_found', message: NOT_FOUND_MESSAGE })
    expect(NOT_FOUND_MESSAGE).toBe('Adesão não encontrada.')
  })
})
