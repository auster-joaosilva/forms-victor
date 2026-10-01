import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { InvitationView } from '../api/invitations'
import { InvitationsView } from './invitations-view'

const invitation = (token: string, extra: Partial<InvitationView> = {}): InvitationView => ({
  token, companyName: `Empresa ${token}`, cnpj: null, email: null, openCount: 2, lastOpenedAt: '2026-09-20T12:00:00.000Z',
  createdAt: '2026-09-19T12:00:00.000Z', createdBy: 'maria', responseCount: 0, adhesionCount: 0,
  links: { diagnosis: `https://hml.example/diagnosis?invite=${token}`, adhesion: `https://hml.example/adhesion?invite=${token}` },
  ...extra,
})

describe('InvitationsView', () => {
  it('lists the diagnosis link and hides "Apagar" for invitations already used', () => {
    render(<InvitationsView invitations={[invitation('AAAAAAAAAA'), invitation('BBBBBBBBBB', { responseCount: 1 }), invitation('CCCCCCCCCC', { adhesionCount: 1 })]} error={null} pending={false} onCreate={vi.fn()} onDelete={vi.fn()} onCopy={vi.fn()} />)
    expect(screen.getByText('https://hml.example/diagnosis?invite=AAAAAAAAAA')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Apagar' })).toHaveLength(1)
  })

  it('sends the typed fields, copies both links and shows the server refusal', async () => {
    const onCreate = vi.fn()
    const onCopy = vi.fn()
    render(<InvitationsView invitations={[invitation('AAAAAAAAAA')]} error="Informe ao menos o nome da empresa ou o CNPJ — o link serve para amarrar a resposta a alguém." pending={false} onCreate={onCreate} onDelete={vi.fn()} onCopy={onCopy} />)
    await userEvent.type(screen.getByPlaceholderText('Razão social'), ' Padaria Boa ')
    await userEvent.click(screen.getByRole('button', { name: 'Gerar link' }))
    expect(onCreate).toHaveBeenCalledWith({ companyName: 'Padaria Boa', cnpj: '', email: '' })
    const row = screen.getByText('Empresa AAAAAAAAAA').closest('tr')
    if (!row) throw new Error('sem linha')
    await userEvent.click(within(row).getByRole('button', { name: 'Diagnóstico' }))
    await userEvent.click(within(row).getByRole('button', { name: 'Adesão' }))
    expect(onCopy.mock.calls).toEqual([['https://hml.example/diagnosis?invite=AAAAAAAAAA'], ['https://hml.example/adhesion?invite=AAAAAAAAAA']])
    expect(screen.getByText(/Informe ao menos o nome da empresa ou o CNPJ/)).toBeInTheDocument()
  })
})
