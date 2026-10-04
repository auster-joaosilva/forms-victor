import { createFileRoute } from '@tanstack/react-router'
import { loadHome } from '@/features/home/api/home'
import { HomePage } from '@/features/home/components/home-page'
import { homeMeta } from '@/features/home/components/home-meta'

// /?c=TOKEN não chega aqui: o middleware de redirecionamentos (legacy-redirects) manda para /diagnosis?invite= antes.
export const Route = createFileRoute('/')({
  loader: () => loadHome(),
  head: ({ loaderData }) => ({ meta: homeMeta(loaderData?.publicUrl ?? '') }),
  component: HomeRoute,
})

function HomeRoute() {
  return <HomePage bootstrap={Route.useLoaderData()} />
}
