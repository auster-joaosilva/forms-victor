import { useQuery } from '@tanstack/react-query'
import { listAuditFn } from '../api/audit'
import { AuditView } from './audit-view'

export function AuditPanel() {
  const list = useQuery({ queryKey: ['audit'], queryFn: () => listAuditFn() })
  if (list.isPending) return <>carregando…</>
  if (list.isError) return <div className="bo-empty">{`Falha ao carregar: ${list.error.message}`}</div>
  return <AuditView entries={list.data} />
}
