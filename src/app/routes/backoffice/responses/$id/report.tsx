import { createFileRoute, notFound } from '@tanstack/react-router'
import { SiteHeader } from '@/components/brand/site-header'
import { getResponseReportFn } from '@/features/backoffice-responses/api/responses'
import { ReportDocument } from '@/features/diagnosis/components/report-document'
import { printWhenReady } from '@/lib/print'

export const Route = createFileRoute('/backoffice/responses/$id/report')({
  loader: async ({ params }) => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id < 1) throw notFound()
    const sheets = await getResponseReportFn({ data: { id } })
    if (!sheets) throw notFound()
    return sheets
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.fileName ?? 'Plano de ação | auster' }] }),
  notFoundComponent: () => (
    <main className="dx">
      <div className="dx-card">Resposta não encontrada.</div>
    </main>
  ),
  component: ResponseReport,
})

function ResponseReport() {
  const sheets = Route.useLoaderData()
  return (
    <>
      <SiteHeader subtitle="Diagnóstico — Simples padrão ou regime regular de IBS e CBS" />
      <main className="dx">
        <ReportDocument
          sheets={sheets}
          toolbar={
            <button type="button" className="dx-button is-primary" onClick={() => void printWhenReady(sheets.fileName)}>
              Imprimir ou salvar em PDF
            </button>
          }
        />
      </main>
    </>
  )
}
