import { describe, expect, it } from 'vitest'
import * as legacyQuestions from '../../../../legacy/src/perguntas.js'
import * as legacyRates from '../../../../legacy/src/simples.js'
import { QUESTIONS, BLOCKS, visibleQuestions, isShortPath, bandMidpoint, optionLabel } from './questions'
import { estimateDasRate, checkDeclaredDasRate, REVENUE_BAND_LIMITS } from './simples-rates'
import { generateFills } from './testing/fill-generator'

const legacyTypes: Record<string, string> = {
  unica: 'single', select: 'select', matriz: 'matrix', texto: 'text', email: 'email',
  telefone: 'phone', cnpj: 'cnpj', textarea: 'textarea', consentimento: 'consent',
}

describe('questions parity', () => {
  it('keeps every question key, block, type and option in order', () => {
    expect(QUESTIONS.map((q) => q.key)).toEqual(legacyQuestions.PERGUNTAS.map((q) => q.chave))
    QUESTIONS.forEach((q, i) => {
      const old = legacyQuestions.PERGUNTAS[i]
      if (!old) throw new Error(`legacy question ${i} missing`)
      expect(q.block).toBe(old.bloco)
      expect(q.prompt).toBe(old.enunciado)
      expect(q.type).toBe(legacyTypes[old.tipo])
      expect(Boolean(q.essential)).toBe(Boolean(old.essencial))
      expect((q.options ?? []).map((o) => [o.value, o.label, o.score ?? null])).toEqual(
        (old.opcoes ?? []).map((o) => [o.valor, o.rotulo, o.nota ?? null]),
      )
    })
    expect(BLOCKS.map((b) => b.title)).toEqual(legacyQuestions.BLOCOS.map((b) => b.titulo))
  })

  it('shows the same questions for 5 000 fills', () => {
    for (const answers of generateFills({ count: 5_000, seed: 20260915 })) {
      expect(visibleQuestions(answers).map((q) => q.key)).toEqual(
        legacyQuestions.perguntasVisiveis(answers).map((q) => q.chave),
      )
      expect(isShortPath(answers)).toBe(legacyQuestions.ehCaminhoCurto(answers))
    }
  })

  it('keeps band midpoints and labels', () => {
    for (const band of ['zero', 'ate_20', 'de_20_40', 'de_40_60', 'de_60_80', 'acima_80', 'nao_sei']) {
      expect(bandMidpoint(band)).toBe(legacyQuestions.pontoMedioFaixa(band))
    }
    expect(optionLabel('segmento', 'comercio')).toBe(legacyQuestions.rotuloDaOpcao('segmento', 'comercio'))
  })

  it('estimates the same DAS interval for every annex and band', () => {
    for (const annex of ['i', 'ii', 'iii', 'iv', 'v', 'mais_de_um', 'nao_sei']) {
      for (const band of [...Object.keys(REVENUE_BAND_LIMITS), 'acima_4_8mi']) {
        const now = estimateDasRate(annex, band)
        const old = legacyRates.estimarAliquotaDas(annex, band) as
          | (ReturnType<typeof legacyRates.estimarAliquotaDas> & { issIcmsForaDoDas: boolean })
          | null
        expect(now && [now.min, now.max, now.average, now.issIcmsOutsideDas]).toEqual(
          old && [old.min, old.max, old.medio, old.issIcmsForaDoDas],
        )
      }
    }
  })

  it('checks declared DAS the same way for 5 000 fills', () => {
    for (const answers of generateFills({ count: 5_000, seed: 7 })) {
      expect(checkDeclaredDasRate(answers).status).toBe(legacyRates.conferirAliquotaDeclarada(answers).situacao)
    }
  })
})
