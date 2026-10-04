import { BrandMark } from '@/components/public/brand-mark'
import { SESSION_FORMAT_LABELS, themeOf, type EventView } from '@/server/events/domain/event'
import { countdown, dateParts, daysUntil } from './dates'
import { fileUrl } from './session-state'

export const registrationOpen = (event: EventView) => event.registrations === 'open' && event.status === 'published'

function Waves() {
  return (
    <svg className="ondas" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
      <path fill="rgba(113,207,235,.16)" d="M0,64 C240,110 480,10 720,40 C960,70 1200,120 1440,86 L1440,120 L0,120 Z" />
      <path fill="rgba(247,251,253,.10)" d="M0,88 C280,40 520,120 780,92 C1040,64 1240,30 1440,58 L1440,120 L0,120 Z" />
    </svg>
  )
}

function CountdownLine({ event, today }: { event: EventView; today: string }) {
  const first = event.sessions[0]
  const left = countdown(first ? daysUntil(first.date, today) : null)
  if (!left) return null
  if (left.kind === 'today') return <div className="contagem"><b>É hoje.</b></div>
  if (left.kind === 'tomorrow') return <div className="contagem"><b>É amanhã.</b></div>
  return (
    <div className="contagem">
      faltam <b>{left.days}</b> dias
    </div>
  )
}

export function EventCover({
  event,
  today,
  onRegister,
  onProgram,
}: {
  event: EventView
  today: string
  onRegister: () => void
  onProgram: () => void
}) {
  const content = event.content
  const theme = themeOf(content)
  const photo = fileUrl(content.capa)
  return (
    <header className={`capa tema-${theme}`} id="capa">
      {theme === 'onda' && <Waves />}
      <div className="miolo">
        <div className="texto">
          <BrandMark />
          {content.rotulo && <span className="rotulo">{content.rotulo}</span>}
          <h1>{event.title}</h1>
          {content.chamada && <div className="chamada">{content.chamada}</div>}
          {event.sessions.length > 0 && (
            <div className="sessoes-capa">
              {event.sessions.map((session) => (
                <div key={session.id} className="sessao-chip">
                  <div className="quando">{`${dateParts(session.date).short} — ${session.time}`}</div>
                  <div className="oque">{`${SESSION_FORMAT_LABELS[session.format]}${session.title ? `: ${session.title}` : ''}`}</div>
                </div>
              ))}
            </div>
          )}
          {content.local && <div className="onde">{content.local}</div>}
          {registrationOpen(event) ? (
            <>
              <div className="acoes">
                <button type="button" className="botao" onClick={onRegister}>
                  Quero me inscrever
                </button>
                <button type="button" className="botao fantasma" onClick={onProgram}>
                  Ver a programação
                </button>
              </div>
              <CountdownLine event={event} today={today} />
            </>
          ) : (
            <div className="onde">As inscrições estão encerradas.</div>
          )}
        </div>
        {theme === 'foto' && photo && (
          <figure className="retrato-capa">
            <img src={photo} alt="" />
          </figure>
        )}
      </div>
    </header>
  )
}
