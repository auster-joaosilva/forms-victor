import { useLayoutEffect } from 'react'
import { SiteHeader } from '@/components/brand/site-header'
import { stepOf } from '../hooks/form-state'
import { useDiagnosisForm } from '../hooks/use-diagnosis-form'
import type { DiagnosisApi, DiagnosisBootstrap } from '../types/diagnosis'
import { ResumeBanner } from './resume-banner'
import { StepBar } from './step-bar'
import { StepForm } from './step-form'
import { TriageReferral } from './triage-referral'

const FIRST_STEP = 1

export function DiagnosisPage({ bootstrap, api, resume }: { bootstrap: DiagnosisBootstrap; api: DiagnosisApi; resume: boolean }) {
  const form = useDiagnosisForm(bootstrap, { api, resume })
  const { state, actions } = form
  const { view } = state
  const step = stepOf(view)

  // A layout effect runs before the fields' effects, so a highlighted field still scrolls into view after this reset.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [view.kind, step])

  return (
    <>
      <SiteHeader subtitle="Diagnóstico — Simples padrão ou regime regular de IBS e CBS" />
      <main className="dx">
        {state.saveFailed ? (
          <div className="dx-notice" role="status">
            Não salvamos suas últimas respostas. Vamos tentar de novo no próximo salvamento.
          </div>
        ) : null}
        {view.kind === 'referral' ? <TriageReferral reason={view.reason} onBack={() => actions.goTo(FIRST_STEP)} /> : null}
        {view.kind === 'form' ? (
          <>
            {state.resumable && view.step === FIRST_STEP ? (
              <ResumeBanner resumable={state.resumable} onResume={actions.resume} onStartOver={actions.startOver} />
            ) : null}
            <StepBar current={step} onGoTo={actions.goTo} />
            <StepForm form={form} step={view.step} />
          </>
        ) : null}
      </main>
    </>
  )
}
