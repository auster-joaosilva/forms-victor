import { PublicBar } from '@/components/public/public-bar'
import { PublicFooter } from '@/components/public/public-footer'
import { scrollToId } from '@/components/public/scroll'
import { useReveal } from '@/components/public/use-reveal'
import { useStickyBar } from '@/components/public/use-sticky-bar'
import { useRegistrationForm } from '../hooks/use-registration-form'
import type { EventPageBootstrap, EventsApi } from '../types/events'
import { EventCover, registrationOpen } from './event-cover'
import { AboutSection, InfoSection, PlaceSection, ProgramSection, SpeakerSection, TopicsSection, sectionAnchors } from './event-sections'
import { RegistrationClosed, RegistrationFull } from './registration-closed'
import { RegistrationForm } from './registration-form'
import { RegistrationReceipt } from './registration-receipt'
import { openSessions } from './session-state'

export function EventPage({ bootstrap, api }: { bootstrap: EventPageBootstrap; api: EventsApi }) {
  const { event, today } = bootstrap
  const form = useRegistrationForm({ api, event })
  useReveal(form.receipt ? 'receipt' : event.id)
  useStickyBar()
  const toRegistration = () => scrollToId('inscricao')
  return (
    <div className="pub">
      <PublicBar
        anchors={form.receipt ? [] : sectionAnchors(event)}
        action={
          <button type="button" className="botao" onClick={toRegistration}>
            Inscrever-se
          </button>
        }
      />
      <EventCover event={event} today={today} onRegister={toRegistration} onProgram={() => scrollToId('programa')} />
      <main id="corpo">
        {form.receipt ? (
          <RegistrationReceipt receipt={form.receipt} session={form.chosenSession} />
        ) : (
          <>
            <AboutSection event={event} />
            <TopicsSection event={event} />
            <ProgramSection event={event} />
            <SpeakerSection event={event} />
            <PlaceSection event={event} />
            <InfoSection event={event} />
            {!registrationOpen(event) ? (
              <RegistrationClosed event={event} />
            ) : openSessions(event).length === 0 ? (
              <RegistrationFull />
            ) : (
              <section id="inscricao" className="faixa rev">
                <span className="olho">inscrição</span>
                <h2>Garanta a sua vaga</h2>
                <div className="regua" />
                <p className="linha-fina">Gratuita. A equipe da Auster confirma a sua vaga por e-mail e manda as instruções antes do encontro.</p>
                <RegistrationForm form={form} event={event} />
              </section>
            )}
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  )
}
