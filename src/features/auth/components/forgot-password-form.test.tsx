import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

const { requestPasswordResetFn } = vi.hoisted(() => ({ requestPasswordResetFn: vi.fn() }))
vi.mock('../api/password-reset', () => ({ requestPasswordResetFn }))
// `Link` needs a <RouterProvider> context it doesn't have under Testing Library; stub it with a plain anchor
// (same technique the reset-password-form test already uses for `useNavigate`).
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

const { ForgotPasswordForm } = await import('./forgot-password-form')

describe('ForgotPasswordForm', () => {
  it('shows the same message whatever the server answers', async () => {
    requestPasswordResetFn.mockResolvedValue({ ok: true })
    render(<ForgotPasswordForm />)
    await userEvent.type(screen.getByLabelText('Usuário'), 'victor.medeiros')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))
    await waitFor(() => expect(requestPasswordResetFn).toHaveBeenCalledWith({ data: { username: 'victor.medeiros' } }))
    expect(await screen.findByText(/Se o usuário existir e tiver e-mail cadastrado/)).toBeInTheDocument()
  })

  it('shows the rate limit message when the server says so', async () => {
    requestPasswordResetFn.mockResolvedValue({ ok: false, reason: 'rate_limited', retryAfterSeconds: 42 })
    render(<ForgotPasswordForm />)
    await userEvent.type(screen.getByLabelText('Usuário'), 'victor.medeiros')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))
    expect(await screen.findByText('Muitas tentativas. Espere um minuto e tente de novo.')).toBeInTheDocument()
  })

  it('never stays stuck on "Enviando…" when the call fails, and still shows the same message', async () => {
    requestPasswordResetFn.mockRejectedValue(new Error('rede caiu'))
    render(<ForgotPasswordForm />)
    await userEvent.type(screen.getByLabelText('Usuário'), 'victor.medeiros')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))
    expect(await screen.findByText(/Se o usuário existir e tiver e-mail cadastrado/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar link de redefinição' })).toBeEnabled()
  })
})
