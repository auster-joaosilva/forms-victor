import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ADHESION_STATUSES, type AdhesionStatus, type Modality } from '@/server/adhesion/domain/adhesion'
import { MODALITY_SHORT, STATUS_LABELS, WITHOUT_MANIFESTATION_SHORT } from '@/server/adhesion/domain/labels'
import type { AdhesionWindow } from '@/server/adhesion/domain/window'
import { formatShortDateTime, isoDateToBr } from '@/server/shared/domain/dates'
import { handleAdhesionFn, type AdhesionSummary } from '../api/adhesions'
import { adhesionsQuery, type AdhesionsFilter } from '../api/queries'

export const CANCEL_CONFIRMATION = 'Cancelar esta adesão? Use quando o cliente desistiu ou o termo saiu errado.'

const MODALITIES: Modality[] = ['padrao', 'hibrido']
const COUNTERS = [
  ['total', 'Total'], ['hybrid', 'Híbrido'], ['standard', 'Padrão'], ['toFile', 'A protocolar'], ['filed', 'Protocoladas'],
] as const

const isStatus = (value: string): value is AdhesionStatus => ADHESION_STATUSES.some((status) => status === value)
const isModality = (value: string): value is Modality => MODALITIES.some((modality) => modality === value)

function csvHref({ status, modality, q }: AdhesionsFilter) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (modality) params.set('modality', modality)
  if (q) params.set('q', q)
  const query = params.toString()
  return `/backoffice/adhesions.csv${query ? `?${query}` : ''}`
}

function DeadlineWarning({ toFile, window }: { toFile: number; window: AdhesionWindow }) {
  if (!toFile) return null
  const one = toFile === 1
  const end = isoDateToBr(window.end)
  return (
    <div className="bo-deadline">
      <b>{toFile}</b>
      {` ${one ? 'empresa autorizou' : 'empresas autorizaram'} a opção pelo Híbrido e ainda não ${one ? 'foi feita' : 'foram feitas'} no Portal do Simples Nacional. `}
      {window.state === 'closed' ? (
        <>
          <b>{`O prazo terminou em ${end}.`}</b>
          {' Estas não podem mais ser protocoladas: trate uma a uma e registre o que foi combinado com cada empresa.'}
        </>
      ) : (
        <b>{`O prazo é ${end}.`}</b>
      )}
    </div>
  )
}

function AdhesionRow({ row, pending, onMark }: { row: AdhesionSummary; pending: boolean; onMark(status: AdhesionStatus): void }) {
  return (
    <tr>
      <td>
        <b>{row.companyName || '(sem nome)'}</b>
        <br />
        <span className="bo-muted">{row.cnpj}</span>
      </td>
      <td>
        {row.representative || '—'}
        <br />
        <span className="bo-muted">{`${row.role} · ${row.email}`}</span>
      </td>
      <td>
        <b>{MODALITY_SHORT[row.modalidade]}</b>
        {row.semManifestacao ? (
          <>
            <br />
            <span className="bo-muted">{WITHOUT_MANIFESTATION_SHORT[row.semManifestacao]}</span>
          </>
        ) : null}
      </td>
      <td>
        {formatShortDateTime(row.acceptedAt)}
        <br />
        <span className="bo-muted">{row.protocol}</span>
      </td>
      <td>
        <span className="bo-badge" data-status={row.status}>{STATUS_LABELS[row.status]}</span>
        {row.querProposta ? (
          <>
            <br />
            <span className="bo-badge" data-flag="proposal">quer proposta</span>
          </>
        ) : null}
        {row.handledBy ? (
          <>
            <br />
            <span className="bo-muted">{`tratado por ${row.handledBy} em ${formatShortDateTime(row.handledAt)}`}</span>
          </>
        ) : null}
      </td>
      <td className="bo-actions">
        <a className="bo-button is-light" href={`/backoffice/adhesions/${row.id}/term`} target="_blank" rel="noopener">
          Termo (PDF)
        </a>
        {row.modalidade === 'hibrido' && row.status === 'received' ? (
          <button type="button" className="bo-button" disabled={pending} onClick={() => onMark('filed')}>
            Protocolei
          </button>
        ) : null}
        {row.status !== 'cancelled' ? (
          <button type="button" className="bo-button is-light" disabled={pending} onClick={() => window.confirm(CANCEL_CONFIRMATION) && onMark('cancelled')}>
            Cancelar
          </button>
        ) : null}
      </td>
    </tr>
  )
}

export function AdhesionsPanel({ filter, onFilterChange, canExport }: { filter: AdhesionsFilter; onFilterChange(next: AdhesionsFilter): void; canExport: boolean }) {
  const queryClient = useQueryClient()
  const list = useQuery({ ...adhesionsQuery(filter), placeholderData: keepPreviousData })
  const [search, setSearch] = useState(filter.q ?? '')
  const [modality, setModality] = useState<Modality | ''>(filter.modality ?? '')
  const [status, setStatus] = useState<AdhesionStatus | ''>(filter.status ?? '')
  const [error, setError] = useState<string | null>(null)
  const mark = useMutation({
    mutationFn: (input: { id: number; status: AdhesionStatus }) => handleAdhesionFn({ data: input }),
    onSuccess: async (result) => {
      if (!result.ok) return setError(`Não consegui mudar a situação: ${result.error}. Tente de novo.`)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['adhesions'] })
    },
    onError: (failure) => setError(`Não consegui mudar a situação: ${failure.message}. Tente de novo.`),
  })

  if (list.isPending) return <>carregando…</>
  if (list.isError) return <div className="bo-empty">{`Falha ao carregar: ${list.error.message}`}</div>

  const { counts, items, page, pageCount, window: deadline } = list.data
  const applyFilter = () => onFilterChange({ status: status || undefined, modality: modality || undefined, q: search.trim() || undefined, page: 1 })
  const goTo = (next: number) => onFilterChange({ ...filter, page: next })

  return (
    <>
      <div className="bo-counts">
        {COUNTERS.map(([key, label]) => (
          <div key={key} className="bo-count">
            <div className="bo-count-label">{label}</div>
            <div className="bo-count-value">{counts[key]}</div>
          </div>
        ))}
      </div>
      <DeadlineWarning toFile={counts.toFile} window={deadline} />
      <div className="bo-filters">
        <input
          type="text"
          placeholder="Empresa, CNPJ, protocolo ou representante"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyFilter()
          }}
        />
        <select value={modality} onChange={(event) => setModality(isModality(event.target.value) ? event.target.value : '')}>
          <option value="">Todas as modalidades</option>
          {MODALITIES.map((key) => (
            <option key={key} value={key}>
              {MODALITY_SHORT[key]}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(isStatus(event.target.value) ? event.target.value : '')}>
          <option value="">Todas as situações</option>
          {ADHESION_STATUSES.map((key) => (
            <option key={key} value={key}>
              {STATUS_LABELS[key]}
            </option>
          ))}
        </select>
        <button type="button" className="bo-button is-light" onClick={applyFilter}>
          Filtrar
        </button>
        {canExport ? (
          <a className="bo-button is-light" href={csvHref(filter)}>
            Baixar planilha (CSV)
          </a>
        ) : null}
      </div>
      {error ? <div className="bo-error">{error}</div> : null}
      {items.length ? (
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Quem confirmou</th>
              <th>Modalidade</th>
              <th>Confirmado</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <AdhesionRow key={row.id} row={row} pending={mark.isPending} onMark={(next) => mark.mutate({ id: row.id, status: next })} />
            ))}
          </tbody>
        </table>
      ) : (
        <div className="bo-empty">Nenhuma adesão com esse filtro. Limpe a busca ou escolha outra modalidade.</div>
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
        Confirmar aqui não protocola nada: a opção continua sendo feita à mão no Portal do Simples Nacional, empresa por empresa. Esta tela serve
        para ninguém ficar de fora e para registrar quem fez.
      </p>
    </>
  )
}
