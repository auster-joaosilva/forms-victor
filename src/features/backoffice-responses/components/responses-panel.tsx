import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dialog } from 'radix-ui'
import { useState } from 'react'
import { formatShortDateTime } from '@/server/diagnosis/domain/dates'
import { RESPONSE_STATUSES, RESPONSE_STATUS_LABELS, isResponseStatus, type ResponseStatus } from '@/server/diagnosis/domain/response-status'
import { responseQuery, responsesQuery, type ResponsesFilter } from '../api/queries'
import { handleResponseFn, type ResponseDetail as ResponseDetailData, type ResponseSummary } from '../api/responses'
import { ResponseDetail } from './response-detail'

function csvHref({ status, q }: ResponsesFilter) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  const query = params.toString()
  return `/backoffice/responses.csv${query ? `?${query}` : ''}`
}

function ResponseRow({ row, onOpen }: { row: ResponseSummary; onOpen(): void }) {
  return (
    <tr className="bo-row" onClick={onOpen}>
      <td>
        <b>{row.companyName || '(sem nome)'}</b>
        <br />
        <span className="bo-muted">{row.cnpj ?? ''}</span>
      </td>
      <td>
        {row.requester || '—'}
        <br />
        <span className="bo-muted">{row.email ?? ''}</span>
      </td>
      <td>
        {row.position || '—'}
        <br />
        <span className="bo-muted">{`saída ${row.outcome || '—'} · ${row.certainty === 'fechada' ? 'fechada' : 'aberta'}`}</span>
      </td>
      <td>
        <span className="bo-badge" data-level={row.urgency || 'BAIXA'}>{row.urgency || '—'}</span>
        <br />
        <span className="bo-muted">{`confiança ${row.confidence || '—'}`}</span>
      </td>
      <td>
        {formatShortDateTime(row.receivedAt)}
        <br />
        <span className="bo-muted">{`${row.formVersion ?? ''}${row.viaInvitation ? ' · convite' : ''}`}</span>
      </td>
      <td>
        <span className="bo-badge" data-status={row.status}>{RESPONSE_STATUS_LABELS[row.status]}</span>
      </td>
    </tr>
  )
}

export function ResponsesPanel({ filter, onFilterChange }: { filter: ResponsesFilter; onFilterChange(next: ResponsesFilter): void }) {
  const queryClient = useQueryClient()
  const list = useQuery({ ...responsesQuery(filter), placeholderData: keepPreviousData })
  const [search, setSearch] = useState(filter.q ?? '')
  const [status, setStatus] = useState<ResponseStatus | ''>(filter.status ?? '')
  const [opening, setOpening] = useState<{ id: number; at: number; shown: ResponseDetailData | null } | null>(null)
  const detail = useQuery({ ...responseQuery(opening?.id ?? 0), enabled: opening !== null })
  // Freshness gates only the first display: a later refetch must not remount the sheet and drop a note being typed.
  if (opening && !opening.shown && detail.isSuccess && !detail.isFetching && detail.dataUpdatedAt >= opening.at && detail.data) {
    setOpening({ ...opening, shown: detail.data })
  }
  const handle = useMutation({
    mutationFn: (input: { id: number; status: ResponseStatus | null; note: string }) => handleResponseFn({ data: input }),
    onSuccess: async () => {
      setOpening(null)
      await queryClient.invalidateQueries({ queryKey: ['responses'] })
    },
  })

  if (list.isPending) return <>carregando…</>
  if (list.isError) return <div className="bo-empty">{`Falha ao carregar: ${list.error.message}`}</div>

  const { counts, items, page, pageCount } = list.data
  const applyFilter = () => onFilterChange({ status: status || undefined, q: search.trim() || undefined, page: 1 })
  const goTo = (next: number) => onFilterChange({ ...filter, page: next })
  const opened = opening?.shown ?? null

  return (
    <>
      <div className="bo-counts">
        {(['total', ...RESPONSE_STATUSES] as const).map((key) => (
          <div key={key} className="bo-count">
            <div className="bo-count-label">{key === 'total' ? 'Total' : RESPONSE_STATUS_LABELS[key]}</div>
            <div className="bo-count-value">{counts[key]}</div>
          </div>
        ))}
      </div>
      <div className="bo-filters">
        <input
          type="text"
          placeholder="Empresa, CNPJ, protocolo ou respondente"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyFilter()
          }}
        />
        <select value={status} onChange={(event) => setStatus(isResponseStatus(event.target.value) ? event.target.value : '')}>
          <option value="">Todas as situações</option>
          {RESPONSE_STATUSES.map((key) => (
            <option key={key} value={key}>
              {RESPONSE_STATUS_LABELS[key]}
            </option>
          ))}
        </select>
        <button type="button" className="bo-button is-light" onClick={applyFilter}>
          Filtrar
        </button>
        <a className="bo-button is-light" href={csvHref(filter)}>
          Baixar planilha (CSV)
        </a>
      </div>
      {items.length ? (
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Quem respondeu</th>
              <th>Posição</th>
              <th>Urgência</th>
              <th>Recebido</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <ResponseRow key={row.id} row={row} onOpen={() => setOpening({ id: row.id, at: Date.now(), shown: null })} />
            ))}
          </tbody>
        </table>
      ) : (
        <div className="bo-empty">Nenhuma resposta com esse filtro. Limpe a busca ou escolha outra situação.</div>
      )}
      <div className="bo-pagination">
        <button type="button" className="bo-button is-light" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          Anterior
        </button>
        <span>{`Página ${page} de ${pageCount}`}</span>
        <button type="button" className="bo-button is-light" disabled={page >= pageCount} onClick={() => goTo(page + 1)}>
          Próxima
        </button>
      </div>
      <p className="bo-note">
        A conferência existe porque a resposta é autodeclarada. Antes de virar trabalho, alguém da casa precisa olhar o CNPJ, o anexo e a
        alíquota — e é nesta tela que isso fica registrado, com autor e data.
      </p>

      <Dialog.Root open={Boolean(opened)} onOpenChange={(open) => !open && setOpening(null)}>
        <Dialog.Overlay className="bo-overlay" />
        <Dialog.Content className="bo-dialog" aria-describedby={undefined}>
          {opened ? (
            <ResponseDetail
              key={`${opened.id}:${opening?.at}`}
              detail={opened}
              pending={handle.isPending}
              onHandle={(next, note) => handle.mutate({ id: opened.id, status: next, note })}
              onClose={() => setOpening(null)}
              Title={Dialog.Title}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
