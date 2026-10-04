import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/lib/query-client'

const { migrationStatusFn, simulateMigrationFn, importMigrationFn, resetTestDataFn } = vi.hoisted(() => ({
  migrationStatusFn: vi.fn(), simulateMigrationFn: vi.fn(), importMigrationFn: vi.fn(), resetTestDataFn: vi.fn(),
}))
vi.mock('../api/migration', () => ({ migrationStatusFn, simulateMigrationFn, importMigrationFn, resetTestDataFn }))

const { MigrationPanel } = await import('./migration-panel')

const status = { available: true, path: '/legacy/portal.db', resetAllowed: false }
const report = (dryRun: boolean, conflicts: string[] = []) => ({
  dryRun,
  users: { found: 6, imported: 5, skipped: 1 },
  invitations: { found: 1, imported: 1, skipped: 0 },
  responses: { found: 4, imported: 4, skipped: 0 },
  adhesions: { found: 3, imported: 3, skipped: 0 },
  events: { found: 0, imported: 0, skipped: 0 },
  sessions: { found: 0, imported: 0, skipped: 0 },
  registrations: { found: 0, imported: 0, skipped: 0 },
  images: { found: 2, imported: 1, skipped: 1 },
  audit: { found: 4, imported: 4, skipped: 0 },
  conflicts,
  notes: ['usuário chico: papel chefe sem equivalente; entra como operador'],
})

const renderPanel = () =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MigrationPanel />
    </QueryClientProvider>,
  )

afterEach(() => vi.restoreAllMocks())

describe('MigrationPanel', () => {
  it('shows the report of a clean simulation and only then lets the import run, after confirming', async () => {
    migrationStatusFn.mockResolvedValue(status)
    simulateMigrationFn.mockResolvedValue({ ok: true, report: report(true) })
    importMigrationFn.mockResolvedValue({ ok: true, report: report(false) })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPanel()
    expect(await screen.findByText('/legacy/portal.db')).toBeInTheDocument()
    expect(screen.getByText('disponível')).toBeInTheDocument()
    const importButton = screen.getByRole('button', { name: 'Importar' })
    expect(importButton).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))
    expect(await screen.findByText('Simulação: nada foi gravado. Confira as contagens e os avisos antes de importar.')).toBeInTheDocument()
    const users = within(screen.getByRole('row', { name: /Usuários/ }))
    expect(users.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Usuários', '6', '5', '1'])
    const images = within(screen.getByRole('row', { name: /Imagens/ }))
    expect(images.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Imagens', '2', '1', '1'])
    expect(screen.getAllByRole('row').map((row) => row.firstElementChild?.textContent).slice(1)).toEqual([
      'Usuários', 'Convites', 'Respostas', 'Adesões', 'Eventos', 'Encontros', 'Inscrições', 'Imagens', 'Auditoria',
    ])
    expect(screen.getByText('usuário chico: papel chefe sem equivalente; entra como operador')).toBeInTheDocument()
    expect(importButton).toBeEnabled()

    await userEvent.click(importButton)
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/^Importar do portal antigo\?/))
    expect(importMigrationFn).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Importação gravada. Rode de novo: tudo deve vir como pulado.')).toBeInTheDocument()
  })

  it('keeps the import closed while the simulation has a conflict', async () => {
    migrationStatusFn.mockResolvedValue(status)
    simulateMigrationFn.mockResolvedValue({ ok: true, report: report(true, ['resposta 1: o id já existe no banco novo com o protocolo DS-X']) })
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Simular' }))
    expect(await screen.findByText('resposta 1: o id já existe no banco novo com o protocolo DS-X')).toBeInTheDocument()
    expect(screen.getByText('Nada foi gravado: há conflitos. Resolva-os e simule de novo.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled()
  })

  it('does not import when the confirmation is declined', async () => {
    migrationStatusFn.mockResolvedValue(status)
    simulateMigrationFn.mockResolvedValue({ ok: true, report: report(true) })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Simular' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Importar' }))
    expect(importMigrationFn).not.toHaveBeenCalled()
  })

  it('cannot simulate without the database', async () => {
    migrationStatusFn.mockResolvedValue({ ...status, available: false })
    renderPanel()
    expect(await screen.findByText('não encontrado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular' })).toBeDisabled()
  })

  it('shows why the database does not open instead of saying it is missing', async () => {
    const reason = 'o portal antigo precisa estar no ar (o SQLite cria o portal.db-shm); suba o container antigo e recarregue'
    migrationStatusFn.mockResolvedValue({ ...status, available: false, reason })
    renderPanel()
    expect(await screen.findByText(reason)).toBeInTheDocument()
    expect(screen.queryByText('não encontrado')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simular' })).toBeDisabled()
  })

  it('tells a failure of the server apart from a failure to reach it', async () => {
    migrationStatusFn.mockResolvedValue(status)
    simulateMigrationFn.mockRejectedValueOnce(new Error('database is locked')).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Simular' }))
    expect(await screen.findByText('A operação falhou: database is locked')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))
    expect(await screen.findByText('Não deu para falar com o servidor: Failed to fetch')).toBeInTheDocument()
  })

  it('shows the message when the server refuses', async () => {
    migrationStatusFn.mockResolvedValue(status)
    simulateMigrationFn.mockResolvedValue({ ok: false, message: 'já há uma operação de migração em andamento; espere ela terminar' })
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Simular' }))
    expect(await screen.findByText('já há uma operação de migração em andamento; espere ela terminar')).toBeInTheDocument()
  })

  it('hides the reset of the test data unless the environment allows it', async () => {
    migrationStatusFn.mockResolvedValue(status)
    renderPanel()
    await screen.findByText('/legacy/portal.db')
    expect(screen.queryByText('Apagar dados de teste do hml')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Apagar dados de teste' })).not.toBeInTheDocument()
  })

  it('erases the test data only after APAGAR is typed, and asks for a new simulation', async () => {
    migrationStatusFn.mockResolvedValue({ ...status, resetAllowed: true })
    simulateMigrationFn.mockResolvedValue({ ok: true, report: report(true) })
    resetTestDataFn.mockResolvedValue({ ok: true, erased: { drafts: 2, registrations: 1, sessions: 5, events: 6, adhesions: 3, responses: 4 } })
    renderPanel()
    expect(await screen.findByText('Apagar dados de teste do hml')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Simular' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Importar' })).toBeEnabled())

    const erase = screen.getByRole('button', { name: 'Apagar dados de teste' })
    expect(erase).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'Confirmação' }), 'apagar')
    expect(erase).toBeDisabled()
    await userEvent.clear(screen.getByRole('textbox', { name: 'Confirmação' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Confirmação' }), 'APAGAR')
    await userEvent.click(erase)
    expect(resetTestDataFn).toHaveBeenCalledWith({ data: { confirmation: 'APAGAR' } })
    expect(await screen.findByText('Apagados: 2 rascunhos, 1 inscrições, 5 encontros, 6 eventos, 3 adesões e 4 respostas. Simule de novo antes de importar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Confirmação' })).toHaveValue('')
  })
})
