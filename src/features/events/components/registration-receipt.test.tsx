import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { session } from '../testing/fixtures'
import { RegistrationReceipt } from './registration-receipt'

const base = { protocol: 'INS-20261018-AB2CD', repeated: false, sessionLabel: 'ignored', name: 'Ana Souza', email: 'ana@boamassa.com.br' }

describe('RegistrationReceipt', () => {
  it('confirms with the protocol, the meeting and the name, in the old words', () => {
    render(<RegistrationReceipt receipt={base} session={session()} />)
    expect(screen.getByRole('heading', { name: 'Inscrição confirmada' })).toBeInTheDocument()
    expect(screen.getByText('INS-20261018-AB2CD')).toHaveClass('protocolo')
    expect(screen.getByText('20/10/2026, 19:30 — Presencial: Encontro 1')).toBeInTheDocument()
    expect(screen.getByText('Ana Souza · ana@boamassa.com.br')).toBeInTheDocument()
    expect(screen.getByText(/Guarde o protocolo: é por ele que encontramos a sua inscrição\./)).toBeInTheDocument()
  })

  it('tells a repeated registration apart', () => {
    render(<RegistrationReceipt receipt={{ ...base, repeated: true }} session={session()} />)
    expect(screen.getByRole('heading', { name: 'Você já estava inscrito' })).toBeInTheDocument()
  })

  it('closes with the diagnosis at /diagnosis and the agenda at /events', () => {
    render(<RegistrationReceipt receipt={base} session={session()} />)
    expect(screen.getByRole('heading', { name: 'Chegue ao encontro com a sua conta feita' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fazer o diagnóstico' })).toHaveAttribute('href', '/diagnosis')
    expect(screen.getByRole('link', { name: 'Ver outros encontros' })).toHaveAttribute('href', '/events')
  })

  it('falls back to the server line when the session is not on the page any more', () => {
    render(<RegistrationReceipt receipt={{ ...base, sessionLabel: '20/10/2026, 19:30 — Presencial: Encontro 1' }} session={null} />)
    expect(screen.getByText('20/10/2026, 19:30 — Presencial: Encontro 1')).toBeInTheDocument()
  })
})
