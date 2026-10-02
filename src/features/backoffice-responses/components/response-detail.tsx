import { Fragment, useState, type ElementType, type ReactNode } from 'react'
import { formatShortDateTime } from '@/server/shared/domain/dates'
import { RESPONSE_STATUSES, RESPONSE_STATUS_LABELS, type ResponseStatus } from '@/server/diagnosis/domain/response-status'
import type { DetailValue } from '@/server/diagnosis/domain/stored-payload'
import type { ResponseDetail as Detail } from '../api/responses'

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bo-item">
      <div className="bo-item-label">{label}</div>
      <div className="bo-item-value">{value ?? '—'}</div>
    </div>
  )
}

function ValueText({ value }: { value: DetailValue }) {
  if (value.kind === 'text') return value.text
  return value.rows.map((row, index) => (
    <Fragment key={row.label}>
      {index > 0 ? <br /> : null}
      {row.label}: <b>{row.value}</b>
    </Fragment>
  ))
}

function AnswerRows({ rows }: { rows: { key: string; prompt?: string; value: DetailValue }[] }) {
  return (
    <div className="bo-answers">
      {rows.map((row) => (
        <div key={row.key}>
          <span className="bo-answer-key">{row.prompt ?? row.key}</span>
          <span className="bo-answer-value">
            <ValueText value={row.value} />
          </span>
        </div>
      ))}
    </div>
  )
}

export function ResponseDetail({ detail, pending, onHandle, onClose, Title = 'h2' }: {
  detail: Detail
  pending: boolean
  onHandle(status: ResponseStatus | null, note: string): void
  onClose(): void
  Title?: ElementType<{ children: ReactNode }>
}) {
  const [note, setNote] = useState(detail.internalNote)
  const { engine, answers } = detail

  return (
    <div className="bo-sheet">
      <div className="bo-protocol">
        Protocolo {detail.protocol}
        {detail.invitationToken ? ` · convite ${detail.invitationToken}` : ' · link aberto'}
      </div>
      <Title>{detail.companyName ?? '(sem nome)'}</Title>
      <div className="bo-grid">
        <Item label="CNPJ" value={detail.cnpj} />
        <Item label="Quem respondeu" value={detail.requester} />
        <Item label="E-mail" value={detail.email} />
        <Item label="Telefone" value={detail.phone} />
        <Item label="Recebido em" value={formatShortDateTime(detail.receivedAt)} />
        <Item label="Versão" value={detail.formVersion} />
      </div>

      <h3>O que o motor devolveu</h3>
      <div className="bo-grid">
        <Item label="Posição" value={engine.position} />
        <Item label="Certeza" value={engine.certainty} />
        <Item label="Saída" value={engine.outcome} />
        <Item label="Urgência" value={engine.urgency} />
        <Item label="Confiança" value={engine.confidence} />
      </div>
      {engine.openPoints.length ? (
        <>
          <h3>Pontos em aberto</h3>
          <ul className="bo-sheet-list">
            {engine.openPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </>
      ) : null}
      {engine.gaps.length ? (
        <>
          <h3>Campos em "não sei"</h3>
          <div className="bo-sheet-gaps">{engine.gaps.join(' · ')}</div>
        </>
      ) : null}

      {detail.requesterInQsa === false ? (
        <div className="bo-alert">
          <b>Quem respondeu não consta do quadro de sócios do CNPJ consultado.</b> Pode ser procurador, contador ou funcionário — só não dá para
          tratar como decisor sem confirmar.
        </div>
      ) : detail.requesterInQsa === true ? (
        <div className="bo-alert is-ok">Quem respondeu consta do quadro de sócios.</div>
      ) : null}
      {detail.changedAfterHandling ? (
        <div className="bo-alert">{`Alterada pelo cliente em ${formatShortDateTime(detail.updatedAt)}, depois do último tratamento. Confira as respostas de novo.`}</div>
      ) : null}

      <h3>
        Todas as respostas <span className="bo-sheet-count">{answers.total} campos respondidos</span>
      </h3>
      {answers.blocks.map((block) => (
        <Fragment key={block.number}>
          <h4 className="bo-answers-title">{`${block.number}. ${block.title}`}</h4>
          <AnswerRows rows={block.rows} />
        </Fragment>
      ))}
      {answers.outsideForm.length ? (
        <>
          <h4 className="bo-answers-title is-outside">fora do formulário atual</h4>
          <AnswerRows rows={answers.outsideForm} />
        </>
      ) : null}
      {answers.blocks.length === 0 && answers.outsideForm.length === 0 ? (
        <div className="bo-answers">
          <div>(vazio)</div>
        </div>
      ) : null}
      <p className="bo-note is-tight">
        O formulário tem perguntas condicionais: o que não se aplicava ao caso não foi perguntado, e por isso não aparece aqui.
      </p>

      <h3>Tratamento interno</h3>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="O que foi conferido, o que ficou pendente, o que combinar com o cliente"
      />
      <div className="bo-handled">
        {detail.handledBy ? `Último tratamento: ${detail.handledBy} em ${formatShortDateTime(detail.handledAt)}` : 'Nunca tratada.'}
      </div>
      <div className="bo-sheet-actions">
        {RESPONSE_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={detail.status === status ? 'bo-button' : 'bo-button is-light'}
            disabled={pending}
            onClick={() => onHandle(status, note)}
          >
            {RESPONSE_STATUS_LABELS[status]}
          </button>
        ))}
        <a href={`/backoffice/responses/${detail.id}/report`} target="_blank" rel="noopener" className="bo-button is-light">
          Abrir plano de ação (PDF)
        </a>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={() => onHandle(null, note)}>
          Só salvar a nota
        </button>
        <button type="button" className="bo-button is-light" disabled={pending} onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}
