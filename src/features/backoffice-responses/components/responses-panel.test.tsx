import { QueryClientProvider } from '@tanstack/react-query'
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
})
