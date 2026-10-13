import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '@/lib/query-client'

const { listUsersFn, createUserFn, updateUserFn, setUserEmailFn, sendResetLinkFn, sendResetLinksToAllFn, importUserEmailsFn } = vi.hoisted(() => ({
  listUsersFn: vi.fn(), createUserFn: vi.fn(), updateUserFn: vi.fn(), setUserEmailFn: vi.fn(), sendResetLinkFn: vi.fn(), sendResetLinksToAllFn: vi.fn(), importUserEmailsFn: vi.fn(),
}))
vi.mock('../api/users', () => ({ listUsersFn, createUserFn, updateUserFn, setUserEmailFn, sendResetLinkFn, sendResetLinksToAllFn, importUserEmailsFn }))

const { UsersPanel } = await import('./users-panel')

const victor = { id: 'u1', username: 'victor', name: 'Victor', role: 'admin' as const, active: true, lastLoginAt: null, createdAt: '2026-09-01T12:00:00.000Z', email: 'victor@austercontabil.com.br' }

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
    await waitFor(() => expect(createUserFn).toHaveBeenCalledWith({ data: { username: 'bia', name: '', password: 'senha-bem-longa-1', role: 'operator' } }))
    await waitFor(() => expect(listUsersFn).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the refusal of the server', async () => {
    listUsersFn.mockResolvedValue([victor])
    updateUserFn.mockResolvedValue({ ok: false, message: 'não dá para desativar ou rebaixar o único administrador ativo; promova outro antes' })
    renderPanel()
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Papel de victor' }), 'operador')
    expect(updateUserFn).toHaveBeenCalledWith({ data: { username: 'victor', changes: { role: 'operator' } } })
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

  it('sends the reset link for one user', async () => {
    listUsersFn.mockResolvedValue([victor])
    sendResetLinkFn.mockResolvedValue({ sent: 1 })
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar link de redefinição' }))
    await waitFor(() => expect(sendResetLinkFn).toHaveBeenCalledWith({ data: { username: 'victor' } }))
  })

  it('disables every action while a reset link is in flight, so a double click does not issue a second token', async () => {
    listUsersFn.mockResolvedValue([victor])
    let finish: (value: { sent: number; failed: number }) => void = () => {}
    sendResetLinkFn.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderPanel()
    const button = await screen.findByRole('button', { name: 'Enviar link de redefinição' })
    await userEvent.click(button)
    await waitFor(() => expect(button).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Enviar link de redefinição para todos com e-mail cadastrado' })).toBeDisabled()
    finish({ sent: 1, failed: 0 })
    await waitFor(() => expect(button).toBeEnabled())
  })

  it('says when the single reset link could not be sent', async () => {
    listUsersFn.mockResolvedValue([victor])
    sendResetLinkFn.mockResolvedValue({ sent: 0, failed: 1 })
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar link de redefinição' }))
    expect(await screen.findByText('Enviar link: o envio falhou; tente de novo em instantes.')).toBeInTheDocument()
  })

  it('asks before sending to everyone, and reports how many failed', async () => {
    listUsersFn.mockResolvedValue([victor])
    sendResetLinksToAllFn.mockResolvedValue({ sent: 2, failed: 1 })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderPanel()
    const toAll = await screen.findByRole('button', { name: 'Enviar link de redefinição para todos com e-mail cadastrado' })
    await userEvent.click(toAll)
    expect(confirm).toHaveBeenCalledWith('Enviar o link de redefinição para todos os usuários com e-mail cadastrado?')
    expect(sendResetLinksToAllFn).not.toHaveBeenCalled()
    await userEvent.click(toAll)
    await waitFor(() => expect(sendResetLinksToAllFn).toHaveBeenCalledOnce())
    expect(await screen.findByText('Enviado para 2 pessoa(s), 1 falha(s).')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('imports emails and lists again after, so the email column is up to date', async () => {
    listUsersFn.mockResolvedValue([victor])
    importUserEmailsFn.mockResolvedValue({ ok: true, appliedUsernames: ['victor'] })
    renderPanel()
    await userEvent.type(await screen.findByPlaceholderText(/usuario;email/), 'victor;victor@austercontabil.com.br')
    await userEvent.click(screen.getByRole('button', { name: 'Importar e-mails' }))
    await waitFor(() => expect(importUserEmailsFn).toHaveBeenCalledWith({ data: { text: 'victor;victor@austercontabil.com.br' } }))
    expect(await screen.findByText('1 e-mail(s) atualizado(s): victor')).toBeInTheDocument()
    await waitFor(() => expect(listUsersFn).toHaveBeenCalledTimes(2))
    expect(screen.getByPlaceholderText(/usuario;email/)).toHaveValue('')
  })

  it('never leaves the import stuck when the server cannot be reached', async () => {
    listUsersFn.mockResolvedValue([victor])
    importUserEmailsFn.mockRejectedValue(new Error('rede caiu'))
    renderPanel()
    await userEvent.type(await screen.findByPlaceholderText(/usuario;email/), 'victor;victor@austercontabil.com.br')
    await userEvent.click(screen.getByRole('button', { name: 'Importar e-mails' }))
    expect(await screen.findByText('Importar e-mails: não deu para falar com o servidor (rede caiu)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Importar e-mails' })).toBeEnabled()
    expect(screen.getByPlaceholderText(/usuario;email/)).toHaveValue('victor;victor@austercontabil.com.br')
  })
})
