import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { SiteHeader } from '@/components/brand/site-header'
import { getSubmittedReport } from '@/features/diagnosis/api/diagnosis'
import { ReportDocument } from '@/features/diagnosis/components/report-document'
import { printWhenReady } from '@/lib/print'

export const Route = createFileRoute('/diagnosis/report')({
  validateSearch: z.object({ print: z.literal(1).optional().catch(undefined) }),
  loader: () => getSubmittedReport(),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.fileName ?? 'Plano de ação | auster' }] }),
  component: ReportRoute,
})

function ReportRoute() {
  const sheets = Route.useLoaderData()
  const { print } = Route.useSearch()

  useEffect(() => {
    if (sheets && print === 1) void printWhenReady(sheets.fileName)
  }, [sheets, print])

  return (
    <>
      <SiteHeader subtitle="Diagnóstico — Simples padrão ou regime regular de IBS e CBS" />
      <main className="dx">
        {sheets ? (
          <ReportDocument
            sheets={sheets}
            toolbar={
              <>
                <Link to="/diagnosis" search={{ resume: '1' }} className="dx-button is-secondary">
                  Voltar ao diagnóstico
                </Link>
                <button type="button" className="dx-button is-primary" onClick={() => void printWhenReady(sheets.fileName)}>
                  Imprimir ou salvar em PDF
                </button>
              </>
            }
          />
        ) : (
          <div className="dx-card">
            <h1>Nenhum diagnóstico enviado neste navegador</h1>
            <p>O plano de ação sai da resposta enviada. Faça o diagnóstico até o resultado e baixe o PDF de lá.</p>
            <Link to="/diagnosis" className="dx-button is-primary">
              Fazer o diagnóstico
            </Link>
          </div>
        )}
      </main>
    </>
  )
}
