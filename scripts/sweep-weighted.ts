import { diagnose } from '../src/server/diagnosis/domain/diagnose'
import {
  QUESTIONS,
  CUSTOMER_TYPES,
  PERCENT_BANDS,
  visibleQuestions,
} from '../src/server/diagnosis/domain/questions'
import type { Answers } from '../src/server/diagnosis/domain/question-types'

// Weights are an assumption, not data: replace with the real portfolio distribution after calibration.
const WEIGHTS: Record<string, Record<string, number>> = {
  margemLiquida: { prejuizo: 3, ate_5: 12, de_5_10: 22, de_10_20: 30, de_20_30: 20, acima_30: 10, nao_sei: 3 },
  investimentoPrevisto: { nao: 55, ate_200k: 28, de_200k_1mi: 13, acima_1mi: 4 },
  faixaRbt12: {
    ate_180k: 18,
    de_180_360k: 20,
    de_360_720k: 20,
    de_720k_1_8mi: 20,
    de_1_8_3_6mi: 13,
    de_3_6_4_32mi: 5,
    de_4_32_4_8mi: 3,
    acima_4_8mi: 1,
  },
  aquisicoesRegimeRegular: { ate_20: 18, de_20_40: 22, de_40_60: 22, de_60_80: 18, acima_80: 12, nao_sei: 8 },
  pesoMercadorias: { ate_20: 14, de_20_40: 22, de_40_60: 26, de_60_80: 24, acima_80: 14 },
  debitosTributarios: { nao: 62, sim_parcelado: 22, sim_aberto: 10, nao_sei: 6 },
  pesoFolha: { ate_15: 14, de_15_30: 26, de_30_45: 26, de_45_60: 18, acima_60: 12, nenhuma: 4 },
  // Uniform sampling gave 78% "differentiated sector" (7 of 9 options are sectors).
  setorDiferenciado: {
    nenhum: 52,
    saude: 6,
    educacao: 3,
    alimentos: 5,
    transporte_coletivo: 2,
    profissao_regulamentada: 9,
    imobiliario: 4,
    bares_restaurantes: 7,
    hotelaria_parques: 3,
    agencias_turismo: 2,
    nao_sei: 6,
  },
  mercadoriasComST: { nao: 45, parte: 33, maioria: 14, nao_sei: 8 },
  aquisicoesUsoPessoal: { nao: 62, pouco: 25, relevante: 7, nao_sei: 6 },
  prestadoresPJ: { nao: 52, alguns: 30, boa_parte: 12, nao_sei: 6 },
  versaoFormulario: { sintetico: 35, completo: 65 },
  contratosLongos: { sem_contratos: 26, sem_contratos_longos: 24, com_clausula: 12, sem_clausula: 30, nao_sei: 8 },
}
const MATRIX_WEIGHTS: Record<string, number> = {
  zero: 22,
  ate_20: 22,
  de_20_40: 16,
  de_40_60: 14,
  de_60_80: 10,
  acima_80: 11,
  nao_sei: 5,
}
const RARE_UNKNOWN = 4

let seed = 20260915
const rnd = (): number => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

function draw(options: { value: string }[], weights?: Record<string, number>): string {
  const list: [string, number][] = options
    .map((o): [string, number] => [o.value, weights ? (weights[o.value] ?? 0) : 1])
    .filter((x) => x[1] > 0)
  const total = list.reduce((t, x) => t + x[1], 0)
  let r = rnd() * total
  for (const [v, w] of list) {
    r -= w
    if (r <= 0) return v
  }
  return (list[list.length - 1] as [string, number])[0]
}

function generate(): Answers {
  const a: Answers = { ehSimei: 'nao', regimeAtual: 'simples' }
  for (let k = 0; k < 3; k++) {
    for (const q of visibleQuestions(a)) {
      if (a[q.key] !== undefined) continue
      if (q.type === 'matrix') {
        const m: Record<string, string> = {}
        for (const row of CUSTOMER_TYPES) m[row.key] = draw(PERCENT_BANDS, MATRIX_WEIGHTS)
        a[q.key] = m
      } else if (q.options) {
        let weights = WEIGHTS[q.key]
        if (!weights && q.unknownValue) {
          weights = {}
          for (const o of q.options) weights[o.value] = o.value === q.unknownValue ? RARE_UNKNOWN : 20
        }
        a[q.key] = draw(q.options, weights)
      }
    }
  }
  const visible = new Set(visibleQuestions(a).map((q) => q.key))
  for (const q of QUESTIONS) if (!visible.has(q.key)) Reflect.deleteProperty(a, q.key)
  return a
}

// A weight table out of sync with the options breaks the measurement silently: abort instead.
for (const [key, weights] of Object.entries(WEIGHTS)) {
  const q = QUESTIONS.find((x) => x.key === key)
  if (!q || !q.options) continue
  const valid = new Set(q.options.map((o) => o.value))
  const phantoms = Object.keys(weights).filter((v) => !valid.has(v))
  const unweighted = [...valid].filter((v) => !(v in weights))
  if (phantoms.length || unweighted.length) {
    console.error(`PESOS INCOERENTES em "${key}":`)
    if (phantoms.length) console.error(`  opções inexistentes: ${phantoms.join(', ')}`)
    if (unweighted.length) console.error(`  opções sem peso (nunca sorteadas): ${unweighted.join(', ')}`)
    process.exit(1)
  }
}

const n = Number(process.argv[2] || 20000)
const modalities: Record<string, number> = {}
const outcomes: Record<string, number> = {}
const prelim = { com: 0, sem: 0 }
for (let i = 0; i < n; i++) {
  const d = diagnose(generate(), new Date('2026-09-15T12:00:00'))
  outcomes[d.outcome.code] = (outcomes[d.outcome.code] || 0) + 1
  const k = `${d.position.label} | ${d.position.qualifier || '-'}`
  modalities[k] = (modalities[k] || 0) + 1
  if (d.outcome.modality === 'a_definir') {
    if (d.preliminaryReading) prelim.com++
    else prelim.sem++
  }
}
const pct = (v: number): string => `${((100 * v) / n).toFixed(1)}%`
const byCount = (o: Record<string, number>): [string, number][] =>
  Object.entries(o).sort((x, y) => y[1] - x[1])
console.log(`\nCarteira plausível (pesos declarados) — ${n.toLocaleString('pt-BR')} casos\n`)
console.log('SAÍDAS')
for (const [k, v] of byCount(outcomes)) console.log(`  ${k.padEnd(26)} ${pct(v).padStart(7)}`)
console.log('\nMODALIDADE')
for (const [k, v] of byCount(modalities)) console.log(`  ${k.padEnd(26)} ${pct(v).padStart(7)}`)
console.log(`\n  a definir COM leitura preliminar: ${pct(prelim.com)}`)
console.log(`  a definir SEM lado nenhum:        ${pct(prelim.sem)}`)
console.log(`  → recebe um lado nomeado, no total: ${pct(n - prelim.sem)}\n`)
