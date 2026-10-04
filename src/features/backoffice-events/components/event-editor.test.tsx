import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/lib/query-client'
import type { EventDetail } from '../api/events'

const { updateEventFn } = vi.hoisted(() => ({ updateEventFn: vi.fn() }))
vi.mock('../api/events', () => ({ updateEventFn }))

const { EventEditor } = await import('./event-editor')

const detail = (over: Partial<EventDetail['event']> = {}): EventDetail => ({
  event: {
    id: 9, slug: 'conexao-tributaria', title: 'Conexão Tributária', status: 'draft', registrations: 'open',
    content: { chamada: 'O que muda', destaques: [{ titulo: 'Prazo', texto: 'até 30/10' }], temas: ['CBS', 'IBS'], avisos: [], tema: undefined },
    sessions: [{ id: 1, order: 0, date: '2026-11-12', time: '19:30', format: 'in_person', title: 'Encontro 1', description: 'Abertura', location: null, seats: 2, taken: 1 }],
    ...over,
  },
  counts: { total: 1, registered: 1, confirmed: 0, present: 0, absent: 0, cancelled: 0 },
  registrations: [],
})

const renderEditor = (value = detail(), canExport = true, canManage = true) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <EventEditor detail={value} gallery={[]} canManage={canManage} canExport={canExport} onBack={vi.fn()} onChanged={vi.fn()} />
    </QueryClientProvider>,
  )

describe('EventEditor', () => {
  beforeEach(() => {
    updateEventFn.mockReset()
  })

  it('shows the counts, the publish actions and, with export_registrations, the CSV link', () => {
    renderEditor()
    expect(screen.getByText('Inscritos').closest('.bo-count')).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Encerrar inscrições' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marcar como encerrado' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Baixar inscritos (CSV)' })).toHaveAttribute('href', '/backoffice/events/9/registrations.csv')
    expect(screen.getByRole('link', { name: 'Ver a página' })).toHaveAttribute('href', '/events/conexao-tributaria')
    expect(screen.getByLabelText('Fundo da capa')).toHaveValue('marca')
  })

  it('hides the CSV link without export_registrations and offers "Voltar a rascunho" once published', () => {
    renderEditor(detail({ status: 'published', registrations: 'closed' }), false)
    expect(screen.queryByRole('link', { name: 'Baixar inscritos (CSV)' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar a rascunho' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reabrir inscrições' })).toBeInTheDocument()
    expect(screen.getByText('este evento já está publicado: trocar o endereço quebra todo link já enviado')).toBeInTheDocument()
  })

  it('checks the address while typing with the house messages', async () => {
    renderEditor()
    const address = screen.getByLabelText('Endereço da página')
    await userEvent.clear(address)
    expect(screen.getByText('o endereço não pode ficar em branco')).toBeInTheDocument()
    await userEvent.type(address, 'Café')
    expect(screen.getByText('só letras sem acento, números e hífen entre palavras')).toBeInTheDocument()
    await userEvent.clear(address)
    await userEvent.type(address, 'ab')
    expect(screen.getByText('de 3 a 50 caracteres')).toBeInTheDocument()
    await userEvent.type(address, 'c')
    expect(screen.getByText('a página vai ficar em /events/abc')).toBeInTheDocument()
  })

  it('saves title, address, content parsed one per line and the sessions with their description', async () => {
    updateEventFn.mockResolvedValue({ ok: true })
    renderEditor()
    await userEvent.clear(screen.getByLabelText(/^Temas abordados/))
    await userEvent.type(screen.getByLabelText(/^Temas abordados/), 'CBS{enter}{enter}Split payment')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(updateEventFn).toHaveBeenCalled())
    const sent = updateEventFn.mock.calls[0]?.[0].data
    expect(sent).toMatchObject({ id: 9, title: 'Conexão Tributária', slug: 'conexao-tributaria' })
    expect(sent.content).toMatchObject({ chamada: 'O que muda', destaques: [{ titulo: 'Prazo', texto: 'até 30/10' }], temas: ['CBS', 'Split payment'], tema: 'marca' })
    expect(sent.sessions).toEqual([{ id: 1, date: '2026-11-12', time: '19:30', format: 'in_person', title: 'Encontro 1', description: 'Abertura', location: null, seats: 2 }])
    expect(await screen.findByText('salvo')).toBeInTheDocument()
  })

  it('shows the refusal with the house wording', async () => {
    updateEventFn.mockResolvedValue({ ok: false, error: 'já existe um evento em /events/outro' })
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Não foi possível salvar: já existe um evento em /events/outro')).toBeInTheDocument()
  })

  it('changes status straight from the action buttons', async () => {
    updateEventFn.mockResolvedValue({ ok: true })
    renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(updateEventFn).toHaveBeenCalledWith({ data: { id: 9, status: 'published' } }))
  })
})
