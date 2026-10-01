import { REVIEW_STEP } from '@/server/diagnosis/domain/draft-rules'
import { BLOCKS } from '@/server/diagnosis/domain/questions'

const STEPS = [...BLOCKS.map((block) => ({ number: block.number, title: block.title })), { number: REVIEW_STEP, title: 'Conferência' }]

export function StepBar({ current, onGoTo }: { current: number; onGoTo(step: number): void }) {
  return (
    <nav className="dx-steps" aria-label="Etapas">
      {STEPS.map((step, index) => {
        const label = `${index + 1}. ${step.title}`
        if (step.number < current) {
          return (
            <button key={step.number} type="button" className="dx-step is-done" onClick={() => onGoTo(step.number)}>
              {label}
            </button>
          )
        }
        const active = step.number === current
        return (
          <div key={step.number} className={active ? 'dx-step is-active' : 'dx-step'} aria-current={active ? 'step' : undefined}>
            {label}
          </div>
        )
      })}
    </nav>
  )
}
