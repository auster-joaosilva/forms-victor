import { useHydrated } from '@tanstack/react-router'
import type { AdhesionFormController } from '../hooks/use-adhesion-form'
import type { TermText } from '../types/adhesion'
import { DeclarationCard } from './declaration-card'
import { IdentificationCard } from './identification-card'
import { ModalityCard } from './modality-card'
import { ServicesCard } from './services-card'
import { TermSummary } from './term-summary'

export function AdhesionForm({ form, term }: { form: AdhesionFormController; term: TermText }) {
  const hydrated = useHydrated()
  return (
    <section className="ad-screen">
      <div className="ad-deadline">
        <b>Prazo.</b> A opção pelo Simples Híbrido é feita no Portal do Simples Nacional <b>até 30/10/2026</b>
        . Para que a Auster consiga formalizá-la, esta confirmação precisa estar concluída{' '}
        <b>até 29/10/2026</b>.
      </div>
      <fieldset className="ad-fieldset" disabled={!hydrated}>
        <IdentificationCard form={form} />
        <div className="ad-card">
          <h2>O que você está confirmando</h2>
          <TermSummary term={term} />
        </div>
        <ModalityCard form={form} term={term} />
        <ServicesCard form={form} term={term} />
        <DeclarationCard form={form} term={term} />
      </fieldset>
    </section>
  )
}
