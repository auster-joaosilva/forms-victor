import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { loadAdhesionPage } from '@/features/adhesion/api/adhesion'
import { adhesionApi } from '@/features/adhesion/api/client'
import { AdhesionPage } from '@/features/adhesion/components/adhesion-page'

export const Route = createFileRoute('/adhesion/')({
  validateSearch: z.object({ invite: z.string().max(32).optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ invite: search.invite ?? null }),
  loader: ({ deps }) => loadAdhesionPage({ data: { invite: deps.invite } }),
  head: () => ({
    meta: [
      { title: 'Termo de opção — Simples Nacional 2027' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'theme-color', content: '#052C47' },
    ],
  }),
  // O roteador não pode recarregar a página por cima do que a pessoa está digitando.
  staleTime: Infinity,
  component: AdhesionRoute,
})

function AdhesionRoute() {
  return <AdhesionPage bootstrap={Route.useLoaderData()} api={adhesionApi} />
}
