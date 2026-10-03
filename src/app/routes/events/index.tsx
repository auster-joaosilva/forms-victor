import { createFileRoute } from '@tanstack/react-router'
import { loadEventsList } from '@/features/events/api/events'
import { listMeta } from '@/features/events/components/event-meta'
import { EventsList } from '@/features/events/components/events-list'

export const Route = createFileRoute('/events/')({
  loader: () => loadEventsList(),
  head: ({ loaderData }) => ({ meta: listMeta(loaderData?.publicUrl ?? '') }),
  component: EventsListRoute,
})

function EventsListRoute() {
  return <EventsList events={Route.useLoaderData().events} />
}
