import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/lib/query-client'
import type { EventDetail } from '../api/events'

const { getEventFn, updateEventFn } = vi.hoisted(() => ({ getEventFn: vi.fn(), updateEventFn: vi.fn() }))
vi.mock('../api/events', () => ({ getEventFn, updateEventFn, listEventsFn: vi.fn(), createEventFn: vi.fn(), eventGalleryFn: vi.fn().mockResolvedValue([]) }))

const { EventsPanel } = await import('./events-panel')

const detail = (status: 'draft' | 'published', title = 'Conexão Tributária'): EventDetail => ({
  event: { id: 9, slug: 'conexao-tributaria', title, status, registrations: 'open', content: {}, sessions: [] },
  counts: { total: 0, registered: 0, confirmed: 0, present: 0, absent: 0, cancelled: 0 },
  registrations: [],
})

const renderPanel = () =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <EventsPanel eventId={9} onOpen={vi.fn()} canManage canExport={false} canHandle />
    </QueryClientProvider>,
  )

describe('EventsPanel', () => {
  beforeEach(() => {
    getEventFn.mockReset()
    updateEventFn.mockReset()
  })

  it('keeps unsaved fields when a status button is used, and re-syncs only after Save', async () => {
    getEventFn.mockResolvedValueOnce(detail('draft')).mockResolvedValue(detail('published'))
    updateEventFn.mockResolvedValue({ ok: true })
    renderPanel()
    const title = await screen.findByLabelText('Título')
    await userEvent.clear(title)
    await userEvent.type(title, 'Título ainda não salvo')
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    expect(await screen.findByRole('button', { name: 'Voltar a rascunho' })).toBeInTheDocument()
    expect(screen.getByLabelText('Título')).toHaveValue('Título ainda não salvo')

    getEventFn.mockResolvedValue(detail('published', 'Título do servidor'))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(screen.getByLabelText('Título')).toHaveValue('Título do servidor'))
  })
})
