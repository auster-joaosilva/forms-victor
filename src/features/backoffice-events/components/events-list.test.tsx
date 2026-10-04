import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EventSummary } from '@/server/events/domain/event'
import { EventsList } from './events-list'

const summary = (over: Partial<EventSummary> = {}): EventSummary => ({
  id: 1, slug: 'conexao-tributaria', title: 'Conexão Tributária', status: 'published', registrations: 'open',
  firstDate: '2026-11-12', sessionCount: 2, registered: 7, chamada: null, ...over,
})

describe('EventsList', () => {
  it('lists the events with the address, first date, status and registered count, and opens one on click', async () => {
    const onOpen = vi.fn()
    render(<EventsList events={[summary(), summary({ id: 2, slug: 'rascunho', title: 'Rascunho', status: 'draft', registrations: 'closed', firstDate: null, registered: 0 })]}
      canManage onOpen={onOpen} onCreate={vi.fn()} creating={false} error={null} />)
    expect(screen.getByRole('heading', { name: 'Agenda de eventos' })).toBeInTheDocument()
    expect(screen.getByText('/events/conexao-tributaria')).toBeInTheDocument()
    expect(screen.getByText('12/11/2026')).toBeInTheDocument()
    expect(screen.getByText('Publicado')).toBeInTheDocument()
    expect(screen.getByText('Rascunho', { selector: '.bo-badge' })).toBeInTheDocument()
    expect(screen.getByText('inscrições encerradas')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Conexão Tributária' }))
    expect(onOpen).toHaveBeenCalledOnce()
    expect(onOpen).toHaveBeenCalledWith(1)
    await userEvent.click(screen.getByText('12/11/2026'))
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('creates an event from the inline title, without prompt()', async () => {
    const onCreate = vi.fn()
    render(<EventsList events={[]} canManage onOpen={vi.fn()} onCreate={onCreate} creating={false} error={null} />)
    expect(screen.getByText('Nenhum evento ainda. Use “Novo evento” para criar o primeiro.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Título do evento (dá para mudar depois)'), '  Café com a Reforma  ')
    await userEvent.click(screen.getByRole('button', { name: 'Novo evento' }))
    expect(onCreate).toHaveBeenCalledWith('Café com a Reforma')
  })

  it('does not offer "Novo evento" without manage_events and shows the creation error', () => {
    render(<EventsList events={[]} canManage={false} onOpen={vi.fn()} onCreate={vi.fn()} creating={false} error="Não foi possível criar: o evento precisa de um título" />)
    expect(screen.queryByRole('button', { name: 'Novo evento' })).not.toBeInTheDocument()
    expect(screen.getByText('Não foi possível criar: o evento precisa de um título')).toBeInTheDocument()
  })
})
