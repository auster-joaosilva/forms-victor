import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { createEventFn } from '../api/events'
import { eventQuery, eventsQuery, galleryQuery } from '../api/queries'
import { EventEditor } from './event-editor'
import { EventsList } from './events-list'

type Props = { eventId: number | undefined; onOpen(id: number | undefined): void; canManage: boolean; canExport: boolean; canHandle: boolean }

export function EventsPanel({ eventId, onOpen, canManage, canExport }: Props) {
  const queryClient = useQueryClient()
  const list = useQuery({ ...eventsQuery(), enabled: eventId === undefined })
  const detail = useQuery({ ...eventQuery(eventId ?? 0), enabled: eventId !== undefined })
  const gallery = useQuery({ ...galleryQuery(), enabled: eventId !== undefined && canManage })
  const [error, setError] = useState<string | null>(null)
  const create = useMutation({
    mutationFn: (title: string) => createEventFn({ data: { title } }),
    onSuccess: async (result) => {
      if (!result.ok) return setError(`Não foi possível criar: ${result.error}`)
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['events'] })
      onOpen(result.id)
    },
    onError: (failure) => setError(`Não foi possível criar: ${failure.message}`),
  })
  // The form only re-syncs with the server after the user's own Save; a status change refreshes the buttons and leaves the typed fields alone.
  const [synced, setSynced] = useState(0)
  const refresh = async (saved: boolean) => {
    await queryClient.invalidateQueries({ queryKey: ['events'] })
    if (saved) setSynced((count) => count + 1)
  }

  if (eventId === undefined) {
    if (list.isPending) return <>carregando…</>
    if (list.isError) return <div className="bo-empty">{`Falha ao carregar: ${list.error.message}`}</div>
    return <EventsList events={list.data} canManage={canManage} creating={create.isPending} error={error} onOpen={onOpen} onCreate={(title) => create.mutate(title)} />
  }
  if (detail.isPending) return <>carregando…</>
  if (detail.isError) return <div className="bo-empty">{`Falha ao carregar: ${detail.error.message}`}</div>
  if (!detail.data) return <div className="bo-empty">Evento não encontrado.</div>
  return (
    <EventEditor
      key={`${detail.data.event.id}:${synced}`}
      detail={detail.data}
      gallery={gallery.data ?? []}
      canManage={canManage}
      canExport={canExport}
      onBack={() => onOpen(undefined)}
      onChanged={(saved) => void refresh(saved)}
    />
  )
}
