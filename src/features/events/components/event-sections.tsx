import { SESSION_FORMAT_LABELS, type EventView } from '@/server/events/domain/event'
import { dateParts } from './dates'
import { fileUrl, sessionState } from './session-state'

// Traços desenhados aqui: a página abre inteira sem depender de outro servidor. Giram por posição.
const ICONS = [
  <path key="0" d="M3 12h4l3 8 4-16 3 8h4" />,
  <g key="1">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </g>,
  <path key="2" d="M4 20V9m5 11V4m5 16v-7m5 7V7" />,
  <path key="3" d="M20 7 9 18l-5-5" />,
  <g key="4">
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="M3 14l9 5 9-5" />
  </g>,
  <g key="5">
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <path d="M16 6h5M16 10h5M16 14h5" />
  </g>,
]

const hasAbout = (event: EventView) => Boolean(event.content.intro || event.content.destaques?.length)
const hasTopics = (event: EventView) => Boolean(event.content.temas?.length)
const hasSpeaker = (event: EventView) => Boolean(event.content.palestrante?.nome)
// "Onde acontece" só existe com local escrito e encontro presencial: numa série online a foto sugeriria sair de casa.
const hasPlace = (event: EventView) => Boolean(event.content.local) && event.sessions.some((session) => session.format === 'in_person')
const hasInfo = (event: EventView) => event.sessions.length > 0 || Boolean(event.content.local) || Boolean(event.content.avisos?.length)

// Os atalhos saem do que a página tem: evento sem palestrante não oferece link para seção que não existe.
export function sectionAnchors(event: EventView): [string, string][] {
  const all: [string, string, boolean][] = [
    ['sobre', 'O encontro', hasAbout(event)],
    ['temas', 'Temas', hasTopics(event)],
    ['programa', 'Programação', true],
    ['quem', 'Quem apresenta', hasSpeaker(event)],
    ['onde', 'Onde acontece', hasPlace(event)],
    ['participar', 'Como participar', hasInfo(event)],
  ]
  return all.filter(([, , present]) => present).map(([id, label]) => [id, label])
}

export function AboutSection({ event }: { event: EventView }) {
  if (!hasAbout(event)) return null
  const { intro, destaques = [] } = event.content
  return (
    <section className="rev" id="sobre">
      <span className="olho">o encontro</span>
      <h2>O que você vai ver</h2>
      <div className="regua" />
      {intro && <p className="linha-fina">{intro}</p>}
      {destaques.length > 0 && (
        <div className="destaques">
          {destaques.map((highlight, index) => (
            <div key={`${highlight.titulo}-${index}`} className="destaque">
              <div className="icone">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {ICONS[index % ICONS.length]}
                </svg>
              </div>
              <div className="t">{highlight.titulo}</div>
              <div className="d">{highlight.texto}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function TopicsSection({ event }: { event: EventView }) {
  if (!hasTopics(event)) return null
  return (
    <section className="rev" id="temas">
      <span className="olho">conteúdo</span>
      <h2>Temas abordados</h2>
      <div className="regua" />
      <div className="cartao">
        <ol className="temas">
          {(event.content.temas ?? []).map((topic, index) => (
            <li key={`${topic}-${index}`}>
              <span>{topic}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function ProgramSection({ event }: { event: EventView }) {
  return (
    <section className="rev" id="programa">
      <span className="olho">programação</span>
      <h2>{event.sessions.length === 1 ? 'Um encontro' : `${event.sessions.length} encontros`}</h2>
      <div className="regua" />
      <p className="linha-fina">A inscrição é por encontro: escolha o que couber na sua agenda.</p>
      <div className="cartao">
        <div className="linhatempo">
          {event.sessions.map((session) => {
            const when = dateParts(session.date)
            const state = sessionState(session)
            return (
              <div key={session.id} className="item">
                <div className="quando">
                  <div className="data">{when.short}</div>
                  <div className="dia">
                    {when.weekday}
                    <br />
                    {session.time}
                  </div>
                </div>
                <div>
                  <div className="t">{session.title}</div>
                  {session.description && <div className="d">{session.description}</div>}
                  {session.location && <div className="d">{session.location}</div>}
                  <div className="selos">
                    <span className={session.format === 'online' ? 'selo online' : 'selo'}>{SESSION_FORMAT_LABELS[session.format]}</span>
                    {state.badge && <span className={state.badgeClass ? `selo ${state.badgeClass}` : 'selo'}>{state.badge}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function SpeakerSection({ event }: { event: EventView }) {
  const speaker = event.content.palestrante
  if (!speaker?.nome) return null
  const photo = fileUrl(speaker.foto)
  return (
    <section className="rev" id="quem">
      <span className="olho">quem apresenta</span>
      <h2>{speaker.nome}</h2>
      <div className="regua" />
      <div className="cartao palestrante">
        {photo && <img src={photo} alt={speaker.nome} />}
        <div>
          {speaker.cargo && <div className="cargo">{speaker.cargo}</div>}
          {speaker.bio && <div className="bio">{speaker.bio}</div>}
        </div>
      </div>
    </section>
  )
}

export function PlaceSection({ event }: { event: EventView }) {
  if (!hasPlace(event)) return null
  return (
    <section className="rev" id="onde">
      <span className="olho">onde acontece</span>
      <h2>Na casa da Auster</h2>
      <div className="regua" />
      <div className="cartao lugar">
        <figure className="retrato">
          <img src="/imagens/fachada-larga.jpg" alt="Fachada da Auster, em Uberlândia" loading="lazy" />
        </figure>
        <div>
          <p>
            Os encontros presenciais são na nossa casa, em Uberlândia. É este prédio que você procura — a recepção fica logo na
            entrada, e é lá que a equipe recebe quem chega.
          </p>
          <div className="endereco">{event.content.local}</div>
          <p className="nota" style={{ marginTop: 8 }}>
            Chegue com alguns minutos de folga: dá tempo de um café antes de começar.
          </p>
        </div>
      </div>
    </section>
  )
}

export function InfoSection({ event }: { event: EventView }) {
  if (!hasInfo(event)) return null
  const { local, avisos = [] } = event.content
  const days = [...new Set(event.sessions.map((session) => dateParts(session.date).short))]
  const times = event.sessions.map((session) => `${dateParts(session.date).short} às ${session.time} — ${SESSION_FORMAT_LABELS[session.format]}`)
  return (
    <section className="rev" id="participar">
      <span className="olho">informações gerais</span>
      <h2>Para participar</h2>
      <div className="regua" />
      <div className="infos">
        {days.length > 0 && (
          <div className="info">
            <div className="r">Quando</div>
            <div className="v">
              {days.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
          </div>
        )}
        {times.length > 0 && (
          <div className="info">
            <div className="r">Horários</div>
            <div className="v">
              {times.map((time, index) => (
                <div key={`${time}-${index}`}>{time}</div>
              ))}
            </div>
          </div>
        )}
        {local && (
          <div className="info">
            <div className="r">Onde</div>
            <div className="v">{local}</div>
          </div>
        )}
      </div>
      {avisos.length > 0 && (
        <div className="aviso">
          <div className="r">Importante</div>
          <ul className="avisos">
            {avisos.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
