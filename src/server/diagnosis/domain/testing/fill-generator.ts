import type { Answers, MatrixAnswer } from '../question-types'
import { CUSTOMER_TYPES, PERCENT_BANDS, QUESTIONS, visibleQuestions } from '../questions'

export interface FillOptions {
  count: number
  seed: number
  mode?: 'uniform' | 'adversarial' | 'both'
}

const IDENTIFICATION: Answers = {
  nomeEmpresa: 'Empresa de Teste',
  cnpj: '11.222.333/0001-81',
  solicitante: 'Fulano de Tal',
  email: 'a@b.com',
  telefone: '(34) 99999-9999',
}

const EXTREMES: Record<string, string[]> = {
  versaoFormulario: ['sintetico', 'completo'],
  margemLiquida: ['prejuizo', 'acima_30', 'nao_sei'],
  faixaRbt12: ['ate_180k', 'acima_4_8mi', 'de_3_6_4_32mi'],
  pesoFolha: ['nenhuma', 'acima_60'],
  aquisicoesRegimeRegular: ['ate_20', 'acima_80', 'nao_sei'],
  setorDiferenciado: ['nenhum', 'bares_restaurantes', 'hotelaria_parques', 'nao_sei'],
  investimentoPrevisto: ['nao', 'acima_1mi'],
  contratosLongos: ['sem_contratos', 'sem_clausula', 'nao_sei'],
  aquisicoesUsoPessoal: ['nao', 'relevante', 'nao_sei'],
  mercadoriasComST: ['nao', 'maioria', 'nao_sei'],
  debitosTributarios: ['nao', 'sim_aberto', 'nao_sei'],
}

type MatrixMode = 'zerada' | 'nao_sei' | 'concentrada' | 'estourada' | 'aleatoria'
const MATRIX_MODES: MatrixMode[] = ['zerada', 'nao_sei', 'concentrada', 'estourada', 'aleatoria']

function createRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

export function* generateFills(options: FillOptions): Generator<Answers> {
  const { count, seed, mode = 'both' } = options
  const random = createRandom(seed)
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T

  // Fixed point instead of a fixed number of passes: each conditional level only shows up in the next pass.
  function uniform(fixed: Answers = {}): Answers {
    const r: Answers = { ...IDENTIFICATION, ...fixed }
    for (let pass = 0; pass < 12; pass++) {
      const before = Object.keys(r).length
      for (const q of visibleQuestions(r)) {
        if (r[q.key] !== undefined) continue
        if (q.type === 'matrix') {
          const matrix: MatrixAnswer = {}
          for (const row of CUSTOMER_TYPES) matrix[row.key] = pick(PERCENT_BANDS).value
          r[q.key] = matrix
        } else if (q.options) {
          r[q.key] = pick(q.options).value
        } else if (q.type === 'consent') {
          r[q.key] = 'sim'
        } else if (q.type === 'textarea') {
          r[q.key] = random() < 0.3 ? 'texto livre do respondente' : ''
        }
      }
      if (Object.keys(r).length === before) break
    }
    const visible = new Set(visibleQuestions(r).map((q) => q.key))
    const hidden = new Set(QUESTIONS.map((q) => q.key).filter((key) => !visible.has(key)))
    return Object.fromEntries(Object.entries(r).filter(([key]) => !hidden.has(key)))
  }

  function adversarial(): Answers {
    const fixed: Answers = {}
    for (const [key, values] of Object.entries(EXTREMES)) fixed[key] = pick(values)
    const matrixMode = pick(MATRIX_MODES)
    const matrix: MatrixAnswer = {}
    for (const row of CUSTOMER_TYPES) {
      matrix[row.key] =
        matrixMode === 'zerada'
          ? 'zero'
          : matrixMode === 'nao_sei'
            ? 'nao_sei'
            : matrixMode === 'estourada'
              ? 'acima_80'
              : pick(PERCENT_BANDS).value
    }
    if (matrixMode === 'concentrada') {
      for (const row of CUSTOMER_TYPES) matrix[row.key] = 'zero'
      matrix[pick(CUSTOMER_TYPES).key] = 'acima_80'
    }
    fixed.receitaPorCliente = matrix
    return uniform(fixed)
  }

  for (let i = 0; i < count; i++) {
    const useUniform = mode === 'uniform' || (mode === 'both' && i % 2 === 0)
    yield useUniform ? uniform() : adversarial()
  }
}
