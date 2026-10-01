import { formatShortDateTime } from '@/server/shared/domain/dates'
import { AUDIT_ACTION_LABELS, type AuditAction } from '@/server/audit/domain/audit-entry'
import type { AuditRow } from '../api/audit'

const labelOf = (action: string): string => AUDIT_ACTION_LABELS[action as AuditAction] ?? action

export function AuditView({ entries }: { entries: AuditRow[] }) {
  return (
    <>
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-title)', fontWeight: 400 }}>Auditoria</h2>
      <p className="bo-note" style={{ margin: '0 0 18px' }}>
        Registro só de inserção: nada aqui é alterado depois. É o que permite explicar por que um registro está como está.
      </p>
      {entries.length ? (
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem</th>
              <th>O quê</th>
              <th>Referência</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatShortDateTime(entry.occurredAt)}</td>
                <td>{entry.actorUsername || '—'}</td>
                <td>{labelOf(entry.action)}</td>
                <td>{entry.reference || '—'}</td>
                <td style={{ fontSize: 'var(--text-meta)', color: 'var(--color-auster-gray)' }}>{entry.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="bo-empty">Nada registrado ainda. Os eventos aparecem aqui conforme a equipe entra, gera convites e trata respostas.</div>
      )}
    </>
  )
}
