import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const { completePasswordResetFn, navigate } = vi.hoisted(() => ({ completePasswordResetFn: vi.fn(), navigate: vi.fn() }))
vi.mock('../api/password-reset', () => ({ completePasswordResetFn }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
}))

const { ResetPasswordForm } = await import('./reset-password-form')

const fillAndSubmit = async (password: string) => {
  await userEvent.type(screen.getByPlaceholderText('Nova senha'), password)
  await userEvent.type(screen.getByPlaceholderText('Repita a nova senha'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Definir nova senha' }))
}

describe('ResetPasswordForm', () => {
  it('sets the new password and redirects to login', async () => {
    completePasswordResetFn.mockResolvedValue({ ok: true })
    render(<ResetPasswordForm token="abc123" />)
    await fillAndSubmit('Abc12345!')
    await waitFor(() => expect(completePasswordResetFn).toHaveBeenCalledWith({ data: { token: 'abc123', password: 'Abc12345!' } }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/login' }))
  })

  it('refuses mismatched passwords without calling the server', async () => {
    render(<ResetPasswordForm token="abc123" />)
    await userEvent.type(screen.getByPlaceholderText('Nova senha'), 'Abc12345!')
    await userEvent.type(screen.getByPlaceholderText('Repita a nova senha'), 'Outra123!')
    await userEvent.click(screen.getByRole('button', { name: 'Definir nova senha' }))
    expect(screen.getByText('As duas não conferem.')).toBeInTheDocument()
    expect(completePasswordResetFn).not.toHaveBeenCalled()
  })

  it('shows the same message for an invalid or expired token', async () => {
    completePasswordResetFn.mockResolvedValue({ ok: false, reason: 'invalid_token' })
    render(<ResetPasswordForm token="vencido" />)
    await fillAndSubmit('Abc12345!')
    expect(await screen.findByText(/Esse link não vale mais/)).toBeInTheDocument()
  })
})
