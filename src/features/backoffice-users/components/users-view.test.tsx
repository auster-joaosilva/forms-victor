import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UsersView } from './users-view'

const users = [
  { id: 'u1', username: 'victor', name: 'Victor', role: 'admin' as const, active: true, lastLoginAt: null, createdAt: '2026-09-01T12:00:00.000Z' },
  { id: 'u2', username: 'ana', name: 'Ana', role: 'operator' as const, active: false, lastLoginAt: null, createdAt: '2026-09-02T12:00:00.000Z' },
]

const handlers = () => ({ onCreate: vi.fn(), onChange: vi.fn(), onRequestPassword: vi.fn(), onRename: vi.fn() })

describe('UsersView', () => {
  it('shows role and situation and sends one change at a time', async () => {
    const props = handlers()
    render(<UsersView users={users} error="não dá para desativar ou rebaixar o único administrador ativo; promova outro antes" pending={false} {...props} />)
    const ana = screen.getByText('ana').closest('tr')
    if (!ana) throw new Error('sem linha')
    expect(within(ana).getByText('operador', { selector: '.bo-role' })).toBeInTheDocument()
    expect(within(ana).getByText('desativado')).toBeInTheDocument()
    await userEvent.click(within(ana).getByRole('button', { name: 'Reativar' }))
    await userEvent.selectOptions(within(ana).getByRole('combobox', { name: 'Papel de ana' }), 'regularização')
    expect(props.onChange.mock.calls).toEqual([['ana', { active: true }], ['ana', { role: 'regularization' }]])
    await userEvent.click(within(ana).getByRole('button', { name: 'Trocar senha' }))
    await userEvent.click(within(ana).getByRole('button', { name: 'Renomear' }))
    expect(props.onRequestPassword).toHaveBeenCalledWith('ana')
    expect(props.onRename).toHaveBeenCalledWith('ana', 'Ana')
    expect(screen.getByText(/único administrador ativo/)).toBeInTheDocument()
  })

  it('explains the four roles as the old panel did', () => {
    render(<UsersView users={users} error={null} pending={false} {...handlers()} />)
    expect(screen.getByText(/tudo, e é o único que cria e altera usuários\./)).toBeInTheDocument()
    expect(screen.getByText(/respostas, convites, eventos e inscrições\. Não alcança adesão\./)).toBeInTheDocument()
    const options = within(screen.getByRole('combobox', { name: 'Papel do novo usuário' })).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['operador', 'regularização', 'gestor de departamento', 'administrador'])
  })

  it('asks for the username before creating', async () => {
    const props = handlers()
    render(<UsersView users={users} error={null} pending={false} {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Criar usuário' }))
    expect(screen.getByText('Informe o usuário.')).toBeInTheDocument()
    expect(props.onCreate).not.toHaveBeenCalled()
    await userEvent.type(screen.getByPlaceholderText('usuario (sem espaço nem acento)'), ' Bia ')
    await userEvent.type(screen.getByPlaceholderText('Nome de quem usa'), 'Beatriz')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Papel do novo usuário' }), 'administrador')
    await userEvent.click(screen.getByRole('button', { name: 'Criar usuário' }))
    expect(props.onCreate).toHaveBeenCalledWith({ username: 'bia', name: 'Beatriz', role: 'admin' })
  })
})
