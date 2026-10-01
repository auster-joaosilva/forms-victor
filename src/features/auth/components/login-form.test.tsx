import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
}))
vi.mock('@/lib/auth-client', () => ({ authClient: { signIn: { username: vi.fn() } } }))

const { LoginForm } = await import('./login-form')

describe('LoginForm', () => {
  it('cannot be submitted before hydration, so the password never goes into the URL', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(<LoginForm redirectTo="/backoffice" />)
    expect(host.querySelector('form')?.getAttribute('method')).toBe('post')
    expect(host.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true)
  })

  it('enables the submit button once hydrated', () => {
    render(<LoginForm redirectTo="/backoffice" />)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })
})
