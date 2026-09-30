import type { VALIDATORS } from '../../shared/domain/validation'

export type Answers = Record<string, unknown>
export type MatrixAnswer = Record<string, string>

export type QuestionType =
  | 'single'
  | 'select'
  | 'matrix'
  | 'text'
  | 'email'
  | 'phone'
  | 'cnpj'
  | 'textarea'
  | 'consent'

export type Feeds = 'modality' | 'eligibility' | 'action' | 'radar' | 'registry'

export interface Option {
  value: string
  label: string
  score?: number | null
  description?: string
}

export interface MatrixRow {
  key: string
  label: string
}

export interface MatrixColumn {
  value: string
  label: string
  midpoint: number | null
}

export interface Question {
  key: string
  block: number
  prompt: string
  type: QuestionType
  origin: 'registry' | 'client'
  required: 'always' | 'conditional' | 'never'
  feeds: Feeds[]
  essential?: boolean
  condition?: (answers: Answers) => boolean
  unknownValue?: string
  gapLabel?: string
  gapFilled?: (answers: Answers) => boolean
  axes?: number[]
  order?: boolean
  validator?: keyof typeof VALIDATORS
  hint?: string | ((answers: Answers) => string)
  acceptLabel?: string
  options?: Option[]
  rows?: MatrixRow[]
  columns?: MatrixColumn[]
}

export interface Block {
  number: number
  title: string
  notice?: string
  glossary?: { term: string; meaning: string }[]
}

export interface RadarAxis {
  number: number
  title: string
}
