import { useEffect, useRef } from 'react'
import { FIRST_STEP, FORM_STEPS } from '@/server/diagnosis/domain/draft-rules'
import { BLOCKS, visibleQuestions } from '@/server/diagnosis/domain/questions'
import type { DiagnosisForm } from '../hooks/use-diagnosis-form'
import { QuestionField } from './question-field'

export function StepForm({ form, step }: { form: DiagnosisForm; step: number }) {
  const { state, actions } = form
  const block = BLOCKS[step - 1]
  const root = useRef<HTMLDivElement>(null)
  const scrollToError = useRef(false)

  useEffect(() => {
    if (!scrollToError.current) return
    scrollToError.current = false
    root.current?.querySelector('.dx-error')?.closest('.dx-field')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [state.errors])

  if (!block) return null
  const questions = visibleQuestions(state.answers).filter((question) => question.block === block.number)
  const next = () => {
    scrollToError.current = true
    actions.next()
  }
  return (
    <div className="dx-card" ref={root}>
      <h1>{block.title}</h1>
      <p className="dx-step-count">
        Etapa {step} de {FORM_STEPS}
      </p>
      {block.notice ? <div className="dx-scope">{block.notice}</div> : null}
      {block.glossary ? (
        <dl className="dx-glossary">
          {block.glossary.map((entry) => (
            <div key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>{entry.meaning}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {questions.map((question) => (
        <QuestionField
          key={question.key}
          question={question}
          answers={state.answers}
          error={state.errors[question.key]}
          highlighted={state.highlight === question.key}
          company={state.company}
          onAnswer={actions.setAnswer}
          onMatrixAnswer={actions.setMatrixAnswer}
          onBlur={actions.blurField}
          onHighlightEnd={actions.clearHighlight}
        />
      ))}
      <div className="dx-nav">
        <button type="button" className="dx-button is-secondary" disabled={step === FIRST_STEP} onClick={actions.back}>
          Voltar
        </button>
        <button type="button" className="dx-button is-primary" onClick={next}>
          {step === FORM_STEPS ? 'Conferir respostas' : 'Próximo'}
        </button>
      </div>
    </div>
  )
}
