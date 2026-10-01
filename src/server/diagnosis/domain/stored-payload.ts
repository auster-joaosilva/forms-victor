import { normalizeCnpj } from '../../shared/domain/validation'
import type { Diagnosis } from './diagnose'
import type { Answers, Question } from './question-types'
import { BLOCKS, QUESTIONS } from './questions'
import { columnText, optionText } from './review'

export interface EngineSnapshot {
  outcome: string
  position: string
  certainty: string
  urgency: string
  confidence: string
  gaps: string[]
  triggers: string[]
  openPoints: string[]
}

export interface StoredPayload {
  answers: Answers
  engine: EngineSnapshot
  requesterInQsa: boolean | null
  formVersion: string | null
}

export interface ResponseProjections {
  companyName: string | null
  cnpj: string | null
  cnpjDigits: string | null
  requester: string | null
  email: string | null
  phone: string | null
  formVersion: string | null
  outcome: string | null
  position: string | null
  certainty: string | null
  urgency: string | null
  confidence: string | null
  requesterInQsa: boolean | null
}

export type DetailValue = { kind: 'text'; text: string } | { kind: 'matrix'; rows: { label: string; value: string }[] }

export interface AnswerBlocks {
  blocks: { number: number; title: string; rows: { key: string; prompt: string; value: DetailValue }[] }[]
  outsideForm: { key: string; value: DetailValue }[]
  total: number
}

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
export const asString = (value: unknown): string => (typeof value === 'string' ? value : '')
const asStrings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
const asBoolean = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null)
const orNull = (value: unknown): string | null => asString(value).trim() || null

export function buildStoredPayload(answers: Answers, diagnosis: Diagnosis, requesterInQsa: boolean | null): StoredPayload {
  return {
    answers,
    engine: {
      outcome: diagnosis.outcome.code,
      position: diagnosis.position.label,
      certainty: diagnosis.position.certainty,
      urgency: diagnosis.urgency,
      confidence: diagnosis.confidence.level,
      gaps: diagnosis.confidence.gaps,
      triggers: diagnosis.triggers,
      openPoints: diagnosis.position.openPoints,
    },
    requesterInQsa,
    formVersion: orNull(answers.versaoFormulario),
  }
}

export function readStoredPayload(payload: unknown): StoredPayload {
  const root = asRecord(payload)
  if ('answers' in root) {
    const engine = asRecord(root.engine)
    return {
      answers: asRecord(root.answers),
      engine: {
        outcome: asString(engine.outcome), position: asString(engine.position), certainty: asString(engine.certainty),
        urgency: asString(engine.urgency), confidence: asString(engine.confidence), gaps: asStrings(engine.gaps),
        triggers: asStrings(engine.triggers), openPoints: asStrings(engine.openPoints),
      },
      requesterInQsa: asBoolean(root.requesterInQsa),
      formVersion: orNull(root.formVersion),
    }
  }
  const legacy = asRecord(root.diagnostico)
  return {
    answers: asRecord(root.respostas),
    engine: {
      outcome: asString(legacy.saida), position: asString(legacy.posicao), certainty: asString(legacy.certeza),
      urgency: asString(legacy.urgencia), confidence: asString(legacy.confianca), gaps: asStrings(legacy.lacunas),
      triggers: asStrings(legacy.gatilhos), openPoints: asStrings(legacy.pontosEmAberto),
    },
    requesterInQsa: asBoolean(root.solicitanteNoQsa),
    formVersion: orNull(root.versaoFormulario),
  }
}

export const cnpjDigits = (cnpj: string): string | null => normalizeCnpj(cnpj) || null

export function responseProjections(payload: StoredPayload): ResponseProjections {
  const { answers, engine } = payload
  return {
    companyName: orNull(answers.nomeEmpresa),
    cnpj: orNull(answers.cnpj),
    cnpjDigits: cnpjDigits(asString(answers.cnpj)),
    requester: orNull(answers.solicitante),
    email: orNull(answers.email),
    phone: orNull(answers.telefone),
    formVersion: payload.formVersion,
    outcome: engine.outcome || null,
    position: engine.position || null,
    certainty: engine.certainty || null,
    urgency: engine.urgency || null,
    confidence: engine.confidence || null,
    requesterInQsa: payload.requesterInQsa,
  }
}

// A value the current form does not know is shown as it is: inventing a label would hide the divergence.
function detailValue(question: Question | undefined, value: unknown): DetailValue {
  if (value === undefined || value === null || value === '') return { kind: 'text', text: '—' }
  if (question?.type === 'matrix' && typeof value === 'object') {
    const matrix = asRecord(value)
    return {
      kind: 'matrix',
      rows: (question.rows ?? []).flatMap((row) => {
        const raw = matrix[row.key]
        return typeof raw === 'string' && raw ? [{ label: row.label, value: columnText(question, raw) }] : []
      }),
    }
  }
  if (typeof value === 'object') return { kind: 'text', text: JSON.stringify(value) }
  return { kind: 'text', text: question ? optionText(question, value) : String(value) }
}

export function answerBlocks(answers: Answers): AnswerBlocks {
  const answered = Object.keys(answers).filter((key) => key !== 'aceiteLgpd')
  const known = new Set(QUESTIONS.map((question) => question.key))
  return {
    blocks: BLOCKS.map((block) => ({
      number: block.number,
      title: block.title,
      rows: QUESTIONS.filter((question) => question.block === block.number && answered.includes(question.key)).map((question) => ({
        key: question.key,
        prompt: question.prompt,
        value: detailValue(question, answers[question.key]),
      })),
    })).filter((block) => block.rows.length > 0),
    outsideForm: answered.filter((key) => !known.has(key)).map((key) => ({ key, value: detailValue(undefined, answers[key]) })),
    total: answered.length,
  }
}
