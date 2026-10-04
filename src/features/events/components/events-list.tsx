import { BrandMark } from '@/components/public/brand-mark'
import { PublicBar } from '@/components/public/public-bar'
import { PublicFooter } from '@/components/public/public-footer'
import { useReveal } from '@/components/public/use-reveal'
import { useStickyBar } from '@/components/public/use-sticky-bar'
import type { EventSummary } from '@/server/events/domain/event'
import { dateParts } from './dates'

function EventCard({ event }: { event: EventSummary }) {
  // Sem sessão a página ainda abre: um evento em montagem não pode derrubar a lista inteira.
  const when = event.firstDate ? dateParts(event.firstDate) : null
  return (
    <a className="evento" href={`/events/${encodeURIComponent(event.slug)}`}>
      <div className="capa-cartao">
        <div className="dia">
          {when ? (
            <>
              <b>{when.day}</b>
              <i>{`${when.month} ${when.year}`}</i>
            </>
          ) : (
            <i>data a definir</i>
          )}
        </div>
      </div>
      <div className="miolo">
        <h3>{event.title}</h3>
        {event.chamada && <div className="resumo">{event.chamada}</div>}
        <div className="rodape">{`${event.sessionCount > 1 ? `${event.sessionCount} encontros · ` : ''}${
          event.registrations === 'closed' ? 'inscrições encerradas' : 'inscrição aberta'
        } →`}</div>
      </div>
    </a>
  )
}

export function EventsList({ events }: { events: EventSummary[] }) {
  useReveal(events.length)
  useStickyBar()
  return (
    <div className="pub">
      <PublicBar anchors={[]} action={null} />
      <header className="capa tema-marca" id="capa">
        <div className="miolo">
          <div>
            <BrandMark />
            <span className="rotulo">Agenda da Auster</span>
            <h1>
              Encontros sobre a <b>Reforma Tributária</b>
            </h1>
            <div className="chamada">O que muda na sua empresa, explicado por quem cuida dela todos os dias. Inscrição gratuita.</div>
          </div>
        </div>
      </header>
      <main id="corpo">
        <section>
          <div className="grade">
            {events.length ? (
              events.map((event) => <EventCard key={event.id} event={event} />)
            ) : (
              <div className="vazio">
                <b>Nenhum encontro marcado no momento.</b>
                <br />
                Assim que a próxima data sair, ela aparece aqui.
              </div>
            )}
          </div>
        </section>
        <section className="fecho rev">
          <span className="olho">enquanto isso</span>
          <h2>Já sabe o que a reforma faz com a sua empresa?</h2>
          <div className="regua" />
          <p className="linha-fina">
            Se ela é do Simples Nacional, o diagnóstico do portal mostra em minutos se vale permanecer na guia única ou recolher IBS
            e CBS por fora dela.
          </p>
          <a className="botao escura" href="/diagnosis">
            Fazer o diagnóstico
          </a>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
