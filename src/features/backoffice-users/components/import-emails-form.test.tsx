import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const { importUserEmailsFn } = vi.hoisted(() => ({ importUserEmailsFn: vi.fn() }))
vi.mock('../api/users', () => ({ importUserEmailsFn }))

const { ImportEmailsForm } = await import('./import-emails-form')

describe('ImportEmailsForm', () => {
  it('sends the pasted text and reports how many were applied', async () => {
    importUserEmailsFn.mockResolvedValue({ ok: true, appliedUsernames: ['bia', 'caio'] })
    render(<ImportEmailsForm />)
    await userEvent.type(screen.getByPlaceholderText(/usuario;email/), 'bia;bia@austercontabil.com.br')
    await userEvent.click(screen.getByRole('button', { name: 'Importar e-mails' }))
    await waitFor(() => expect(importUserEmailsFn).toHaveBeenCalledWith({ data: { text: 'bia;bia@austercontabil.com.br' } }))
    expect(await screen.findByText('2 e-mail(s) atualizado(s): bia, caio')).toBeInTheDocument()
  })

  it('lists every rejected line without applying anything', async () => {
    importUserEmailsFn.mockResolvedValue({ ok: false, errors: [{ line: 2, reason: 'usuário não encontrado' }] })
    render(<ImportEmailsForm />)
    await userEvent.type(screen.getByPlaceholderText(/usuario;email/), 'bia;bia@austercontabil.com.br\nninguem;x@a.com.br')
    await userEvent.click(screen.getByRole('button', { name: 'Importar e-mails' }))
    expect(await screen.findByText('Linha 2: usuário não encontrado')).toBeInTheDocument()
  })
})
