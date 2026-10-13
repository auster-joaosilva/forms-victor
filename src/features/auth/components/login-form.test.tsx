import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

// `Link` needs a <RouterProvider> context it doesn't have under Testing Library (nor under
// `renderToString` here); stub it with a plain anchor.
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...rest }: { children?: ReactNode; to: string }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
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
