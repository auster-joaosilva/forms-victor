import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/lib/query-client'
import type { ResponseDetail, ResponseList } from '../api/responses'

const { listResponsesFn, getResponseFn, handleResponseFn } = vi.hoisted(() => ({
  listResponsesFn: vi.fn(),
  getResponseFn: vi.fn(),
  handleResponseFn: vi.fn(),
}))
vi.mock('../api/responses', () => ({ listResponsesFn, getResponseFn, handleResponseFn }))

const { ResponsesPanel } = await import('./responses-panel')

const summary = {
  id: 7, protocol: 'DS-260915-AB12', companyName: 'Padaria Boa', cnpj: null, requester: 'Ana', email: null, position: null, outcome: null,
  certainty: null, urgency: null, confidence: null, receivedAt: '2026-09-15T12:00:00.000Z', formVersion: null, viaInvitation: false, status: 'new' as const,
}
const list: ResponseList = { counts: { total: 1, new: 1, in_review: 0, validated: 0, discarded: 0 }, items: [summary], total: 1, page: 1, pageCount: 1 }
const detail = (internalNote: string): ResponseDetail => ({
  ...summary, invitationToken: null, phone: null, updatedAt: null, requesterInQsa: null,
  engine: { outcome: '', position: '', certainty: '', urgency: '', confidence: '', gaps: [], triggers: [], openPoints: [] },
  answers: { blocks: [], outsideForm: [], total: 0 }, internalNote, handledBy: null, handledAt: null, changedAfterHandling: false,
})

const renderPanel = (client = createQueryClient()) =>
  render(
    <QueryClientProvider client={client}>
      <ResponsesPanel filter={{ page: 1 }} onFilterChange={() => undefined} />
    </QueryClientProvider>,
  )

describe('ResponsesPanel', () => {
  it('fetches the sheet again on every opening and seeds the note from the fresh copy', async () => {
    listResponsesFn.mockResolvedValue(list)
    let release: (value: ResponseDetail) => void = () => undefined
    getResponseFn.mockResolvedValueOnce(detail('nota antiga')).mockReturnValueOnce(new Promise((resolve) => (release = resolve)))
    render(
      <QueryClientProvider client={createQueryClient()}>
        <ResponsesPanel filter={{ page: 1 }} onFilterChange={() => undefined} />
      </QueryClientProvider>,
    )

    await userEvent.click(await screen.findByText('Padaria Boa'))
    expect(within(await screen.findByRole('dialog')).getByRole('textbox')).toHaveValue('nota antiga')
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await userEvent.click(screen.getByText('Padaria Boa'))
    expect(getResponseFn).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    release(detail('nota da colega'))
    expect(within(await screen.findByRole('dialog')).getByRole('textbox')).toHaveValue('nota da colega')
  })

  it('keeps the open sheet and the note being typed when the detail is fetched again', async () => {
    listResponsesFn.mockResolvedValue(list)
    getResponseFn.mockReset().mockResolvedValueOnce(detail('')).mockResolvedValueOnce(detail('do servidor'))
    const client = createQueryClient()
    render(
      <QueryClientProvider client={client}>
        <ResponsesPanel filter={{ page: 1 }} onFilterChange={() => undefined} />
      </QueryClientProvider>,
    )

    await userEvent.click(await screen.findByText('Padaria Boa'))
    const note = within(await screen.findByRole('dialog')).getByRole('textbox')
    await userEvent.type(note, 'digitando')
    await client.invalidateQueries({ queryKey: ['responses'] })
    window.dispatchEvent(new Event('focus'))

    await waitFor(() => expect(getResponseFn).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByRole('textbox')).toBe(note)
    expect(note).toHaveValue('digitando')
  })

  it('keeps the sheet open and shows the refusal when handling is refused', async () => {
    listResponsesFn.mockResolvedValue(list)
    getResponseFn.mockReset().mockResolvedValue(detail(''))
    handleResponseFn.mockReset().mockResolvedValue({ ok: false, message: 'Resposta não encontrada.' })
    renderPanel()
    await userEvent.click(await screen.findByText('Padaria Boa'))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Validada' }))
    expect(within(screen.getByRole('dialog')).getByText('Resposta não encontrada.')).toHaveClass('bo-error')
  })

  it('keeps the sheet open and shows the failure when the server cannot be reached', async () => {
    listResponsesFn.mockResolvedValue(list)
    getResponseFn.mockReset().mockResolvedValue(detail(''))
    handleResponseFn.mockReset().mockRejectedValue(new Error('Failed to fetch'))
    renderPanel()
    await userEvent.click(await screen.findByText('Padaria Boa'))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Só salvar a nota' }))
    expect(await within(screen.getByRole('dialog')).findByText('Não deu para falar com o servidor: Failed to fetch')).toHaveClass('bo-error')
  })

  it('says so when the sheet cannot be loaded or no longer exists', async () => {
    listResponsesFn.mockResolvedValue(list)
    getResponseFn.mockReset().mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValueOnce(null)
    renderPanel(new QueryClient({ defaultOptions: { queries: { retry: false } } }))
    await userEvent.click(await screen.findByText('Padaria Boa'))
    expect(await screen.findByText('Falha ao carregar: HTTP 500')).toHaveClass('bo-error')
    await userEvent.click(screen.getByText('Padaria Boa'))
    expect(await screen.findByText('Resposta não encontrada.')).toHaveClass('bo-error')
    expect(screen.queryByText('Falha ao carregar: HTTP 500')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
