import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/lib/query-client'
import type { AdhesionList, AdhesionSummary } from '../api/adhesions'
import type { AdhesionsFilter } from '../api/queries'

const { listAdhesionsFn, handleAdhesionFn } = vi.hoisted(() => ({ listAdhesionsFn: vi.fn(), handleAdhesionFn: vi.fn() }))
vi.mock('../api/adhesions', () => ({ listAdhesionsFn, handleAdhesionFn }))

const { AdhesionsPanel, CANCEL_CONFIRMATION } = await import('./adhesions-panel')

const row = (over: Partial<AdhesionSummary> = {}): AdhesionSummary => ({
  id: 1, protocol: 'ADS-20260925-AAAAA', acceptedAt: '2026-09-25T13:00:00.000Z', companyName: 'Padaria Boa', cnpj: '11.222.333/0001-81',
  representative: 'Ana', role: 'Sócio', email: 'ana@padaria.com', modalidade: 'hibrido', semManifestacao: 'cancelar', querProposta: true,
  status: 'received', handledBy: null, handledAt: null, ...over,
})
const list = (items: AdhesionSummary[], toFile = 2, state: 'open' | 'closed' = 'open'): AdhesionList => ({
  counts: { total: 3, standard: 1, hybrid: 2, received: 2, filed: 1, cancelled: 0, toFile },
  items, total: items.length, page: 1, pageCount: 1, window: { state, end: '2026-10-30' },
})

const renderPanel = (canExport = true, filter: AdhesionsFilter = { page: 1 }) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <AdhesionsPanel filter={filter} onFilterChange={() => undefined} canExport={canExport} />
    </QueryClientProvider>,
  )

describe('AdhesionsPanel', () => {
  beforeEach(() => {
    listAdhesionsFn.mockReset()
    handleAdhesionFn.mockReset()
  })

  it('shows the five counters and the deadline warning while the window is open', async () => {
    listAdhesionsFn.mockResolvedValue(list([row()]))
    renderPanel()
    await screen.findByText('Padaria Boa')
    const expected: [string, string][] = [['Total', '3'], ['Híbrido', '2'], ['Padrão', '1'], ['A protocolar', '2'], ['Protocoladas', '1']]
    for (const [label, value] of expected) {
      expect(within(screen.getByText(label).closest('.bo-count') as HTMLElement).getByText(value)).toBeInTheDocument()
    }
    expect(document.querySelector('.bo-deadline')).toHaveTextContent(
      '2 empresas autorizaram a opção pelo Híbrido e ainda não foram feitas no Portal do Simples Nacional. O prazo é 30/10/2026.',
    )
  })

  it('says the deadline is over, in the singular, once the window closes', async () => {
    listAdhesionsFn.mockResolvedValue(list([row()], 1, 'closed'))
    renderPanel()
    await screen.findByText('Padaria Boa')
    expect(document.querySelector('.bo-deadline')).toHaveTextContent(
      '1 empresa autorizou a opção pelo Híbrido e ainda não foi feita no Portal do Simples Nacional. O prazo terminou em 30/10/2026. Estas não podem mais ser protocoladas: trate uma a uma e registre o que foi combinado com cada empresa.',
    )
  })

  it('offers Protocolei only on a received hybrid, Cancelar while not cancelled, and shows who handled it', async () => {
    listAdhesionsFn.mockResolvedValue(list([
      row(),
      row({ id: 2, protocol: 'ADS-20260925-BBBBB', companyName: 'Oficina', modalidade: 'padrao', semManifestacao: null, querProposta: false }),
      row({ id: 3, protocol: 'ADS-20260925-CCCCC', companyName: 'Loja', status: 'cancelled', handledBy: 'maria', handledAt: '2026-09-26T12:00:00.000Z' }),
    ], 0))
    renderPanel()
    const hybrid = (await screen.findByText('Padaria Boa')).closest('tr') as HTMLElement
    const standard = screen.getByText('Oficina').closest('tr') as HTMLElement
    const cancelled = screen.getByText('Loja').closest('tr') as HTMLElement
    expect(within(hybrid).getByRole('button', { name: 'Protocolei' })).toBeInTheDocument()
    expect(within(hybrid).getByText('cancela em 20/11')).toBeInTheDocument()
    expect(within(hybrid).getByText('quer proposta')).toBeInTheDocument()
    expect(within(standard).queryByRole('button', { name: 'Protocolei' })).toBeNull()
    expect(within(standard).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(within(cancelled).queryByRole('button')).toBeNull()
    expect(within(cancelled).getByText(/^tratado por maria em \d{2}\/\d{2}\/\d{4}/)).toBeInTheDocument()
    expect(within(cancelled).getByRole('link', { name: 'Termo (PDF)' })).toHaveAttribute('href', '/backoffice/adhesions/3/term')
    expect(document.querySelector('.bo-deadline')).toBeNull()
  })

  it('hides the spreadsheet without export_adhesions and keeps the screen filter in its link', async () => {
    listAdhesionsFn.mockResolvedValue(list([row()]))
    const { unmount } = renderPanel(false)
    await screen.findByText('Padaria Boa')
    expect(screen.queryByRole('link', { name: 'Baixar planilha (CSV)' })).toBeNull()
    unmount()
    renderPanel(true, { page: 1, status: 'received', modality: 'hibrido', q: 'padaria' })
    expect(await screen.findByRole('link', { name: 'Baixar planilha (CSV)' })).toHaveAttribute(
      'href', '/backoffice/adhesions.csv?status=received&modality=hibrido&q=padaria',
    )
  })

  it('asks before cancelling and sends the new status', async () => {
    listAdhesionsFn.mockResolvedValue(list([row()]))
    handleAdhesionFn.mockResolvedValue({ ok: true })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderPanel()
    const cancel = await screen.findByRole('button', { name: 'Cancelar' })
    await userEvent.click(cancel)
    expect(confirm).toHaveBeenCalledWith(CANCEL_CONFIRMATION)
    expect(handleAdhesionFn).not.toHaveBeenCalled()
    await userEvent.click(cancel)
    await waitFor(() => expect(handleAdhesionFn).toHaveBeenCalledWith({ data: { id: 1, status: 'cancelled' } }))
    expect(CANCEL_CONFIRMATION).toBe('Cancelar esta adesão? Use quando o cliente desistiu ou o termo saiu errado.')
  })

  it('shows the refusal with the legacy wording', async () => {
    listAdhesionsFn.mockResolvedValue(list([row()]))
    handleAdhesionFn.mockResolvedValue({ ok: false, error: 'só a opção pelo híbrido é protocolada' })
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Protocolei' }))
    expect(await screen.findByText('Não consegui mudar a situação: só a opção pelo híbrido é protocolada. Tente de novo.')).toBeInTheDocument()
  })

  it('says so when nothing matches the filter', async () => {
    listAdhesionsFn.mockResolvedValue(list([], 0))
    renderPanel()
    expect(await screen.findByText('Nenhuma adesão com esse filtro. Limpe a busca ou escolha outra modalidade.')).toBeInTheDocument()
    expect(screen.getByText(/Confirmar aqui não protocola nada/)).toHaveTextContent(
      'Confirmar aqui não protocola nada: a opção continua sendo feita à mão no Portal do Simples Nacional, empresa por empresa. Esta tela serve para ninguém ficar de fora e para registrar quem fez.',
    )
  })
})
