import { describe, expect, it } from 'vitest'
import {
  clampStep, cleanInvisibleAnswers, draftExpiry, isDraftExpired, sameAnswers, stripInternalKeys, toWireAnswers, triageReason,
} from './draft-rules'

describe('draft rules', () => {
  it('expires seven days after the last save', () => {
    const now = new Date('2026-09-20T12:00:00Z')
    const expiry = draftExpiry(now)
    expect(expiry.toISOString()).toBe('2026-09-27T12:00:00.000Z')
    expect(isDraftExpired(expiry, new Date('2026-09-27T11:59:59Z'))).toBe(false)
    expect(isDraftExpired(expiry, new Date('2026-09-27T12:00:00Z'))).toBe(true)
  })

  it('drops internal keys and clamps the step', () => {
    expect(stripInternalKeys({ nomeEmpresa: 'X', _cadastro: { a: 1 }, _protocolo: 'DS' })).toEqual({ nomeEmpresa: 'X' })
    expect([clampStep(0), clampStep(4), clampStep(9), clampStep(Number.NaN)]).toEqual([1, 4, 7, 1])
  })

  it('erases answers of questions that became invisible', () => {
    const answers = { segmento: 'servico_saude', servicoHospitalar: 'sim', _interno: 'fica' }
    expect(cleanInvisibleAnswers(answers)).toEqual(answers)
    expect(cleanInvisibleAnswers({ ...answers, segmento: 'comercio' })).toEqual({ segmento: 'comercio', _interno: 'fica' })
  })

  it('detours MEI and companies outside the Simples, but not "não sei"', () => {
    expect(triageReason({ ehSimei: 'sim' })).toBe('mei')
    expect(triageReason({ regimeAtual: 'presumido' })).toBe('outside')
    expect(triageReason({ regimeAtual: 'nao_sei' })).toBeNull()
    expect(triageReason({ regimeAtual: 'simples', ehSimei: 'nao' })).toBeNull()
  })

  it('compares answers regardless of key order', () => {
    expect(sameAnswers({ a: '1', m: { x: 'zero', y: 'nao_sei' } }, { m: { y: 'nao_sei', x: 'zero' }, a: '1' })).toBe(true)
    expect(sameAnswers({ a: '1' }, { a: '2' })).toBe(false)
  })

  it('keeps only strings and string maps on the wire', () => {
    expect(toWireAnswers({ a: 'x', m: { r: 'zero', n: 3 }, n: 3, l: ['x'] })).toEqual({ a: 'x', m: { r: 'zero' } })
  })
})
