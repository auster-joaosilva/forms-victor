import { useState } from 'react'
import { RESET_CONFIRMATION } from '@/server/legacy-import/domain/migration'
import type { ImportReport, MigrationStatus, TableReport } from '../api/migration'

type Props = {
  status: MigrationStatus
  report: ImportReport | null
  error: string | null
  notice: string | null
  pending: boolean
  onSimulate(): void
  onImport(): void
  onReset(confirmation: string): void
}

const TABLES: { key: 'users' | 'invitations' | 'responses' | 'adhesions' | 'events' | 'sessions' | 'registrations' | 'images' | 'audit'; label: string }[] = [
  { key: 'users', label: 'Usuários' },
  { key: 'invitations', label: 'Convites' },
  { key: 'responses', label: 'Respostas' },
  { key: 'adhesions', label: 'Adesões' },
  { key: 'events', label: 'Eventos' },
  { key: 'sessions', label: 'Encontros' },
  { key: 'registrations', label: 'Inscrições' },
  { key: 'images', label: 'Imagens' },
  { key: 'audit', label: 'Auditoria' },
]

const summaryOf = (report: ImportReport) =>
  report.conflicts.length
    ? 'Nada foi gravado: há conflitos. Resolva-os e simule de novo.'
    : report.dryRun
      ? 'Simulação: nada foi gravado. Confira as contagens e os avisos antes de importar.'
      : 'Importação gravada. Rode de novo: tudo deve vir como pulado.'

function ReportTable({ report }: { report: ImportReport }) {
  const line = (label: string, counts: TableReport) => (
    <tr key={label}>
      <td>{label}</td>
      <td>{counts.found}</td>
      <td>{counts.imported}</td>
      <td>{counts.skipped}</td>
    </tr>
  )
  return (
    <table>
      <thead>
        <tr>
          <th>Tabela</th>
          <th>Encontrados</th>
          <th>Importados</th>
          <th>Pulados</th>
        </tr>
      </thead>
      <tbody>{TABLES.map(({ key, label }) => line(label, report[key]))}</tbody>
    </table>
  )
}

function Lines({ title, lines }: { title: string; lines: string[] }) {
  if (!lines.length) return null
  return (
    <>
      <h3 style={{ margin: '18px 0 6px', fontSize: 'var(--text-body)', fontWeight: 600 }}>{title}</h3>
      <ul className="bo-note" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  )
}

export function MigrationView({ status, report, error, notice, pending, onSimulate, onImport, onReset }: Props) {
  const [confirmation, setConfirmation] = useState('')
  const canImport = status.available && report !== null && report.conflicts.length === 0

  return (
    <>
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-title)', fontWeight: 400 }}>Migração do portal antigo</h2>
      <p className="bo-note" style={{ margin: '0 0 18px' }}>
        Lê o banco do portal antigo só para leitura, sem copiar o arquivo, e traz usuários, convites, respostas, adesões, eventos, inscrições, imagens e auditoria. Simule primeiro: qualquer
        conflito faz a importação recusar sem gravar nada. Na virada, importe antes de abrir o tráfego.
      </p>
      <p className="bo-note" style={{ margin: '0 0 18px' }}>
        Banco: <code>{status.path}</code> — <b>{status.available ? 'disponível' : status.reason ? 'não abre' : 'não encontrado'}</b>
        {status.available || status.reason ? null : '. Monte o volume do portal antigo no app (LEGACY_VOLUME_NAME no painel) e recarregue.'}
      </p>
      {status.reason ? <div className="bo-alert">{status.reason}</div> : null}
      <div className="bo-filters">
        <button type="button" className="bo-button" disabled={pending || !status.available} onClick={onSimulate}>
          Simular
        </button>
        <button type="button" className="bo-button" disabled={pending || !canImport} onClick={onImport}>
          Importar
        </button>
      </div>
      <div className="bo-error">{error}</div>
      {notice ? <div className="bo-alert is-ok">{notice}</div> : null}
      {report ? (
        <>
          <div className={report.conflicts.length ? 'bo-alert' : 'bo-alert is-ok'}>{summaryOf(report)}</div>
          <ReportTable report={report} />
          <Lines title="Conflitos" lines={report.conflicts} />
          <Lines title="Avisos" lines={report.notes} />
        </>
      ) : null}
      {status.resetAllowed ? (
        <section style={{ marginTop: 32 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 'var(--text-body)', fontWeight: 600 }}>Apagar dados de teste do hml</h3>
          <p className="bo-note" style={{ margin: '0 0 12px' }}>
            Apaga todas as respostas, adesões, inscrições, encontros, eventos e rascunhos deste banco: os de teste ocupam os ids das antigas e fazem a importação recusar. A Auditoria fica. Digite{' '}
            <b>{RESET_CONFIRMATION}</b> para liberar o botão.
          </p>
          <div className="bo-filters">
            <input
              type="text"
              aria-label="Confirmação"
              placeholder={RESET_CONFIRMATION}
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            <button
              type="button"
              className="bo-button is-light"
              disabled={pending || confirmation !== RESET_CONFIRMATION}
              onClick={() => {
                setConfirmation('')
                onReset(confirmation)
              }}
            >
              Apagar dados de teste
            </button>
          </div>
        </section>
      ) : null}
    </>
  )
}
