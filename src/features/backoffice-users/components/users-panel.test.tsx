import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/lib/query-client'

const { listUsersFn, createUserFn, updateUserFn } = vi.hoisted(() => ({ listUsersFn: vi.fn(), createUserFn: vi.fn(), updateUserFn: vi.fn() }))
vi.mock('../api/users', () => ({ listUsersFn, createUserFn, updateUserFn }))

const { UsersPanel } = await import('./users-panel')

const victor = { id: 'u1', username: 'victor', name: 'Victor', role: 'admin' as const, active: true, lastLoginAt: null, createdAt: '2026-09-01T12:00:00.000Z' }

const renderPanel = () =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <UsersPanel />
    </QueryClientProvider>,
  )

const fillPassword = async (password: string) => {
  const dialog = await screen.findByRole('dialog')
  await userEvent.type(within(dialog).getByPlaceholderText('Senha'), password)
  await userEvent.type(within(dialog).getByPlaceholderText('Repita a senha'), password)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Definir' }))
}

describe('UsersPanel', () => {
  it('asks for the password before creating and lists again after', async () => {
    listUsersFn.mockResolvedValue([victor])
    createUserFn.mockResolvedValue({ ok: true })
    renderPanel()
    await userEvent.type(await screen.findByPlaceholderText('usuario (sem espaço nem acento)'), 'bia')
    await userEvent.click(screen.getByRole('button', { name: 'Criar usuário' }))
    expect(within(await screen.findByRole('dialog')).getByText('Senha de bia')).toBeInTheDocument()
    await fillPassword('senha-bem-longa-1')
    await waitFor(() => expect(createUserFn).toHaveBeenCalledWith({ data: { username: 'bia', name: '', password: 'senha-bem-longa-1', role: 'team' } }))
    await waitFor(() => expect(listUsersFn).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the refusal of the server', async () => {
    listUsersFn.mockResolvedValue([victor])
    updateUserFn.mockResolvedValue({ ok: false, message: 'não dá para desativar ou rebaixar o único administrador ativo; promova outro antes' })
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Tornar equipe' }))
    expect(updateUserFn).toHaveBeenCalledWith({ data: { username: 'victor', changes: { role: 'team' } } })
    expect(await screen.findByText('Mudar papel: não dá para desativar ou rebaixar o único administrador ativo; promova outro antes')).toBeInTheDocument()
  })

  it('changes a password and renames through the prompt', async () => {
    listUsersFn.mockResolvedValue([victor])
    updateUserFn.mockResolvedValue({ ok: true })
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Victor Hugo')
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Trocar senha' }))
    expect(within(await screen.findByRole('dialog')).getByText('Nova senha de victor')).toBeInTheDocument()
    await fillPassword('senha-bem-longa-2')
    await waitFor(() => expect(updateUserFn).toHaveBeenCalledWith({ data: { username: 'victor', changes: { password: 'senha-bem-longa-2' } } }))
    await userEvent.click(screen.getByRole('button', { name: 'Renomear' }))
    expect(prompt).toHaveBeenCalledWith('Novo nome de victor', 'Victor')
    await waitFor(() => expect(updateUserFn).toHaveBeenCalledWith({ data: { username: 'victor', changes: { name: 'Victor Hugo' } } }))
    prompt.mockRestore()
  })
})
