import { createFileRoute, notFound } from '@tanstack/react-router'
import { eventsApi } from '@/features/events/api/client'
import { loadEventPage } from '@/features/events/api/events'
import { eventMeta } from '@/features/events/components/event-meta'
import { EventPage } from '@/features/events/components/event-page'

export const Route = createFileRoute('/events/$slug')({
  loader: async ({ params }) => {
    const page = await loadEventPage({ data: { slug: params.slug } })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData }) => ({ meta: loaderData ? eventMeta(loaderData.event, loaderData.publicUrl) : [{ title: 'Evento não encontrado.' }] }),
  // O formulário de inscrição não pode ser recarregado por cima do que a pessoa digita.
  staleTime: Infinity,
  notFoundComponent: EventNotFound,
  component: EventRoute,
})

function EventRoute() {
  return <EventPage bootstrap={Route.useLoaderData()} api={eventsApi} />
}

function EventNotFound() {
  return (
    <div className="pub">
      <main id="corpo">
        <div className="cartao">Evento não encontrado.</div>
      </main>
    </div>
  )
}
