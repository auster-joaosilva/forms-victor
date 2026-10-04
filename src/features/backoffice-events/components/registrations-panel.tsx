import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { REGISTRATION_STATUS_LABELS, type RegistrationStatus } from '@/server/events/domain/event'
import { isoDateToBr } from '@/server/shared/domain/dates'
import { handleRegistrationFn, type RegistrationRow } from '../api/events'

const ACTIONS: [RegistrationStatus, string][] = [['present', 'Presente'], ['absent', 'Ausente'], ['cancelled', 'Cancelar']]

type Props = { eventId: number; registrations: RegistrationRow[]; canHandle: boolean }

export function RegistrationsPanel({ eventId, registrations, canHandle }: Props) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const mark = useMutation({
    mutationFn: (input: { id: number; status: RegistrationStatus }) => handleRegistrationFn({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) return setError(`Não foi possível mudar: ${result.error}`)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['events', 'detail', eventId] })
    },
    onError: (failure) => setError(`Não foi possível mudar: ${failure.message}`),
  })

  return (
    <div className="bo-panel">
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-title)', fontWeight: 400 }}>Inscritos</h2>
      <p className="bo-note" style={{ margin: '0 0 16px' }}>
        “Presente” e “Ausente” são para depois do encontro: é o que transforma esta tela em lista de presença.
      </p>
      {error ? <div className="bo-error">{error}</div> : null}
      {registrations.length ? (
        <table>
          <thead>
            <tr>
              <th>Quem</th>
              <th>Empresa</th>
              <th>Encontro</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {registrations.map((row) => (
              <tr key={row.id}>
                <td>
                  <b>{row.name}</b>
                  <br />
                  <span className="bo-muted">{`${row.email}${row.phone ? ` · ${row.phone}` : ''}`}</span>
                </td>
                <td>
                  {row.company || '—'}
                  <br />
                  <span className="bo-muted">{`${row.cnpj ?? ''}${row.responseId ? ' · fez o diagnóstico' : ''}`}</span>
                </td>
                <td>
                  {`${isoDateToBr(row.sessionDate)} ${row.sessionTime}`}
                  <br />
                  <span className="bo-muted">{row.sessionTitle}</span>
                </td>
                <td>
                  <span className="bo-badge" data-status={row.status}>{REGISTRATION_STATUS_LABELS[row.status]}</span>
                </td>
                <td className="bo-actions">
                  {canHandle
                    ? ACTIONS.map(([status, label]) => (
                        <button key={status} type="button" className="bo-button is-light" disabled={mark.isPending}
                          onClick={() => mark.mutate({ id: row.id, status })}>
                          {label}
                        </button>
                      ))
                    : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="bo-empty">Ninguém inscrito ainda. O link é o que está no topo desta tela.</div>
      )}
    </div>
  )
}
