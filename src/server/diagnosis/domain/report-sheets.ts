import type { ActionItem, ActionPlan } from './action-plan'
import { formatLongDate } from './dates'
import type { Conflict, Diagnosis } from './diagnose'
import type { PositionDefinition } from './outcomes'
import type { Answers } from './question-types'
import { BLOCKS, visibleQuestions } from './questions'
import { asymmetryView, showsWithdrawalNotice, type AsymmetryView } from './result-view'
import { readableAnswer, type ReadableAnswer } from './review'
import { asString } from './stored-payload'

export interface ReportSubject {
  answers: Answers
  protocol: string
  issuedOn: Date
}

export interface NumberedAction {
  number: number
  action: string
  reason: string
  requires: string | null
  legalBasis: string | null
}

export interface ReportSheets {
  fileName: string
  cover: {
    company: string
    cnpj: string
    requester: string
    protocol: string
    issuedOn: string
    version: 'caminho curto' | 'completa'
    decision: { certainty: PositionDefinition['certainty']; label: string; qualifier: string; singleAction: string }
    openPoints: string[]
  }
  meaning: {
    text: string
    conflict: Conflict | null
    asymmetry: AsymmetryView
    showDeadlines: boolean
  }
  plan: { clientNow: NumberedAction[]; clientLater: NumberedAction[] }
  auster: NumberedAction[]
  summary: { blocks: { title: string; rows: { prompt: string; answer: ReadableAnswer | null }[] }[]; freeText: { label: string; value: string }[] }
  footer: string
  sheetCount: 5 | 6
}

export function reportFileName(companyName: string): string {
  const plain = (companyName || 'Empresa').normalize('NFD').replace(/[̀-ͯ]/g, '')
  const clean = plain.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `Plano-De-Acao-SN-${clean || 'Empresa'}`
}

const numbered = (items: ActionItem[], offset: number): NumberedAction[] =>
  items.map((item, index) => ({
    number: offset + index + 1,
    action: item.action,
    reason: item.reason,
    requires: item.requires ?? null,
    legalBasis: item.legalBasis ?? null,
  }))

export function reportSheets(subject: ReportSubject, diagnosis: Diagnosis, plan: ActionPlan): ReportSheets {
  const { answers, protocol } = subject
  const issuedOn = formatLongDate(subject.issuedOn)
  const company = asString(answers.nomeEmpresa)
  const { position } = diagnosis
  const visible = visibleQuestions(answers)
  const blocks = BLOCKS.map((block) => ({
    title: block.title,
    rows: visible
      .filter((question) => question.block === block.number && question.type !== 'consent' && question.type !== 'textarea')
      .map((question) => ({ prompt: question.prompt, answer: readableAnswer(question, answers) })),
  })).filter((block) => block.rows.length > 0)
  const freeText = [
    { label: 'O que você esperava descobrir', value: asString(answers.expectativa) },
    { label: 'O que mudou na sua percepção', value: asString(answers.percepcaoFinal) },
  ].filter((item) => item.value.trim())
  return {
    fileName: reportFileName(company),
    cover: {
      company: company || '—',
      cnpj: asString(answers.cnpj) || '—',
      requester: asString(answers.solicitante) || '—',
      protocol,
      issuedOn,
      version: answers.versaoFormulario === 'sintetico' ? 'caminho curto' : 'completa',
      decision: { certainty: position.certainty, label: position.label, qualifier: position.qualifier, singleAction: position.singleAction },
      openPoints: position.openPoints,
    },
    meaning: {
      text: diagnosis.outcome.meaning,
      conflict: diagnosis.conflict,
      asymmetry: asymmetryView(diagnosis),
      showDeadlines: showsWithdrawalNotice(diagnosis),
    },
    plan: { clientNow: numbered(plan.clientNow, 0), clientLater: numbered(plan.clientLater, plan.clientNow.length) },
    auster: numbered(plan.auster, 0),
    summary: { blocks, freeText },
    footer: `${protocol} · ${company} · emitido em ${issuedOn}`,
    sheetCount: plan.auster.length ? 6 : 5,
  }
}
