import type { EventSessionView, SessionFormat } from '@/server/events/domain/event'

export type SessionRow = {
  key: string
  id?: number
  date: string
  time: string
  format: SessionFormat
  title: string
  description: string
  location: string
  seats: string
  taken: number
}

export type SessionToSave = {
  id?: number
  date: string
  time: string
  format: SessionFormat
  title: string
  description: string | null
  location: string | null
  seats: number | null
}

export const draftsOf = (sessions: EventSessionView[]): SessionRow[] =>
  sessions.map((session) => ({
    key: `s${session.id}`,
    id: session.id,
    date: session.date,
    time: session.time,
    format: session.format,
    title: session.title,
    description: session.description ?? '',
    location: session.location ?? '',
    seats: session.seats === null ? '' : String(session.seats),
    taken: session.taken,
  }))

// As regras do gravarSessoes da casa: sem data ou hora a linha não conta, e vaga que não é inteiro positivo é "sem limite".
export function sessionsToSave(rows: SessionRow[]): SessionToSave[] {
  return rows
    .filter((row) => row.date && row.time.trim())
    .map((row) => {
      const seats = Number.parseInt(row.seats, 10)
      return {
        ...(row.id ? { id: row.id } : {}),
        date: row.date,
        time: row.time.trim(),
        format: row.format,
        title: row.title.trim(),
        description: row.description.trim() || null,
        location: row.location.trim() || null,
        seats: Number.isFinite(seats) && seats > 0 ? seats : null,
      }
    })
}

type Props = { rows: SessionRow[]; onChange(next: SessionRow[]): void; disabled: boolean }

export function SessionsTable({ rows, onChange, disabled }: Props) {
  const edit = (key: string, patch: Partial<SessionRow>) => onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  const add = () =>
    onChange([...rows, { key: `n${Date.now()}${rows.length}`, date: '', time: '', format: 'in_person', title: '', description: '', location: '', seats: '', taken: 0 }])
  return (
    <>
      <table className="bo-sessions">
        <thead>
          <tr>
            <th>Data</th>
            <th>Hora</th>
            <th>Formato</th>
            <th>Título</th>
            <th>Descrição</th>
            <th>Local ou canal</th>
            <th>Vagas</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key}>
              <td>
                <input type="date" aria-label={`Data do encontro ${index + 1}`} value={row.date} disabled={disabled} onChange={(event) => edit(row.key, { date: event.target.value })} />
              </td>
              <td>
                <input type="text" aria-label={`Hora do encontro ${index + 1}`} placeholder="19:30" style={{ width: 74 }} value={row.time} disabled={disabled}
                  onChange={(event) => edit(row.key, { time: event.target.value })} />
              </td>
              <td>
                <select aria-label={`Formato do encontro ${index + 1}`} value={row.format} disabled={disabled}
                  onChange={(event) => edit(row.key, { format: event.target.value === 'online' ? 'online' : 'in_person' })}>
                  <option value="in_person">Presencial</option>
                  <option value="online">Online</option>
                </select>
              </td>
              <td>
                <input type="text" aria-label={`Título do encontro ${index + 1}`} placeholder={`Encontro ${index + 1}`} value={row.title} disabled={disabled}
                  onChange={(event) => edit(row.key, { title: event.target.value })} />
              </td>
              <td>
                <input type="text" aria-label={`Descrição do encontro ${index + 1}`} placeholder="opcional" value={row.description} disabled={disabled}
                  onChange={(event) => edit(row.key, { description: event.target.value })} />
              </td>
              <td>
                <input type="text" aria-label={`Local do encontro ${index + 1}`} placeholder="local ou canal" value={row.location} disabled={disabled}
                  onChange={(event) => edit(row.key, { location: event.target.value })} />
              </td>
              <td>
                <input type="text" inputMode="numeric" aria-label={`Vagas do encontro ${index + 1}`} placeholder="sem limite" style={{ width: 92 }} value={row.seats}
                  disabled={disabled} onChange={(event) => edit(row.key, { seats: event.target.value })} />
              </td>
              <td>
                {row.taken ? (
                  <span className="bo-badge" data-status="new">{`${row.taken} inscritos`}</span>
                ) : (
                  <button type="button" className="bo-button is-light" disabled={disabled} onClick={() => onChange(rows.filter((other) => other.key !== row.key))}>
                    Tirar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10 }}>
        <button type="button" className="bo-button is-light" disabled={disabled} onClick={add}>
          Acrescentar encontro
        </button>
      </div>
    </>
  )
}
