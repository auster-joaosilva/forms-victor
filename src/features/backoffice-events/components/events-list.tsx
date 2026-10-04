import { useState } from 'react'
import { EVENT_STATUS_LABELS, type EventSummary } from '@/server/events/domain/event'
import { isoDateToBr } from '@/server/shared/domain/dates'

type Props = {
  events: EventSummary[]
  canManage: boolean
  creating: boolean
  error: string | null
  onOpen(id: number): void
  onCreate(title: string): void
}

export function EventsList({ events, canManage, creating, error, onOpen, onCreate }: Props) {
  const [title, setTitle] = useState('')
  const create = () => {
    const clean = title.trim()
    if (clean) onCreate(clean)
  }
  return (
    <>
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-title)', fontWeight: 400 }}>Agenda de eventos</h2>
      <p className="bo-note" style={{ margin: '0 0 18px' }}>
        Cada evento vira uma página em <code>/events/apelido</code>, com inscrição por encontro. Enquanto está em <b>rascunho</b>, só quem tem sessão aqui
        consegue abrir o endereço — dá para conferir antes de divulgar.
      </p>
      {canManage ? (
        <div className="bo-filters">
          <input
            type="text"
            aria-label="Título do evento (dá para mudar depois)"
            placeholder="Título do evento (dá para mudar depois)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') create()
            }}
          />
          <button type="button" className="bo-button" disabled={creating} onClick={create}>
            Novo evento
          </button>
        </div>
      ) : null}
      {error ? <div className="bo-error">{error}</div> : null}
      {events.length ? (
        <table>
          <thead>
            <tr>
              <th>Evento</th>
              <th>Primeira data</th>
              <th>Situação</th>
              <th>Inscritos</th>
            </tr>
          </thead>
          <tbody>
            {events.map((row) => (
              <tr key={row.id} className="bo-row-link" onClick={() => onOpen(row.id)}>
                <td>
                  <button type="button" className="bo-link-button" onClick={(event) => (event.stopPropagation(), onOpen(row.id))}>
                    <b>{row.title}</b>
                  </button>
                  <br />
                  <span className="bo-muted">{`/events/${row.slug}`}</span>
                </td>
                <td>{row.firstDate ? isoDateToBr(row.firstDate) : '—'}</td>
                <td>
                  <span className="bo-badge" data-event-status={row.status}>{EVENT_STATUS_LABELS[row.status]}</span>
                  {row.registrations === 'closed' ? (
                    <>
                      <br />
                      <span className="bo-badge" data-status="cancelled">inscrições encerradas</span>
                    </>
                  ) : null}
                </td>
                <td>
                  <b>{row.registered}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="bo-empty">Nenhum evento ainda. Use “Novo evento” para criar o primeiro.</div>
      )}
    </>
  )
}
