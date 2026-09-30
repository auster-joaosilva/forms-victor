import { THRESHOLDS, APPLY_DENSITY_TEST_ON_HIGH_BRANCH } from '../src/server/diagnosis/domain/thresholds'
import { diagnose } from '../src/server/diagnosis/domain/diagnose'
import { buildActionPlan } from '../src/server/diagnosis/domain/action-plan'
import {
  QUESTIONS,
  CUSTOMER_TYPES,
  PERCENT_BANDS,
  visibleQuestions,
} from '../src/server/diagnosis/domain/questions'
import type { Answers } from '../src/server/diagnosis/domain/question-types'

let seed = 20260914
const rnd = (): number => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)] as T

// Valid random fill: answers whatever is visible; MEI and non-Simples are out of scope.
function randomFill(): Answers {
  const a: Answers = {
    ehSimei: 'nao',
    regimeAtual: 'simples',
    nomeEmpresa: 'Simulada',
    cnpj: '00.000.000/0001-00',
    solicitante: 'x',
    email: 'x@x.com',
    telefone: '(34) 90000-0000',
  }

  for (let pass = 0; pass < 3; pass++) {
    for (const q of visibleQuestions(a)) {
      if (a[q.key] !== undefined) continue
      if (q.type === 'matrix') {
        const m: Record<string, string> = {}
        for (const row of CUSTOMER_TYPES) m[row.key] = pick(PERCENT_BANDS).value
        a[q.key] = m
      } else if (q.options) {
        a[q.key] = pick(q.options).value
      }
    }
  }
  const visible = new Set(visibleQuestions(a).map((q) => q.key))
  for (const q of QUESTIONS) if (!visible.has(q.key)) Reflect.deleteProperty(a, q.key)
  return a
}

const n = Number(process.argv[2] || 20000)
const today = new Date('2026-09-14T12:00:00')

const outcomes: Record<string, number> = {}
const urgencies: Record<string, number> = {}
const confidences: Record<string, number> = {}
const triggers: Record<string, number> = {}
const modalities: Record<string, number> = {}
let withPreliminary = 0
let undefinedWithoutReading = 0
const radarByAxis: Record<string, (number | null)[]> = {}
const planSizes: number[] = []
const actionItems: Record<string, number> = {}
let withoutTrack1 = 0

for (let i = 0; i < n; i++) {
  const a = randomFill()
  const d = diagnose(a, today)
  const plan = buildActionPlan(a, d)

  outcomes[d.outcome.code] = (outcomes[d.outcome.code] || 0) + 1
  const mod = `${d.position.label} — ${d.position.qualifier || 'n/a'}`
  modalities[mod] = (modalities[mod] || 0) + 1
  if (d.preliminaryReading) withPreliminary++
  else if (d.outcome.modality === 'a_definir') undefinedWithoutReading++
  urgencies[d.urgency] = (urgencies[d.urgency] || 0) + 1
  confidences[d.confidence.level] = (confidences[d.confidence.level] || 0) + 1
  for (const g of d.triggers) triggers[g] = (triggers[g] || 0) + 1
  for (const e of d.radar) (radarByAxis[e.title] = radarByAxis[e.title] || []).push(e.score)
  planSizes.push(plan.total)
  if (plan.clientNow.length === 0) withoutTrack1++
  for (const it of [...plan.clientNow, ...plan.clientLater, ...plan.auster]) {
    actionItems[it.id] = (actionItems[it.id] || 0) + 1
  }
}

const pct = (v: number): string => `${((100 * v) / n).toFixed(1)}%`
const line = '─'.repeat(64)
const byCount = (o: Record<string, number>): [string, number][] =>
  Object.entries(o).sort((x, y) => y[1] - x[1])

console.log(`\nVarredura — ${n.toLocaleString('pt-BR')} preenchimentos válidos (optantes do Simples)`)
console.log(
  `Cortes: receitaCreditavel ${THRESHOLDS.creditableRevenueLow}/${THRESHOLDS.creditableRevenueHigh}` +
    ` · densidade ${THRESHOLDS.minimumCreditDensity} · margem ${THRESHOLDS.minimumSupportingMargin}`,
)
console.log(
  `Teste de densidade no ramo alto (D1): ${APPLY_DENSITY_TEST_ON_HIGH_BRANCH ? 'LIGADO' : 'desligado (fiel ao manual)'}`,
)
console.log(line)

console.log('\nSAÍDAS')
for (const [k, v] of byCount(outcomes))
  console.log(`  ${k.padEnd(26)} ${pct(v).padStart(7)}  ${'█'.repeat(Math.round((40 * v) / n))}`)

console.log('\nPOSIÇÃO DE REGIME')
for (const [k, v] of byCount(modalities))
  console.log(`  ${k.padEnd(26)} ${pct(v).padStart(7)}  ${'█'.repeat(Math.round((40 * v) / n))}`)
console.log(`  → com leitura preliminar de modalidade: ${pct(withPreliminary)}`)
console.log(`  → sem indicação de lado nenhum:         ${pct(undefinedWithoutReading)}`)

console.log('\nURGÊNCIA')
for (const k of ['ALTA', 'MÉDIA', 'BAIXA'])
  console.log(`  ${k.padEnd(26)} ${pct(urgencies[k] || 0).padStart(7)}`)

console.log('\nCONFIANÇA')
for (const k of ['ALTA', 'MÉDIA', 'BAIXA'])
  console.log(`  ${k.padEnd(26)} ${pct(confidences[k] || 0).padStart(7)}`)

console.log('\nRADAR (média por eixo)')
for (const [title, v] of Object.entries(radarByAxis)) {
  const valid = v.filter((x): x is number => x !== null)
  const mean = valid.reduce((s, x) => s + x, 0) / valid.length
  const noData = v.length - valid.length
  console.log(
    `  ${title.padEnd(32)} ${mean.toFixed(1).padStart(6)}` +
      (noData ? `   (${pct(noData)} sem dados)` : ''),
  )
}

console.log('\nPLANO DE AÇÃO')
const sorted = planSizes.slice().sort((x, y) => x - y)
console.log(
  `  itens por plano: mín ${sorted[0]} · mediana ${sorted[Math.floor(sorted.length / 2)]} · máx ${sorted[sorted.length - 1]}`,
)
console.log(`  planos sem nenhuma ação imediata do cliente: ${pct(withoutTrack1)}`)
console.log('\n  frequência de cada item:')
for (const [k, v] of byCount(actionItems)) console.log(`    ${k.padEnd(36)} ${pct(v).padStart(7)}`)

console.log('\nGATILHOS DA ÁRVORE')
for (const [k, v] of byCount(triggers)) console.log(`  ${k.padEnd(32)} ${pct(v).padStart(7)}`)
console.log()
