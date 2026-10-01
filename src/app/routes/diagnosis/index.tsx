import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { diagnosisApi } from '@/features/diagnosis/api/client'
import { loadDraft } from '@/features/diagnosis/api/diagnosis'
import { DiagnosisPage } from '@/features/diagnosis/components/diagnosis-page'

export const Route = createFileRoute('/diagnosis/')({
  validateSearch: z.object({
    invite: z.string().max(32).optional().catch(undefined),
    resume: z.literal('1').optional().catch(undefined),
  }),
  loaderDeps: ({ search }) => ({ invite: search.invite }),
  loader: ({ deps }) => loadDraft({ data: { invite: deps.invite } }),
  head: () => ({
    meta: [
      { title: 'Diagnóstico — Simples padrão ou híbrido | auster' },
      {
        name: 'description',
        content:
          'Em 4 a 10 minutos, descubra se a sua empresa do Simples Nacional deve recolher IBS e CBS na guia única ou por fora do DAS. A opção é feita até 30 de setembro de 2026.',
      },
      { name: 'theme-color', content: '#052C47' },
    ],
  }),
  // The router must not reload the draft over what the person is typing.
  staleTime: Infinity,
  component: DiagnosisRoute,
})

function DiagnosisRoute() {
  const bootstrap = Route.useLoaderData()
  const { resume } = Route.useSearch()
  return <DiagnosisPage bootstrap={bootstrap} api={diagnosisApi} resume={resume === '1'} />
}
