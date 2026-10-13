import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImportEmailsForm } from './import-emails-form'

const textarea = () => screen.getByPlaceholderText(/usuario;email/)

describe('ImportEmailsForm', () => {
  it('hands the pasted text over and clears it once the batch is written', async () => {
    const onImport = vi.fn().mockResolvedValue(true)
    render(<ImportEmailsForm pending={false} result={null} failure={null} onImport={onImport} />)
    await userEvent.type(textarea(), 'bia;bia@austercontabil.com.br')
    await userEvent.click(screen.getByRole('button', { name: 'Importar e-mails' }))
    expect(onImport).toHaveBeenCalledWith('bia;bia@austercontabil.com.br')
    await waitFor(() => expect(textarea()).toHaveValue(''))
  })

  it('keeps the pasted text when the batch is refused', async () => {
    const onImport = vi.fn().mockResolvedValue(false)
    render(<ImportEmailsForm pending={false} result={null} failure={null} onImport={onImport} />)
    await userEvent.type(textarea(), 'ninguem;x@a.com.br')
    await userEvent.click(screen.getByRole('button', { name: 'Importar e-mails' }))
    await waitFor(() => expect(onImport).toHaveBeenCalled())
    expect(textarea()).toHaveValue('ninguem;x@a.com.br')
  })

  it('reports how many were applied', () => {
    render(<ImportEmailsForm pending={false} result={{ ok: true, appliedUsernames: ['bia', 'caio'] }} failure={null} onImport={vi.fn()} />)
    expect(screen.getByText('2 e-mail(s) atualizado(s): bia, caio')).toBeInTheDocument()
  })

  it('lists every rejected line, and a general refusal without a line number', () => {
    const result = { ok: false as const, errors: [{ line: 0, reason: 'um dos e-mails já pertence a outro usuário' }, { line: 2, reason: 'usuário não encontrado' }] }
    render(<ImportEmailsForm pending={false} result={result} failure={null} onImport={vi.fn()} />)
    expect(screen.getByText('um dos e-mails já pertence a outro usuário')).toBeInTheDocument()
    expect(screen.getByText('Linha 2: usuário não encontrado')).toBeInTheDocument()
  })

  it('shows a failure to reach the server', () => {
    render(<ImportEmailsForm pending={false} result={null} failure="Importar e-mails: não deu para falar com o servidor (rede caiu)" onImport={vi.fn()} />)
    expect(screen.getByText('Importar e-mails: não deu para falar com o servidor (rede caiu)')).toBeInTheDocument()
  })

  it('disables the button while the import is in flight', async () => {
    render(<ImportEmailsForm pending result={null} failure={null} onImport={vi.fn()} />)
    await userEvent.type(textarea(), 'bia;bia@austercontabil.com.br')
    expect(screen.getByRole('button', { name: 'Importar e-mails' })).toBeDisabled()
  })
})
