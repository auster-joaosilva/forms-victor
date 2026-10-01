import { createFileRoute, notFound } from '@tanstack/react-router'
import { SiteHeader } from '@/components/brand/site-header'
import { TermDocument } from '@/features/adhesion/components/term-document'
import { getAdhesionTermFn } from '@/features/backoffice-adhesions/api/adhesions'
import { printWhenReady } from '@/lib/print'
import { termFileName } from '@/server/adhesion/domain/labels'

export const Route = createFileRoute('/backoffice/adhesions/$id/term')({
  loader: async ({ params }) => {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id < 1) throw notFound()
    const copy = await getAdhesionTermFn({ data: { id } })
    if (!copy.ok && copy.reason === 'not_found') throw notFound()
    return copy
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData?.ok ? termFileName(loaderData.adhesion.empresa.nomeEmpresa) : 'Termo de opção — Simples Nacional 2027' }],
  }),
  notFoundComponent: () => (
    <main className="dx">
      <div className="dx-card">Adesão não encontrada.</div>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main className="dx">
      <div className="dx-card">{error instanceof Error ? error.message : String(error)}</div>
    </main>
  ),
  component: AdhesionTerm,
})

function AdhesionTerm() {
  const copy = Route.useLoaderData()
  if (!copy.ok) {
    return (
      <main className="dx">
        <div className="dx-card">{copy.message}</div>
      </main>
    )
  }
  const fileName = termFileName(copy.adhesion.empresa.nomeEmpresa)
  return (
    <div className="ad-reprint">
      <SiteHeader subtitle={copy.term.subtitulo} />
      <main className="dx">
        <div className="mb-4 print:hidden">
          <button type="button" className="dx-button is-primary" onClick={() => void printWhenReady(fileName)}>
            Baixar o termo (PDF)
          </button>
        </div>
        <div className="ad">
          <TermDocument term={copy.term} adhesion={copy.adhesion} />
        </div>
      </main>
    </div>
  )
}
