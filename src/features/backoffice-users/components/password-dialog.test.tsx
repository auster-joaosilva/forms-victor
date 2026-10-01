import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PasswordDialog } from './password-dialog'

describe('PasswordDialog', () => {
  it('refuses short and mismatching passwords and returns a good one', async () => {
    const onSubmit = vi.fn()
    render(<PasswordDialog open title="Senha de ana" onSubmit={onSubmit} onCancel={vi.fn()} />)
    expect(screen.getByText(/No mínimo 12 caracteres\. Comprimento é o que protege/)).toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Senha'), 'curta')
    await userEvent.type(screen.getByPlaceholderText('Repita a senha'), 'curta')
    await userEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(screen.getByText('Curta demais.')).toBeInTheDocument()
    await userEvent.clear(screen.getByPlaceholderText('Senha'))
    await userEvent.type(screen.getByPlaceholderText('Senha'), 'senha-bem-longa-1')
    await userEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(screen.getByText('As duas não conferem.')).toBeInTheDocument()
    await userEvent.clear(screen.getByPlaceholderText('Repita a senha'))
    await userEvent.type(screen.getByPlaceholderText('Repita a senha'), 'senha-bem-longa-1')
    await userEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect(onSubmit).toHaveBeenCalledWith('senha-bem-longa-1')
  })

  it('empties the fields when it closes', async () => {
    const props = { title: 'Senha de ana', onSubmit: vi.fn(), onCancel: vi.fn() }
    const { rerender } = render(<PasswordDialog open {...props} />)
    await userEvent.type(screen.getByPlaceholderText('Senha'), 'rascunho')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(props.onCancel).toHaveBeenCalled()
    rerender(<PasswordDialog open={false} {...props} />)
    rerender(<PasswordDialog open {...props} />)
    expect(screen.getByPlaceholderText('Senha')).toHaveValue('')
  })
})
