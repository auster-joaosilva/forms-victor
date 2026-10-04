import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { importMigrationFn, migrationStatusFn, resetTestDataFn, simulateMigrationFn, type ImportReport, type ReportOutcome } from '../api/migration'
import { MigrationView } from './migration-view'

const IMPORT_CONFIRMATION = 'Importar do portal antigo? Os dados entram no banco deste ambiente e a importação fica registrada na Auditoria.'

export function MigrationPanel() {
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const status = useQuery({ queryKey: ['migration-status'], queryFn: () => migrationStatusFn() })

  // O fetch rejeita com TypeError quando não chega ao servidor; o resto é erro que o servidor devolveu.
  const failed = (failure: Error) =>
    setError(failure instanceof TypeError ? `Não deu para falar com o servidor: ${failure.message}` : `A operação falhou: ${failure.message}`)
  const showReport = (result: ReportOutcome) => {
    setNotice(null)
    setError(result.ok ? null : result.message)
    if (result.ok) setReport(result.report)
  }
  const simulate = useMutation({ mutationFn: () => simulateMigrationFn(), onSuccess: showReport, onError: failed })
  const importNow = useMutation({ mutationFn: () => importMigrationFn(), onSuccess: showReport, onError: failed })
  const reset = useMutation({
    mutationFn: (confirmation: string) => resetTestDataFn({ data: { confirmation } }),
    onSuccess: (result) => {
      setError(result.ok ? null : result.message)
      if (!result.ok) return
      // O que a simulação contou não vale mais: o banco mudou.
      setReport(null)
      const { drafts, registrations, adhesions, responses } = result.erased
      setNotice(`Apagados: ${drafts} rascunhos, ${registrations} inscrições, ${adhesions} adesões e ${responses} respostas. Simule de novo antes de importar.`)
    },
    onError: failed,
  })

  if (status.isPending) return <>carregando…</>
  if (status.isError) return <div className="bo-empty">{`Falha ao carregar: ${status.error.message}`}</div>

  return (
    <MigrationView
      status={status.data}
      report={report}
      error={error}
      notice={notice}
      pending={simulate.isPending || importNow.isPending || reset.isPending}
      onSimulate={() => simulate.mutate()}
      onImport={() => window.confirm(IMPORT_CONFIRMATION) && importNow.mutate()}
      onReset={(confirmation) => reset.mutate(confirmation)}
    />
  )
}
