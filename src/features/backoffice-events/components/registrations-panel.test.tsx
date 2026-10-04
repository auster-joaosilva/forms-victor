import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/lib/query-client'
import type { RegistrationRow } from '../api/events'

const { handleRegistrationFn } = vi.hoisted(() => ({ handleRegistrationFn: vi.fn() }))
vi.mock('../api/events', () => ({ handleRegistrationFn }))

const { RegistrationsPanel } = await import('./registrations-panel')

const row = (over: Partial<RegistrationRow> = {}): RegistrationRow => ({
  id: 5, protocol: 'INS-20261012-AAAAA', createdAt: new Date('2026-10-12T12:00:00Z'), name: 'Ana Souza', email: 'ana@padaria.com',
  phone: '(34) 99999-9999', company: 'Padaria Boa', cnpj: '11.222.333/0001-81', jobTitle: 'Sócia', responseId: 3, sessionId: 1,
  sessionDate: '2026-11-12', sessionTime: '19:30', sessionTitle: 'Encontro 1', sessionFormat: 'online', status: 'registered', ...over,
})

const renderPanel = (rows: RegistrationRow[], canHandle = true) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RegistrationsPanel eventId={9} registrations={rows} canHandle={canHandle} />
    </QueryClientProvider>,
  )

describe('RegistrationsPanel', () => {
  beforeEach(() => handleRegistrationFn.mockReset())

  it('lists who, company, session and status, and marks presence', async () => {
    handleRegistrationFn.mockResolvedValue({ ok: true })
    renderPanel([row()])
    const line = screen.getByText('Ana Souza').closest('tr') as HTMLElement
    expect(line).toHaveTextContent('ana@padaria.com · (34) 99999-9999')
    expect(line).toHaveTextContent('11.222.333/0001-81 · fez o diagnóstico')
    expect(line).toHaveTextContent('12/11/2026 19:30')
    expect(within(line).getByText('Inscrita')).toBeInTheDocument()
    await userEvent.click(within(line).getByRole('button', { name: 'Presente' }))
    await waitFor(() => expect(handleRegistrationFn).toHaveBeenCalledWith({ data: { id: 5, status: 'present' } }))
  })

  it('has no action buttons without handle_registrations and shows the empty state', () => {
    renderPanel([row()], false)
    expect(screen.queryByRole('button', { name: 'Presente' })).not.toBeInTheDocument()
    renderPanel([])
    expect(screen.getByText('Ninguém inscrito ainda. O link é o que está no topo desta tela.')).toBeInTheDocument()
  })

  it('shows the refusal', async () => {
    handleRegistrationFn.mockResolvedValue({ ok: false, error: 'inscrição não encontrada' })
    renderPanel([row()])
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText('Não foi possível mudar: inscrição não encontrada')).toBeInTheDocument()
  })
})
