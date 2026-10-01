import { useEffect, useLayoutEffect, useRef, type ChangeEvent } from 'react'
import type { Answers, Question } from '@/server/diagnosis/domain/question-types'
import { VALIDATORS } from '@/server/shared/domain/validation'
import type { CompanyState } from '../hooks/form-state'
import { CnpjBadge } from './cnpj-badge'
import { MatrixField } from './matrix-field'
import { PrivacyConsent } from './privacy-consent'

const HIGHLIGHT_MS = 1800
const SHORT_OPTION_LENGTH = 26
const LABELLED_TYPES = new Set<Question['type']>(['text', 'email', 'phone', 'cnpj', 'select', 'textarea'])

export interface QuestionFieldProps {
  question: Question
  answers: Answers
  error?: string
  highlighted: boolean
  company: CompanyState
  onAnswer(key: string, value: string): void
  onMatrixAnswer(key: string, row: string, value: string): void
  onBlur(key: string): void
  onHighlightEnd(): void
}

export function QuestionField({ question, answers, error, highlighted, company, onAnswer, onMatrixAnswer, onBlur, onHighlightEnd }: QuestionFieldProps) {
  const { key, type } = question
  const answer = answers[key]
  const value = typeof answer === 'string' ? answer : ''
  const field = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const endHighlight = useRef(onHighlightEnd)

  useEffect(() => {
    endHighlight.current = onHighlightEnd
  })

  useEffect(() => {
    if (!highlighted) return
    field.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(() => endHighlight.current(), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [highlighted])

  useLayoutEffect(() => {
    if (caret.current === null) return
    const position = Math.min(caret.current, value.length)
    caret.current = null
    input.current?.setSelectionRange(position, position)
  })

  const handleText = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value
    const mask = question.validator ? VALIDATORS[question.validator].mask : undefined
    if (!mask) return onAnswer(key, raw)
    const cursor = event.target.selectionStart
    if (cursor !== null && cursor !== raw.length) caret.current = cursor
    onAnswer(key, mask(raw))
  }

  const hint = typeof question.hint === 'function' ? question.hint(answers) : question.hint
  const options = question.options ?? []
  const short = options.every((option) => !option.description && option.label.length <= SHORT_OPTION_LENGTH)
  const fieldId = `field-${key}`
  const labelId = `label-${key}`

  const control = () => {
    switch (type) {
      case 'single':
        return (
          <div className={`dx-options${short ? ' is-short' : ''}`} role="radiogroup" aria-labelledby={labelId}>
            {options.map((option) => {
              const checked = value === option.value
              return (
                <label key={option.value} className={`dx-option${checked ? ' is-checked' : ''}${option.description ? ' has-description' : ''}`}>
                  <input type="radio" name={key} value={option.value} checked={checked} onChange={() => onAnswer(key, option.value)} />
                  <span className="dx-option-text">
                    <b>{option.label}</b>
                    {option.description ? <span className="dx-option-description">{option.description}</span> : null}
                  </span>
                </label>
              )
            })}
          </div>
        )
      case 'select':
        return (
          <select id={fieldId} value={value} onChange={(event) => onAnswer(key, event.target.value)}>
            <option value="">Selecione…</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )
      case 'matrix':
        return <MatrixField question={question} answers={answers} onChange={(row, band) => onMatrixAnswer(key, row, band)} />
      case 'consent':
        return <PrivacyConsent question={question} checked={value === 'sim'} onChange={(checked) => onAnswer(key, checked ? 'sim' : '')} />
      case 'textarea':
        return <textarea id={fieldId} rows={3} placeholder="Opcional" value={value} onChange={(event) => onAnswer(key, event.target.value)} />
      case 'text':
      case 'email':
      case 'phone':
      case 'cnpj':
        return (
          <input
            ref={input}
            id={fieldId}
            type={type === 'email' ? 'email' : type === 'phone' ? 'tel' : 'text'}
            inputMode={type === 'phone' ? 'numeric' : 'text'}
            value={value}
            onChange={handleText}
            onBlur={() => onBlur(key)}
          />
        )
    }
  }

  return (
    <div className={`dx-field${highlighted ? ' is-highlighted' : ''}`} data-field={key} ref={field}>
      <label id={labelId} htmlFor={LABELLED_TYPES.has(type) ? fieldId : undefined}>
        {question.prompt}
        {question.required !== 'never' ? (
          <>
            {' '}
            <span className="dx-required">*</span>
          </>
        ) : null}
      </label>
      {hint ? <div className="dx-hint">{hint}</div> : null}
      {control()}
      {error ? <div className="dx-error">{error}</div> : null}
      {type === 'cnpj' ? <CnpjBadge state={company} /> : null}
    </div>
  )
}
