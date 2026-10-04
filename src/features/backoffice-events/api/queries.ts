import { queryOptions } from '@tanstack/react-query'
import { eventGalleryFn, getEventFn, listEventsFn } from './events'

export const eventsQuery = () => queryOptions({ queryKey: ['events'], queryFn: () => listEventsFn() })

export const eventQuery = (id: number) =>
  queryOptions({ queryKey: ['events', 'detail', id], queryFn: () => getEventFn({ data: { id } }), staleTime: 0, refetchOnWindowFocus: false })

export const galleryQuery = () => queryOptions({ queryKey: ['events', 'gallery'], queryFn: () => eventGalleryFn() })
